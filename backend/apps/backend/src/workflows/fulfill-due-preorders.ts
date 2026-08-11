import { createOrderFulfillmentWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { PREORDER_MODULE } from "../modules/preorder"
import { PreorderStatus } from "../modules/preorder/models/preorder"

type FulfillDuePreordersStepInput = {
  variants: { id: string; variant_id: string }[]
  preorders: { id: string; order_id: string; item_id: string }[]
  orders: {
    id: string
    fulfillments: ({ id: string } | null)[] | null
    payment_collections: ({ status: string } | null)[] | null
    items: ({ id: string; variant_id: string | null; quantity: number } | null)[] | null
  }[]
}

export type FulfillDuePreordersSummary = {
  fulfilled: string[]
  skipped: string[]
  failed: { order_id: string; message: string }[]
}

// Runs the shared fulfillment logic at execution time. Pending pre-orders are
// grouped by order; orders that already have a fulfillment are skipped, each
// remaining order is fulfilled through createOrderFulfillmentWorkflow, and on
// success its pre-order records flip to fulfilled. A single order's failure is
// logged and collected, never raised, so the rest of the run continues and the
// failed records stay pending for the next run.
const fulfillDuePreordersStep = createStep(
  "fulfill-due-preorders",
  async (input: FulfillDuePreordersStepInput, { container }) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
    const preorderModule = container.resolve(PREORDER_MODULE)

    const variantIdByPreorderVariantId = new Map(
      input.variants.map((variant) => [variant.id, variant.variant_id])
    )

    const preordersByOrderId = new Map<string, { id: string; item_id: string }[]>()
    for (const preorder of input.preorders) {
      const group = preordersByOrderId.get(preorder.order_id) ?? []
      group.push(preorder)
      preordersByOrderId.set(preorder.order_id, group)
    }

    const summary: FulfillDuePreordersSummary = {
      fulfilled: [],
      skipped: [],
      failed: [],
    }

    for (const order of input.orders) {
      const orderPreorders = preordersByOrderId.get(order.id) ?? []
      if (orderPreorders.length === 0) {
        continue
      }

      if ((order.fulfillments ?? []).length > 0) {
        summary.skipped.push(order.id)
        logger.info(
          `preorder-fulfillment: order ${order.id} already has a fulfillment, skipping`
        )
        continue
      }

      // This build's PaymentCollectionStatus has no CAPTURED value; a fully
      // captured payment collection is COMPLETED ("completed").
      const paymentCaptured = (order.payment_collections ?? []).some(
        (collection) => collection !== null && collection.status === "completed"
      )
      if (!paymentCaptured) {
        logger.info(
          `preorder-fulfillment: order ${order.id} payment not captured, deferring`
        )
        continue
      }

      const wantedVariantIds = new Set(
        orderPreorders
          .map((preorder) => variantIdByPreorderVariantId.get(preorder.item_id))
          .filter((variantId): variantId is string => Boolean(variantId))
      )
      const items = (order.items ?? [])
        .filter(
          (item): item is { id: string; variant_id: string; quantity: number } => {
            return (
              item !== null &&
              item.variant_id !== null &&
              wantedVariantIds.has(item.variant_id)
            )
          }
        )
        .map((item) => ({ id: item.id, quantity: item.quantity }))

      if (items.length === 0) {
        const message = "no matching order items for the pending pre-orders"
        summary.failed.push({ order_id: order.id, message })
        logger.error(`preorder-fulfillment: order ${order.id} failed: ${message}`)
        continue
      }

      try {
        await createOrderFulfillmentWorkflow(container).run({
          input: { order_id: order.id, items },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        summary.failed.push({ order_id: order.id, message })
        logger.error(`preorder-fulfillment: order ${order.id} failed: ${message}`)
        continue
      }

      await preorderModule.updatePreorders({
        selector: { order_id: order.id },
        data: { status: PreorderStatus.FULFILLED },
      })
      summary.fulfilled.push(order.id)
      logger.info(`preorder-fulfillment: order ${order.id} fulfilled`)
    }

    return new StepResponse(summary)
  }
)

export const fulfillDuePreordersWorkflow = createWorkflow(
  "fulfill-due-preorders",
  function () {
    const dueNow = transform({}, () => new Date())

    const dueVariants = useQueryGraphStep({
      entity: "preorder_variant",
      fields: ["id", "variant_id"],
      filters: { status: "enabled", available_date: { $lte: dueNow } },
    })

    const dueVariantIds = transform({ dueVariants }, ({ dueVariants }) => {
      const ids = dueVariants.data.map((variant) => variant.id)
      return ids.length > 0 ? ids : [""]
    })

    const pendingPreorders = useQueryGraphStep({
      entity: "preorder",
      fields: ["id", "order_id", "item_id"],
      filters: { item_id: dueVariantIds, status: "pending" },
    }).config({ name: "query-pending-preorders" })

    const orderIds = transform({ pendingPreorders }, ({ pendingPreorders }) => {
      const ids = [
        ...new Set(pendingPreorders.data.map((preorder) => preorder.order_id)),
      ]
      return ids.length > 0 ? ids : [""]
    })

    const orders = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "fulfillments.id",
        "payment_collections.status",
        "items.id",
        "items.variant_id",
        "items.quantity",
      ],
      filters: { id: orderIds },
    }).config({ name: "query-preorder-orders" })

    const summary = fulfillDuePreordersStep({
      variants: dueVariants.data,
      preorders: pendingPreorders.data,
      orders: orders.data,
    })

    return new WorkflowResponse(summary)
  }
)