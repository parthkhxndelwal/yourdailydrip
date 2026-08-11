import type { ScheduledJobContext } from "@medusajs/framework/jobs"
import type { FulfillmentDTO, Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IthinkClient } from "../modules/ithink/clients/ithink-client"
import { toClientOptions } from "../modules/ithink/services/mappers"
import {
  discoverAwbsFromOrderNos,
  errorMessage,
  providerFromContainer,
  trackingWindow,
} from "../modules/ithink/services/reconciliation"
import { enrichAwbsInWindow } from "../modules/ithink/services/shipment-enrichment"

// Reconciles Medusa fulfillments with the iThink dashboard every 30 minutes:
// - No-AWB fulfillments (dashboard mode, synced but unbooked) are looked up by
//   order_no via get_details so Medusa learns the AWB once ops books it.
// - AWB fulfillments are delta-polled via get_awb (30-minute window) and
//   enriched via track.json.
// The iThink get_awb endpoint only accepts a rolling 30-minute window, so the
// schedule must not poll faster than that: */30 * * * * gives each run a
// non-overlapping window of its own. Assumes a single scheduler replica;
// multiple replicas poll redundantly (writes stay idempotent).
export const config = {
  name: "ithink-tracking-poll",
  schedule: "*/30 * * * *",
}

const FULFILLMENT_PAGE_SIZE = 20

type FulfillmentModule = {
  listFulfillments: (
    filters: Record<string, unknown>,
    options: { take: number; skip: number }
  ) => Promise<FulfillmentDTO[]>
  updateFulfillment: (id: string, input: Record<string, unknown>) => Promise<unknown>
}

// Every page, client call, and per-fulfillment update is isolated so one
// failure cannot abort the run; failures are counted and summarized at the end.
export default async function ithinkTrackingPoll(
  container: MedusaContainer,
  _context?: ScheduledJobContext
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)

  const provider = providerFromContainer(container)
  if (!provider) {
    logger.warn(
      "iThink tracking poll skipped: ithink fulfillment provider not resolvable (fp_ithink_ithink / fp_ithink)"
    )
    return
  }
  const options = provider.getOptions()
  if (options.poll_enabled === false) {
    logger.info("iThink tracking poll disabled (poll_enabled=false)")
    return
  }

  const client = new IthinkClient(toClientOptions(options))
  const fulfillmentModule = container.resolve<FulfillmentModule>(Modules.FULFILLMENT)
  const eventBus = container.resolve(Modules.EVENT_BUS)
  const store = {
    updateFulfillment: (id: string, input: Record<string, unknown>) =>
      fulfillmentModule.updateFulfillment(id, input),
  }
  const events = {
    emit: (event: { name: string; data: Record<string, unknown> }) => eventBus.emit(event),
  }

  const { fulfillments, failedPages } = await listIthinkFulfillments(fulfillmentModule, logger)

  const noAwb = fulfillments.filter((fulfillment) => typeof fulfillment.data?.awb !== "string")
  const hasAwb = fulfillments.filter((fulfillment) => typeof fulfillment.data?.awb === "string")

  const discovery = await discoverAwbsFromOrderNos({
    client,
    fulfillments: noAwb,
    store,
    events,
    logger,
  })
  const enrichment = await enrichAwbsInWindow({
    client,
    fulfillments: hasAwb,
    window: trackingWindow(new Date()),
    store,
    events,
    logger,
  })

  const total = discovery.total + enrichment.total
  const failed = discovery.failed + enrichment.failed + failedPages
  const updated = discovery.updated + enrichment.updated
  logger.info(
    `iThink tracking poll: reconciled ${total} fulfillment(s) (${updated} updated, ${discovery.pending} pending, ${enrichment.terminal} terminal), ${failed} failed`
  )
}

async function listIthinkFulfillments(
  fulfillmentModule: FulfillmentModule,
  logger: Logger
): Promise<{ fulfillments: FulfillmentDTO[]; failedPages: number }> {
  const fulfillments: FulfillmentDTO[] = []
  let failedPages = 0
  let skip = 0
  while (true) {
    let page: FulfillmentDTO[]
    try {
      page = await fulfillmentModule.listFulfillments(
        { provider_id: "ithink" },
        { take: FULFILLMENT_PAGE_SIZE, skip }
      )
    } catch (error) {
      failedPages += 1
      logger.error(
        `iThink tracking poll: listFulfillments page at offset ${skip} failed: ${errorMessage(error)}`
      )
      break
    }
    for (const fulfillment of page) {
      if (fulfillment.canceled_at) {
        continue
      }
      const data = fulfillment.data
      if (data?.provider === "ithink" || typeof data?.awb === "string") {
        fulfillments.push(fulfillment)
      }
    }
    if (page.length < FULFILLMENT_PAGE_SIZE) {
      break
    }
    skip += FULFILLMENT_PAGE_SIZE
  }
  return { fulfillments, failedPages }
}
