import { FulfillmentEvents, Modules } from "@medusajs/framework/utils"
import type { FulfillmentDTO, Logger } from "@medusajs/framework/types"
import type { IthinkClient } from "../clients/ithink-client"
import { toIthinkDateTime } from "../clients/payloads"
import type { GetAwbParams, OrderDetails } from "../clients/types"
import { stringValue } from "./mappers"
import type { IthinkProviderOptions } from "./mappers"
import { isActive, isDelivered } from "./tracking"

// The ithink provider is registered in the container under the fulfillment
// provider keys (fp_<identifier>_<id> with id "ithink", plus a fallback for
// installs that omit the id). Same keys as the order-placed subscriber.
export const ITHINK_PROVIDER_KEYS = ["fp_ithink_ithink", "fp_ithink"] as const

export type ContainerLike = { resolve: (key: string) => unknown }

// Medusa v2 registers fulfillment providers on the fulfillment module's
// internal container, NOT the root container (see
// @medusajs/fulfillment/dist/loaders/providers.js + load-internal.js). The
// module service exposes that container as `__container__`, and Medusa's own
// FulfillmentProviderService.retrieveProviderRegistration reads providers via
// bracket property access (`this.__container__["fp_" + id]`) - never
// .resolve(), because the internal container is a cradle proxy where
// .resolve() itself is treated as a registration key. Root-container .resolve()
// still works for tests and installs that register the provider on the root.
export function resolveIthinkProvider<T = unknown>(container: ContainerLike): T | undefined {
  for (const key of ITHINK_PROVIDER_KEYS) {
    try {
      const provider = container.resolve(key) as T | undefined
      if (provider) {
        return provider
      }
    } catch {
      // fall through to the next candidate key
    }
  }
  try {
    const moduleService = container.resolve(Modules.FULFILLMENT) as {
      __container__?: Record<string, unknown>
    }
    const internalContainer = moduleService.__container__
    if (internalContainer) {
      for (const key of ITHINK_PROVIDER_KEYS) {
        try {
          const provider = internalContainer[key] as T | undefined
          if (provider) {
            return provider
          }
        } catch {
          // fall through to the next candidate key
        }
      }
    }
  } catch {
    // no fulfillment module service in scope
  }
  return undefined
}

export const TRACKING_META_KEY = "ithink_tracking"
export const TRACK_CHUNK_SIZE = 10
export const TRACKING_WINDOW_MS = 30 * 60 * 1000

export type IthinkTrackingSnapshot = {
  awb_no: string
  logistic?: string
  latest_courier_status?: string
  expected_delivery_date?: string
  tracked_at: string
}

export type FulfillmentStore = {
  updateFulfillment: (id: string, input: Record<string, unknown>) => Promise<unknown>
}

export type FulfillmentEventBus = {
  emit: (event: { name: string; data: Record<string, unknown> }) => Promise<unknown>
}

export type JobLogger = Pick<Logger, "info" | "warn" | "error">

export type DiscoveryResult = {
  total: number
  updated: number
  pending: number
  failed: number
}

export function providerFromContainer(
  container: ContainerLike
): { getOptions: () => IthinkProviderOptions } | undefined {
  const provider = resolveIthinkProvider<{ getOptions?: () => IthinkProviderOptions }>(container)
  if (provider && typeof provider.getOptions === "function") {
    return { getOptions: provider.getOptions }
  }
  return undefined
}

// The iThink get_awb endpoint only accepts a rolling window of at most 30
// minutes, so the job must not poll faster than that window. Datetimes use the
// yyyy-mm-dd H:i:s format iThink requires.
export function trackingWindow(now: Date): GetAwbParams {
  const start = new Date(now.getTime() - TRACKING_WINDOW_MS)
  return {
    startDateTime: toIthinkDateTime(start),
    endDateTime: toIthinkDateTime(now),
  }
}

export function storedSnapshot(
  metadata: FulfillmentDTO["metadata"]
): IthinkTrackingSnapshot | undefined {
  const snapshot = metadata?.[TRACKING_META_KEY]
  if (typeof snapshot !== "object" || snapshot === null) {
    return undefined
  }
  return snapshot as IthinkTrackingSnapshot
}

export function snapshotsEqual(
  previous: IthinkTrackingSnapshot | undefined,
  next: IthinkTrackingSnapshot
): boolean {
  if (!previous) {
    return false
  }
  return (
    previous.awb_no === next.awb_no &&
    previous.logistic === next.logistic &&
    previous.latest_courier_status === next.latest_courier_status &&
    previous.expected_delivery_date === next.expected_delivery_date
  )
}

// Timestamps are write-once: shipped_at when the first non-pending active
// status appears, delivered_at when the status is Delivered (DL). Terminal
// statuses (CN/Lost/Shortage/RTO) never write timestamps.
export function statusTimestampInput(
  fulfillment: Pick<FulfillmentDTO, "shipped_at" | "delivered_at">,
  status: { status?: string; statusCode?: string }
): Record<string, Date> {
  const input: Record<string, Date> = {}
  if (!fulfillment.shipped_at && isActive(status)) {
    input.shipped_at = new Date()
  }
  if (!fulfillment.delivered_at && isDelivered(status)) {
    input.delivered_at = new Date()
  }
  return input
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function emitUpdated(
  id: string,
  events: FulfillmentEventBus,
  logger: JobLogger
): Promise<void> {
  try {
    await events.emit({
      name: FulfillmentEvents.FULFILLMENT_UPDATED,
      data: { id },
    })
    logger.info(
      `iThink tracking poll: emitted ${FulfillmentEvents.FULFILLMENT_UPDATED} for fulfillment ${id}`
    )
  } catch (error) {
    logger.warn(
      `iThink tracking poll: event emission failed for fulfillment ${id}: ${errorMessage(error)}`
    )
  }
}

// Path A: fulfillments synced to the dashboard but not yet booked have no
// AWB. Look them up by order_no via get_details (the client chunks at 500
// internally) and persist the AWB/carrier/status when iThink reports one.
export async function discoverAwbsFromOrderNos(params: {
  client: { getOrderDetails: (orderNos: string[]) => Promise<OrderDetails[]> }
  fulfillments: FulfillmentDTO[]
  store: FulfillmentStore
  events: FulfillmentEventBus
  logger: JobLogger
}): Promise<DiscoveryResult> {
  const { client, fulfillments, store, events, logger } = params
  if (fulfillments.length === 0) {
    return { total: 0, updated: 0, pending: 0, failed: 0 }
  }
  const result: DiscoveryResult = {
    total: fulfillments.length,
    updated: 0,
    pending: 0,
    failed: 0,
  }

  const orderNos = [
    ...new Set(
      fulfillments
        .map((fulfillment) => stringValue(fulfillment.data?.order_no))
        .filter((orderNo): orderNo is string => Boolean(orderNo))
    ),
  ]

  let detailsByOrderNo = new Map<string, OrderDetails>()
  if (orderNos.length > 0) {
    try {
      const details = await client.getOrderDetails(orderNos)
      detailsByOrderNo = new Map(
        details
          .filter((entry) => typeof entry.order_no === "string")
          .map((entry) => [entry.order_no as string, entry])
      )
    } catch (error) {
      result.failed += 1
      logger.error(
        `iThink tracking poll: getOrderDetails failed for ${orderNos.length} order(s): ${errorMessage(error)}`
      )
    }
  }

  for (const fulfillment of fulfillments) {
    const orderNo = stringValue(fulfillment.data?.order_no)
    const details = orderNo ? detailsByOrderNo.get(orderNo) : undefined
    if (!details || !details.awb_no) {
      result.pending += 1
      logger.info(
        `iThink tracking poll: fulfillment ${fulfillment.id} still pending (no AWB for ${orderNo ?? "missing order_no"})`
      )
      continue
    }
    try {
      await applyDiscoveredAwb({ fulfillment, details, store, events, logger })
      result.updated += 1
    } catch (error) {
      result.failed += 1
      logger.error(
        `iThink tracking poll: update failed for fulfillment ${fulfillment.id}: ${errorMessage(error)}`
      )
    }
  }
  return result
}

async function applyDiscoveredAwb(params: {
  fulfillment: FulfillmentDTO
  details: OrderDetails
  store: FulfillmentStore
  events: FulfillmentEventBus
  logger: JobLogger
}): Promise<void> {
  const { fulfillment, details, store, events, logger } = params
  const nextData: Record<string, unknown> = { ...(fulfillment.data ?? {}) }
  if (details.awb_no) {
    nextData.awb = details.awb_no
  }
  if (details.logistic) {
    nextData.logistic = details.logistic
  }
  if (details.latest_courier_status) {
    nextData.latest_courier_status = details.latest_courier_status
  }
  if (details.expected_delivery_date) {
    nextData.expected_delivery_date = details.expected_delivery_date
  }
  const timestamps = statusTimestampInput(fulfillment, {
    status: details.latest_courier_status,
  })
  await store.updateFulfillment(fulfillment.id, { data: nextData, ...timestamps })
  await emitUpdated(fulfillment.id, events, logger)
}
