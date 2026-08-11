import type { Logger, ValidateFulfillmentDataContext } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import type { IthinkClient } from "../clients/ithink-client"
import type { IthinkRate, RateCheckResult } from "../clients/types"
import { cartTotal, shipmentDimensions, shipmentDimensionsForOrder, stringValue, totalWeightKg } from "./mappers"
import { DEFAULT_WEIGHT_KG, type IthinkProviderOptions } from "./mappers"

export type RateEnrichment = {
  delivery_tat: number
  expected_delivery_date?: string
  cheapest_logistic: string
  cheapest_rate: number
  fastest_logistic: string
  fastest_rate: number
}

export const RATE_CACHE_TTL_MS = 30 * 60 * 1000
export const RATE_CACHE_MAX_ENTRIES = 1000

type RateCacheEntry = {
  response: RateCheckResult
  fetchedAt: number
}

// Module-level cache so entries survive provider service re-instantiation
// (Medusa may construct fresh service instances); shared across all instances.
const rateCache = new Map<string, RateCacheEntry>()

function cacheKey(pincode: string, productMrp?: number): string {
  return productMrp === undefined ? pincode : `${pincode}|${productMrp}`
}

export function getCachedRate(pincode: string, productMrp?: number): RateCheckResult | undefined {
  const key = cacheKey(pincode, productMrp)
  const entry = rateCache.get(key)
  if (!entry) {
    return undefined
  }
  if (Date.now() - entry.fetchedAt > RATE_CACHE_TTL_MS) {
    rateCache.delete(key)
    return undefined
  }
  return entry.response
}

export function cacheRate(
  pincode: string,
  response: RateCheckResult,
  productMrp?: number
): void {
  const key = cacheKey(pincode, productMrp)
  // Re-insert so the entry counts as the newest for overflow eviction.
  rateCache.delete(key)
  rateCache.set(key, { response, fetchedAt: Date.now() })
  while (rateCache.size > RATE_CACHE_MAX_ENTRIES) {
    const oldest = rateCache.keys().next().value
    if (oldest === undefined) {
      break
    }
    rateCache.delete(oldest)
  }
}

export function clearRateCache(): void {
  rateCache.clear()
}

// iThink reports TAT as a string (e.g. "3" or "2-3"); parse the numeric
// prefix for comparison. Non-numeric values never win the fastest slot.
export function tatDays(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const match = /^\d+/.exec(value.trim())
    if (match) {
      return Number(match[0])
    }
  }
  return Number.POSITIVE_INFINITY
}

// The cheapest (min rate) and fastest (min delivery_tat) courier entries from
// a rate/check result; undefined when no courier was returned. Shared by the
// checkout enrichment and the storefront rates route.
export function rateSlots(
  result: RateCheckResult
): { cheapest: IthinkRate; fastest: IthinkRate } | undefined {
  if (result.rates.length === 0) {
    return undefined
  }
  let cheapest: IthinkRate = result.rates[0]
  let fastest: IthinkRate = result.rates[0]
  for (const rate of result.rates) {
    if (rate.rate < cheapest.rate) {
      cheapest = rate
    }
    if (tatDays(rate.delivery_tat) < tatDays(fastest.delivery_tat)) {
      fastest = rate
    }
  }
  return { cheapest, fastest }
}

export function rateEnrichment(result: RateCheckResult): RateEnrichment | undefined {
  const slots = rateSlots(result)
  if (!slots) {
    return undefined
  }
  const enrichment: RateEnrichment = {
    delivery_tat: tatDays(slots.fastest.delivery_tat),
    cheapest_logistic: slots.cheapest.logistic_name,
    cheapest_rate: slots.cheapest.rate,
    fastest_logistic: slots.fastest.logistic_name,
    fastest_rate: slots.fastest.rate,
  }
  if (result.expectedDeliveryDate !== undefined) {
    enrichment.expected_delivery_date = result.expectedDeliveryDate
  }
  return enrichment
}

// The pincode lives on the cart shipping address (context.cart or
// context.shipping_address depending on the flow) or in the method data; the
// typed context.shipping_address is the shape the framework always provides.
export function deliveryPostalCode(
  context: ValidateFulfillmentDataContext,
  data: Record<string, unknown>
): string | undefined {
  const cart = context.cart
  if (typeof cart === "object" && cart !== null) {
    const cartAddress = (cart as Record<string, unknown>).shipping_address
    if (typeof cartAddress === "object" && cartAddress !== null) {
      const fromCart = stringValue((cartAddress as Record<string, unknown>).postal_code)
      if (fromCart) {
        return fromCart
      }
    }
  }
  const dataAddress = data.shipping_address
  if (typeof dataAddress === "object" && dataAddress !== null) {
    const fromData = stringValue((dataAddress as Record<string, unknown>).postal_code)
    if (fromData) {
      return fromData
    }
  }
  return stringValue(context.shipping_address?.postal_code)
}

export type ValidationDeps = {
  client: Pick<IthinkClient, "checkPincode" | "checkRate">
  logger: Logger
  options: IthinkProviderOptions
}

// Dashboard mode enriches the shipping method data with a delivery estimate
// (cheapest/fastest courier + ETA) fetched once per pincode per 30 minutes.
// Any rate/check failure logs and returns the data unchanged: checkout must
// never fail because the estimate is unavailable. Book mode keeps the exact
// legacy path (serviceability check only).
export async function validateWithRates(
  deps: ValidationDeps,
  optionData: Record<string, unknown>,
  data: Record<string, unknown>,
  context: ValidateFulfillmentDataContext
): Promise<Record<string, unknown>> {
  const postalCode = deliveryPostalCode(context, data)
  if (!postalCode) {
    return { ...optionData, ...data }
  }
  if (deps.options.mode === "dashboard") {
    const estimate = await deliveryEstimate(deps, postalCode, context)
    if (!estimate) {
      return { ...optionData, ...data }
    }
    data = { ...data, ...estimate }
  }
  const serviceable = await deps.client.checkPincode(postalCode)
  if (!serviceable) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Pincode ${postalCode} is not serviceable by iThink couriers`
    )
  }
  const dimensions = shipmentDimensions(context.items, deps.options)
  return {
    ...optionData,
    ...data,
    to_pincode: postalCode,
    weight_kg: totalWeightKg(context.items, deps.options),
    shipment_length_cm: dimensions.lengthCm,
    shipment_width_cm: dimensions.widthCm,
    shipment_height_cm: dimensions.heightCm,
  }
}

async function deliveryEstimate(
  deps: ValidationDeps,
  postalCode: string,
  context: ValidateFulfillmentDataContext
): Promise<RateEnrichment | undefined> {
  const cached = getCachedRate(postalCode, cartTotal(context.items))
  if (cached) {
    return rateEnrichment(cached)
  }
  const fromPincode = context.from_location?.address?.postal_code
  if (!fromPincode) {
    return undefined
  }
  const dimensions = shipmentDimensions(context.items, deps.options)
  let result: RateCheckResult
  try {
    result = await deps.client.checkRate({
      fromPincode,
      toPincode: postalCode,
      weightKg: totalWeightKg(context.items, deps.options),
      productMrp: cartTotal(context.items),
      lengthCm: dimensions.lengthCm,
      widthCm: dimensions.widthCm,
      heightCm: dimensions.heightCm,
    })
  } catch (error) {
    deps.logger.error(
      `iThink rate check failed for pincode ${postalCode}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return undefined
  }
  cacheRate(postalCode, result, cartTotal(context.items))
  return rateEnrichment(result)
}

// Storefront rate hints: cache-aware rate/check for a delivery pincode with
// the store's default parcel profile (no cart context exists at that point).
// Reuses the shared module-level cache so the checkout estimate and the rates
// route share one client call per pincode per TTL. Returns undefined on any
// iThink error (the route maps that to a 502 rate_unavailable response).
export async function getRateHints(
  deps: ValidationDeps,
  fromPincode: string,
  toPincode: string,
  productMrp?: number
): Promise<RateCheckResult | undefined> {
  const cached = getCachedRate(toPincode, productMrp)
  if (cached) {
    return cached
  }
  const dims = shipmentDimensionsForOrder({}, deps.options)
  let result: RateCheckResult
  try {
    result = await deps.client.checkRate({
      fromPincode,
      toPincode,
      productMrp,
      weightKg: deps.options.default_weight_kg ?? DEFAULT_WEIGHT_KG,
      lengthCm: dims.lengthCm,
      widthCm: dims.widthCm,
      heightCm: dims.heightCm,
    })
  } catch (error) {
    deps.logger.error(
      `iThink rate check failed for pincode ${toPincode}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return undefined
  }
  cacheRate(toPincode, result, productMrp)
  return result
}
