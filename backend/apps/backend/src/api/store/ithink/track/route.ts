import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { NormalizedTrackShipment } from "../../../../modules/ithink/services/tracking"

const TRACKING_META_KEY = "ithink_tracking"

function snapshotFrom(metadata: Record<string, unknown> | null): NormalizedTrackShipment | undefined {
  const snapshot = metadata?.[TRACKING_META_KEY]
  if (typeof snapshot !== "object" || snapshot === null) {
    return undefined
  }
  return snapshot as NormalizedTrackShipment
}

// Storefront tracking lookup. Returns the most recent tracking snapshot the
// `ithink-tracking-poll` job persisted on the matching fulfillment, keyed by
// the AWB (waybill) shown to the customer. Tracking data is polled server-side
// only; the iThink API credentials never reach the storefront.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const awb = typeof req.query.awb === "string" ? req.query.awb.trim() : ""
  if (awb.length === 0) {
    res.status(400).json({ message: "A tracking number (AWB) is required" })
    return
  }

  const fulfillmentModule = req.scope.resolve(Modules.FULFILLMENT)
  const fulfillments = await fulfillmentModule.listFulfillments(
    { provider_id: "ithink" },
    { take: 100 }
  )

  const fulfillment = fulfillments.find((candidate) => candidate.data?.awb === awb)
  if (!fulfillment) {
    res.status(404).json({ message: "No shipment found for this tracking number" })
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
