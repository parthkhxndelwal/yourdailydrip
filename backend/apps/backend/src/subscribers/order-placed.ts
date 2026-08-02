import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Query } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import type { createOrderFulfillmentWorkflow } from "@medusajs/core-flows"

type OrderFulfillmentContext = {
  payment_collections?: { status: string }[]
  fulfillments?: { id: string }[]
  items?: { id: string; quantity: number }[]
}

export default async function registerOrderWithIthinkHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>("logger")
  const query = container.resolve<Query>("query")
  const workflow = container.resolve<typeof createOrderFulfillmentWorkflow>(
    "createOrderFulfillmentWorkflow"
  )

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["payment_collections.status", "fulfillments.id", "items.id", "items.quantity"],
    filters: { id: data.id },
  })
  const order = orders[0] as OrderFulfillmentContext | undefined
  if (!order) {
    logger.warn(`Skipping iThink registration for order ${data.id}: order not found`)
    return
  }
  const paymentCaptured = (order.payment_collections ?? []).some(
    (collection) => collection.status === "captured"
  )
  if (!paymentCaptured) {
    const statuses =
      order.payment_collections?.map((collection) => collection.status).join(", ") || "none"
    logger.warn(
      `Skipping iThink registration for order ${data.id}: payment not captured (statuses: ${statuses})`
    )
    return
  }
  if (order.fulfillments && order.fulfillments.length > 0) {
    logger.info(`Skipping iThink registration for order ${data.id}: fulfillment already exists`)
    return
  }
  if (!order.items || order.items.length === 0) {
    logger.warn(`Skipping iThink registration for order ${data.id}: order has no items`)
    return
  }

  await workflow(container).run({
    input: {
      order_id: data.id,
      items: order.items.map((item) => ({ id: item.id, quantity: item.quantity })),
    },
  })
  logger.info(`iThink shipment registered for order ${data.id}`)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
