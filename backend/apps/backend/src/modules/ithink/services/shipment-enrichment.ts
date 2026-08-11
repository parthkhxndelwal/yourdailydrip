import type { FulfillmentDTO } from "@medusajs/framework/types"
import type { IthinkClient } from "../clients/ithink-client"
import type { GetAwbParams, IthinkTrackShipment } from "../clients/types"
import { stringValue } from "./mappers"
import {
  errorMessage,
  emitUpdated,
  snapshotsEqual,
  statusTimestampInput,
  storedSnapshot,
  TRACK_CHUNK_SIZE,
  TRACKING_META_KEY,
  type FulfillmentEventBus,
  type FulfillmentStore,
  type IthinkTrackingSnapshot,
  type JobLogger,
} from "./reconciliation"
import { isDelivered, isTerminal, normalizeTrackShipment } from "./tracking"

export type EnrichmentResult = {
  total: number
  updated: number
  terminal: number
  failed: number
}

// Path B: fulfillments with an AWB are delta-polled via get_awb (30-minute
// window) and enriched via trackShipments, which the job calls in chunks of 10
// so one failing chunk cannot abort the siblings.
export async function enrichAwbsInWindow(params: {
  client: Pick<IthinkClient, "getAwbsInWindow" | "trackShipments">
  fulfillments: FulfillmentDTO[]
  window: GetAwbParams
  store: FulfillmentStore
  events: FulfillmentEventBus
  logger: JobLogger
}): Promise<EnrichmentResult> {
  const { client, fulfillments, window, store, events, logger } = params
  if (fulfillments.length === 0) {
    return { total: 0, updated: 0, terminal: 0, failed: 0 }
  }
  const result: EnrichmentResult = {
    total: fulfillments.length,
    updated: 0,
    terminal: 0,
    failed: 0,
  }

  let updatedAwbs: string[]
  try {
    updatedAwbs = await client.getAwbsInWindow(window)
  } catch (error) {
    result.failed += 1
    logger.error(`iThink tracking poll: getAwbsInWindow failed: ${errorMessage(error)}`)
    return result
  }

  const fulfillmentByAwb = new Map<string, FulfillmentDTO>()
  for (const fulfillment of fulfillments) {
    const awb = stringValue(fulfillment.data?.awb)
    if (awb) {
      fulfillmentByAwb.set(awb, fulfillment)
    }
  }
  const trackedAwbs = [...new Set(updatedAwbs.filter((awb) => fulfillmentByAwb.has(awb)))]
  if (trackedAwbs.length === 0) {
    return result
  }

  for (let index = 0; index < trackedAwbs.length; index += TRACK_CHUNK_SIZE) {
    const chunk = trackedAwbs.slice(index, index + TRACK_CHUNK_SIZE)
    let shipments: IthinkTrackShipment[]
    try {
      shipments = await client.trackShipments(chunk)
    } catch (error) {
      result.failed += 1
      logger.error(
        `iThink tracking poll: trackShipments chunk failed (${chunk.length} AWB(s)): ${errorMessage(error)}`
      )
      continue
    }
    for (const shipment of shipments) {
      const fulfillment = fulfillmentByAwb.get(shipment.awb_no)
      if (!fulfillment) {
        continue
      }
      try {
        await applyTrackingSnapshot({ fulfillment, shipment, store, events, logger, result })
        result.updated += 1
      } catch (error) {
        result.failed += 1
        logger.error(
          `iThink tracking poll: update failed for fulfillment ${fulfillment.id}: ${errorMessage(error)}`
        )
      }
    }
  }
  return result
}

async function applyTrackingSnapshot(params: {
  fulfillment: FulfillmentDTO
  shipment: IthinkTrackShipment
  store: FulfillmentStore
  events: FulfillmentEventBus
  logger: JobLogger
  result: EnrichmentResult
}): Promise<void> {
  const { fulfillment, shipment, store, events, logger, result } = params
  const normalized = normalizeTrackShipment(shipment)
  const status = { status: normalized.status, statusCode: normalized.statusCode }
  if (isTerminal(status) && !isDelivered(status)) {
    result.terminal += 1
    logger.info(
      `iThink tracking poll: fulfillment ${fulfillment.id} reached terminal status ${normalized.statusCode || normalized.status}; snapshot only, no timestamps`
    )
  }
  const snapshot: IthinkTrackingSnapshot = {
    awb_no: normalized.awb,
    tracked_at: new Date().toISOString(),
  }
  const logistic = stringValue(fulfillment.data?.logistic)
  if (logistic) {
    snapshot.logistic = logistic
  }
  if (normalized.status) {
    snapshot.latest_courier_status = normalized.status
  }
  if (normalized.expectedDeliveryDate) {
    snapshot.expected_delivery_date = normalized.expectedDeliveryDate
  }
  if (snapshotsEqual(storedSnapshot(fulfillment.metadata), snapshot)) {
    return
  }
  const timestamps = statusTimestampInput(fulfillment, status)
  await store.updateFulfillment(fulfillment.id, {
    metadata: { ...(fulfillment.metadata ?? {}), [TRACKING_META_KEY]: snapshot },
    ...timestamps,
  })
  await emitUpdated(fulfillment.id, events, logger)
}
