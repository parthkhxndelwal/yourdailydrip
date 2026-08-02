import type { ScheduledJobContext } from "@medusajs/framework/jobs"
import type {
  FulfillmentDTO,
  Logger,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  FulfillmentEvents,
  Modules,
} from "@medusajs/framework/utils"
import { IthinkClient } from "../modules/ithink/clients/ithink-client"
import { toIthinkDateTime } from "../modules/ithink/clients/payloads"
import {
  providerOptionsFromEnv,
  toClientOptions,
} from "../modules/ithink/services/mappers"
import {
  isTerminalStatusCode,
  normalizeTrackShipment,
  type NormalizedTrackShipment,
} from "../modules/ithink/services/tracking"

// Polls iThink for shipment tracking updates and persists them on the
// fulfillment's metadata as an idempotent snapshot.
//
// The iThink V3 `order/get_awb.json` endpoint only accepts a rolling window of
// at most 30 minutes, so the schedule must not poll faster than that window.
// `*/30 * * * *` runs every 30 minutes at :00 and :30, giving each run a
// non-overlapping window of its own.
//
// This job assumes a single backend replica is running the scheduler. Running
// multiple replicas would poll iThink redundantly (the writes are still
// idempotent, so duplicates are harmless, but the extra API calls are not).
export const config = {
  name: "ithink-tracking-poll",
  schedule: "*/30 * * * *",
}

const TRACKING_WINDOW_MS = 30 * 60 * 1000
const TRACKING_META_KEY = "ithink_tracking"
const FULFILLMENT_PAGE_SIZE = 50

function storedSnapshot(metadata: FulfillmentDTO["metadata"]): NormalizedTrackShipment | undefined {
  const snapshot = metadata?.[TRACKING_META_KEY]
  if (typeof snapshot !== "object" || snapshot === null) {
    return undefined
  }
  return snapshot as NormalizedTrackShipment
}

function snapshotChanged(
  previous: NormalizedTrackShipment | undefined,
  next: NormalizedTrackShipment
): boolean {
  if (!previous) {
    return true
  }
  if (
    previous.statusCode !== next.statusCode ||
    previous.status !== next.status ||
    previous.scans.length !== next.scans.length
  ) {
    return true
  }
  const lastPrevious = previous.scans[previous.scans.length - 1]
  const lastNext = next.scans[next.scans.length - 1]
  if (!lastPrevious || !lastNext) {
    return true
  }
  return (
    lastPrevious.at !== lastNext.at ||
    lastPrevious.statusCode !== lastNext.statusCode ||
    lastPrevious.location !== lastNext.location ||
    lastPrevious.remark !== lastNext.remark
  )
}

export default async function ithinkTrackingPoll(
  container: MedusaContainer,
  _context?: ScheduledJobContext
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)

  const providerOptions = providerOptionsFromEnv()
  if (!providerOptions) {
    logger.info(
      "iThink tracking poll skipped: ITHINK_* environment variables are not configured"
    )
    return
  }

  const client = new IthinkClient(toClientOptions(providerOptions))
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const eventBus = container.resolve(Modules.EVENT_BUS)

  // Window covers the last 30 minutes, matching the iThink API limit.
  const now = new Date()
  const windowStart = new Date(now.getTime() - TRACKING_WINDOW_MS)
  const updatedAwbs = await client.getAwbsInWindow({
    startDateTime: toIthinkDateTime(windowStart),
    endDateTime: toIthinkDateTime(now),
  })

  if (updatedAwbs.length === 0) {
    logger.info("iThink tracking poll: no shipments updated in the window")
    return
  }

  // Map every active iThink fulfillment (with a known AWB) to its AWB so we
  // only track shipments we actually created.
  const fulfillmentByAwb = new Map<string, FulfillmentDTO>()
  let skip = 0
  while (true) {
    const page = await fulfillmentModule.listFulfillments(
      { provider_id: "ithink" },
      { take: FULFILLMENT_PAGE_SIZE, skip }
    )
    for (const fulfillment of page) {
      if (fulfillment.canceled_at || fulfillment.delivered_at) {
        continue
      }
      const snapshot = storedSnapshot(fulfillment.metadata)
      if (snapshot && isTerminalStatusCode(snapshot.statusCode)) {
        // Terminal shipments do not transition further; never re-poll them.
        continue
      }
      const awb = fulfillment.data?.awb
      if (typeof awb === "string" && awb.length > 0) {
        fulfillmentByAwb.set(awb, fulfillment)
      }
    }
    if (page.length < FULFILLMENT_PAGE_SIZE) {
      break
    }
    skip += FULFILLMENT_PAGE_SIZE
  }

  const trackedAwbs = updatedAwbs.filter((awb) => fulfillmentByAwb.has(awb))
  if (trackedAwbs.length === 0) {
    return
  }

  const shipments = await client.trackShipments(trackedAwbs)
  let updatedCount = 0

  for (const shipment of shipments) {
    const fulfillment = fulfillmentByAwb.get(shipment.awb_no)
    if (!fulfillment) {
      continue
    }
    const normalized = normalizeTrackShipment(shipment)
    const previous = storedSnapshot(fulfillment.metadata)
    if (!snapshotChanged(previous, normalized)) {
      continue
    }
    const metadata = {
      ...(fulfillment.metadata ?? {}),
      [TRACKING_META_KEY]: normalized,
    }
    await fulfillmentModule.updateFulfillment(fulfillment.id, { metadata })
    await eventBus.emit({
      name: FulfillmentEvents.FULFILLMENT_UPDATED,
      data: { id: fulfillment.id },
    })
    updatedCount += 1
  }

  logger.info(
    `iThink tracking poll: updated ${updatedCount} fulfillment(s) out of ${trackedAwbs.length} tracked AWB(s)`
  )
}
