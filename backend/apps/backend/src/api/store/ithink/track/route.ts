import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { FulfillmentDTO } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { NormalizedTrackShipment } from "../../../../modules/ithink/services/tracking"

const TRACKING_META_KEY = "ithink_tracking"
const PAGE_SIZE = 20

// Storefront tracking lookup. Returns the most recent tracking snapshot the
// `ithink-tracking-poll` job persisted on the matching fulfillment, keyed by
// the AWB (waybill) or the dashboard-synced order number. Tracking data is
// polled server-side only; the iThink API credentials never reach the
// storefront. Synced-but-unbooked fulfillments (dashboard mode, no AWB yet)
// answer with a pending state instead of 404 so the storefront can show the
// order is with the logistics provider.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const awb = typeof req.query.awb === "string" ? req.query.awb.trim() : ""
  const orderNo = typeof req.query.order_no === "string" ? req.query.order_no.trim() : ""

  if (awb.length === 0 && orderNo.length === 0) {
    res.status(400).json({
      message: "A tracking number (AWB) or an order number is required",
    })
    return
  }

  const fulfillmentModule = req.scope.resolve(Modules.FULFILLMENT)
  const fulfillment = await findIthinkFulfillment(fulfillmentModule, (candidate) => {
    if (awb.length > 0 && candidate.data?.awb === awb) {
      return true
    }
    if (orderNo.length > 0 && candidate.data?.order_no === orderNo) {
      return true
    }
    return false
  })

  if (!fulfillment) {
    res.status(404).json({ message: "No shipment found for this tracking number" })
    return
  }

  if (typeof fulfillment.data?.awb !== "string") {
    res.status(200).json({
      state: "pending",
      refnum: typeof fulfillment.data?.refnum === "string" ? fulfillment.data.refnum : undefined,
      order_no:
        typeof fulfillment.data?.order_no === "string" ? fulfillment.data.order_no : undefined,
      provider: "ithink",
      message:
        "Order synced with logistics provider. Tracking AWB will appear once the courier dispatches it.",
    })
    return
  }

  const snapshot = snapshotFrom(fulfillment.metadata)
  if (!snapshot) {
    res.status(404).json({
      message: "Tracking information is not available for this shipment yet",
    })
    return
  }

  res.status(200).json(snapshot)
}

function snapshotFrom(metadata: Record<string, unknown> | null): NormalizedTrackShipment | undefined {
  const snapshot = metadata?.[TRACKING_META_KEY]
  if (typeof snapshot !== "object" || snapshot === null) {
    return undefined
  }
  return snapshot as NormalizedTrackShipment
}

type FulfillmentModule = {
  listFulfillments: (
    filters: Record<string, unknown>,
    options: { take: number; skip: number }
  ) => Promise<FulfillmentDTO[]>
}

async function findIthinkFulfillment(
  fulfillmentModule: FulfillmentModule,
  matches: (fulfillment: FulfillmentDTO) => boolean
): Promise<FulfillmentDTO | undefined> {
  let skip = 0
  for (;;) {
    const page = await fulfillmentModule.listFulfillments(
      { provider_id: "ithink" },
      { take: PAGE_SIZE, skip }
    )
    const found = page.find(matches)
    if (found) {
      return found
    }
    if (page.length < PAGE_SIZE) {
      return undefined
    }
    skip += PAGE_SIZE
  }
}
