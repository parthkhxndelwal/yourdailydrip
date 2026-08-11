import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import type { ScheduledJobContext } from "@medusajs/framework/jobs"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { fulfillDuePreordersWorkflow } from "../workflows/fulfill-due-preorders"

export const config = {
  name: "preorder-fulfillment",
  schedule: "0 */6 * * *",
}

// Fulfills due pre-orders every 6 hours through the shared workflow. All
// business logic lives in fulfillDuePreordersWorkflow; this job only runs it
// and reports per-order results. Failures are recorded in the summary and the
// records stay pending, so the next run retries them.
export default async function preorderFulfillmentJob(
  container: MedusaContainer,
  _context?: ScheduledJobContext
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)

  logger.info("preorder-fulfillment job started")

  try {
    const { result } = await fulfillDuePreordersWorkflow(container).run({})

    for (const orderId of result.fulfilled) {
      logger.info(`preorder-fulfillment: order ${orderId} fulfilled`)
    }
    for (const orderId of result.skipped) {
      logger.info(`preorder-fulfillment: order ${orderId} skipped (already fulfilled)`)
    }
    for (const failure of result.failed) {
      logger.error(
        `preorder-fulfillment: order ${failure.order_id} failed: ${failure.message}`
      )
    }
    logger.info(
      `preorder-fulfillment job completed: ${result.fulfilled.length} fulfilled, ` +
        `${result.skipped.length} skipped, ${result.failed.length} failed`
    )
  } catch (error) {
    logger.error(
      `preorder-fulfillment job failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}