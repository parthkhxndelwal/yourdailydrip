import type {
  CartPropsForFulfillment,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
} from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { toNumber } from "../clients/payloads"
import type { IthinkClientOptions, IthinkMode } from "../clients/types"

export type IthinkProviderOptions = {
  base_url: string
  access_token: string
  secret_key: string
  pickup_address_id: string
  default_weight_kg?: number
  default_length_cm?: number
  default_width_cm?: number
  default_height_cm?: number
  gst_number?: string
  mode?: IthinkMode
  return_address_id?: string
  order_no_prefix?: string
  poll_enabled?: boolean
}

export const CARRIER_OPTIONS: FulfillmentOption[] = [
  { id: "delhivery", name: "Delhivery", logistic_name: "delhivery" },
  { id: "xpressbees", name: "Xpressbees", logistic_name: "xpressbees" },
  { id: "bluedart", name: "Blue Dart", logistic_name: "bluedart" },
  { id: "ecom", name: "Ecom Express", logistic_name: "ecom" },
  { id: "ekart", name: "Ekart", logistic_name: "ekart" },
]

export const DEFAULT_WEIGHT_KG = 0.5
export const DEFAULT_DIMENSIONS_CM = { length: 20, width: 15, height: 10 }

export function resolveProviderOptions(options: IthinkProviderOptions): IthinkProviderOptions {
  const mode = options.mode ?? "dashboard"
  if (mode !== "dashboard" && mode !== "book") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid iThink provider mode "${String(mode)}"; expected "dashboard" or "book"`
    )
  }
  return {
    ...options,
    mode,
    order_no_prefix: options.order_no_prefix ?? "",
    poll_enabled: options.poll_enabled ?? true,
  }
}

export function toClientOptions(options: IthinkProviderOptions): IthinkClientOptions {
  return {
    baseUrl: options.base_url,
    accessToken: options.access_token,
    secretKey: options.secret_key,
    pickupAddressId: options.pickup_address_id,
    defaultWeightKg: options.default_weight_kg ?? DEFAULT_WEIGHT_KG,
    defaultLengthCm: options.default_length_cm ?? DEFAULT_DIMENSIONS_CM.length,
    defaultWidthCm: options.default_width_cm ?? DEFAULT_DIMENSIONS_CM.width,
    defaultHeightCm: options.default_height_cm ?? DEFAULT_DIMENSIONS_CM.height,
    mode: options.mode ?? "dashboard",
    returnAddressId: options.return_address_id,
    orderNoPrefix: options.order_no_prefix ?? "",
    pollEnabled: options.poll_enabled ?? true,
  }
}

export function totalWeightKg(
  items: CartPropsForFulfillment["items"],
  options: IthinkProviderOptions
): number {
  const declared = items.reduce((sum, item) => {
    return sum + toNumber(item.variant?.weight) * toNumber(item.quantity)
  }, 0)
  return declared > 0 ? declared : options.default_weight_kg ?? DEFAULT_WEIGHT_KG
}

export function cartTotal(items: CartPropsForFulfillment["items"]): number {
  return items.reduce((sum, item) => {
    // item.total can arrive as "" or 0 in the fulfillment context; fall back
    // to unit_price * quantity so product_mrp is never zero (iThink rejects it)
    const total = toNumber(item.total)
    const lineTotal = total > 0 ? total : toNumber(item.unit_price) * toNumber(item.quantity)
    return sum + lineTotal
  }, 0)
}

export function shipmentDimensions(
  items: CartPropsForFulfillment["items"],
  options: IthinkProviderOptions
) {
  const dims = items.reduce(
    (acc, item) => {
      const variant = item.variant
      if (!variant) {
        return acc
      }
      return {
        lengthCm: Math.max(acc.lengthCm, toNumber(variant.length)),
        widthCm: Math.max(acc.widthCm, toNumber(variant.width)),
        heightCm: Math.max(acc.heightCm, toNumber(variant.height)),
      }
    },
    { lengthCm: 0, widthCm: 0, heightCm: 0 }
  )
  return {
    lengthCm:
      dims.lengthCm > 0 ? dims.lengthCm : options.default_length_cm ?? DEFAULT_DIMENSIONS_CM.length,
    widthCm:
      dims.widthCm > 0 ? dims.widthCm : options.default_width_cm ?? DEFAULT_DIMENSIONS_CM.width,
    heightCm:
      dims.heightCm > 0 ? dims.heightCm : options.default_height_cm ?? DEFAULT_DIMENSIONS_CM.height,
  }
}

export function shipmentDimensionsForOrder(
  data: Record<string, unknown>,
  options: IthinkProviderOptions
) {
  return {
    lengthCm:
      numberValue(data.shipment_length_cm) ?? options.default_length_cm ?? DEFAULT_DIMENSIONS_CM.length,
    widthCm:
      numberValue(data.shipment_width_cm) ?? options.default_width_cm ?? DEFAULT_DIMENSIONS_CM.width,
    heightCm:
      numberValue(data.shipment_height_cm) ?? options.default_height_cm ?? DEFAULT_DIMENSIONS_CM.height,
  }
}

export function priceForItem(
  item: Partial<Omit<FulfillmentItemDTO, "fulfillment">>,
  order: Partial<FulfillmentOrderDTO>
): number {
  const line = item.line_item_id
    ? order.items?.find((candidate) => candidate.id === item.line_item_id)
    : undefined
  return line?.unit_price ?? 0
}

export function recipientName(address: {
  first_name?: string
  last_name?: string
  phone?: string
}): string {
  const fullName = `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim()
  return fullName.length > 0 ? fullName : address.phone ?? "Customer"
}

export function optionLogisticName(optionData: Record<string, unknown>): string | undefined {
  const value = stringValue(optionData.logistic_name)
  if (!value) {
    return undefined
  }
  // iThink's rate/order APIs return canonical casing ("Delhivery"); options
  // store the lowercase id ("delhivery"). Normalize before sending to iThink.
  return CANONICAL_LOGISTIC_NAMES[value.toLowerCase()] ?? value
}

const CANONICAL_LOGISTIC_NAMES: Record<string, string> = {
  delhivery: "Delhivery",
  xpressbees: "Xpressbees",
  bluedart: "BlueDart",
  ecom: "Ecom Express",
  ekart: "Ekart",
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}
