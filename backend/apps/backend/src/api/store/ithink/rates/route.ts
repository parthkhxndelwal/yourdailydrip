import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { IthinkFulfillmentService } from "../../../../modules/ithink/services/ithink-fulfillment"
import { rateSlots, tatDays } from "../../../../modules/ithink/services/fulfillment-validation"

// Medusa v2 fulfillment providers are registered in the container under
// `fp_<identifier>_<id>` (see @medusajs/fulfillment/dist/loaders/providers.js).
// The ithink provider's static identifier is "ithink" and medusa-config.ts
// registers it with id "ithink", so the key is "fp_ithink_ithink" ("fp_ithink"
// is a fallback for installs that omit the provider id).
const ITHINK_PROVIDER_KEYS = ["fp_ithink_ithink", "fp_ithink"] as const

type RateHintsProvider = Pick<IthinkFulfillmentService, "getRateHints">

function resolveRateHintsProvider(
  scope: { resolve: (key: string) => unknown }
): RateHintsProvider | undefined {
  for (const key of ITHINK_PROVIDER_KEYS) {
    try {
      const provider = scope.resolve(key) as RateHintsProvider | undefined
      if (provider) {
        return provider
      }
    } catch {
      // fall through to the next candidate key
    }
  }
  return undefined
}

// Storefront rate hints: the cheapest and fastest courier for a delivery
// pincode plus the expected delivery date. Pincodes are public data, so the
// route needs no auth; credentials never leave the server. On any iThink
// failure the route answers 502 and the storefront renders no hint.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const toPincode = typeof req.query.pincode === "string" ? req.query.pincode.trim() : ""
  if (toPincode.length === 0) {
    res.status(400).json({ message: "A delivery pincode is required" })
    return
  }
  const mrpValue = typeof req.query.mrp === "string" ? Number(req.query.mrp) : Number.NaN
  const productMrp = Number.isFinite(mrpValue) && mrpValue > 0 ? mrpValue : undefined

  const provider = resolveRateHintsProvider(req.scope)
  if (!provider) {
    try {
      const moduleService = req.scope.resolve(Modules.FULFILLMENT) as {
        __container__?: { resolve: (key: string) => unknown }
      }
      const inner = moduleService.__container__
      console.error(
        "[rates-debug] root fp_* missing; module container present:",
        Boolean(inner)
      )
      if (inner) {
        for (const key of ITHINK_PROVIDER_KEYS) {
          try {
            const candidate = inner.resolve(key) as unknown
            console.error("[rates-debug] inner resolve", key, "->", Boolean(candidate))
          } catch (error) {
            console.error(
              "[rates-debug] inner resolve",
              key,
              "failed:",
              error instanceof Error ? error.message : String(error)
            )
          }
        }
      }
    } catch (error) {
      console.error(
        "[rates-debug] fulfillment init error:",
        error instanceof Error ? error.message : String(error)
      )
    }
    res.status(502).json({ error: "rate_unavailable" })
    return
  }

  let fromPincode: string | undefined
  try {
    const stockLocationService = req.scope.resolve(
      Modules.STOCK_LOCATION
    ) as {
      listStockLocations: (
        selector: Record<string, unknown>,
        config: { relations: string[]; take: number }
      ) => Promise<Array<{ address?: { postal_code?: string } }>>
    }
    const locations = await stockLocationService.listStockLocations({}, {
      relations: ["address"],
      take: 20,
    })
    // List order is not guaranteed; pick the first location with an Indian pincode.
    fromPincode = locations
      .map((location) => location.address?.postal_code)
      .find((postalCode) => typeof postalCode === "string" && /^\d{6}$/.test(postalCode))
  } catch {
    fromPincode = undefined
  }
  if (!fromPincode) {
    console.error("[rates-debug] no from pincode from stock locations")
    res.status(502).json({ error: "rate_unavailable" })
    return
  }

  const result = await provider.getRateHints(fromPincode, toPincode, productMrp)
  const slots = result ? rateSlots(result) : undefined
  if (!slots) {
    res.status(502).json({ error: "rate_unavailable" })
    return
  }

  res.status(200).json({
    cheapest: {
      logistic: slots.cheapest.logistic_name,
      rate: slots.cheapest.rate,
      delivery_tat: tatDays(slots.cheapest.delivery_tat),
    },
    fastest: {
      logistic: slots.fastest.logistic_name,
      rate: slots.fastest.rate,
      delivery_tat: tatDays(slots.fastest.delivery_tat),
    },
    expected_delivery_date: result?.expectedDeliveryDate,
    currency: "INR",
    from_pincode: fromPincode,
    to_pincode: toPincode,
  })
}
