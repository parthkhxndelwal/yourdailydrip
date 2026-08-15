import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Query } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

type ShipmentNotificationContext = {
  email?: string
  display_id?: string | null
}

type ShipmentFulfillment = {
  data?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  order_id?: string
}

type FulfillmentModuleLike = {
  retrieveFulfillment: (id: string) => Promise<ShipmentFulfillment>
  updateFulfillments: (input: {
    selector: { id: string }
    data: { metadata: Record<string, unknown> }
  }) => Promise<unknown>
}

export default async function shipmentNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id?: string
  fulfillment_id?: string
  id?: string
  no_notification?: boolean
}>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve<Query>(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = container.resolve<FulfillmentModuleLike>(Modules.FULFILLMENT)
  const notificationModule = container.resolve(Modules.NOTIFICATION)

  if (data.no_notification) {
    logger.info("Skipping shipment email: no_notification set")
    return
  }

  const fulfillmentId = data.fulfillment_id ?? data.id
  if (!fulfillmentId) {
    logger.warn("Skipping shipment email: no fulfillment id in event data")
    return
  }

  let fulfillment: ShipmentFulfillment
  try {
    fulfillment = await fulfillmentModule.retrieveFulfillment(fulfillmentId)
  } catch (error) {
    logger.error(
      `Failed to fetch fulfillment ${fulfillmentId}: ${(error as Error).message}`
    )
    return
  }

  const orderId = data.order_id ?? fulfillment.order_id
  if (!orderId) {
    logger.warn(`Skipping shipment email for fulfillment ${fulfillmentId}: no order id`)
    return
  }

  const rawAwb = fulfillment.data?.awb ?? fulfillment.metadata?.awb
  const awb = typeof rawAwb === "string" ? rawAwb : undefined
  if (!awb) {
    logger.info(
      `No AWB found on fulfillment ${fulfillmentId}; skipping shipment email for order ${orderId}`
    )
    return
  }

  if (fulfillment.metadata?.shipped_email_sent === true) {
    logger.info(
      `Shipment email already sent for fulfillment ${fulfillmentId}; skipping`
    )
    return
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["email", "display_id"],
    filters: { id: orderId },
  })
  const order = orders[0] as ShipmentNotificationContext | undefined
  if (!order) {
    logger.warn(`Skipping shipment email for order ${orderId}: order not found`)
    return
  }
  if (!order.email) {
    logger.warn(`Skipping shipment email for order ${orderId}: no email`)
    return
  }

  try {
    await notificationModule.createNotifications({
      to: order.email ?? "",
      channel: "email",
      template: "order_shipped",
      data: {
        display_id: order.display_id,
        awb,
        track_url: `${process.env.STOREFRONT_BASE_URL ?? ""}/track-order?awb=${awb}`,
      },
      trigger_type: "order.fulfillment_created",
      resource_id: orderId,
    })
  } catch (error) {
    logger.error(
      `Failed to send shipment email for order ${orderId}: ${(error as Error).message}`
    )
    return
  }

  try {
    await fulfillmentModule.updateFulfillments({
      selector: { id: fulfillmentId },
      data: {
        metadata: {
          ...(fulfillment.metadata ?? {}),
          shipped_email_sent: true,
        },
      },
    })
  } catch (error) {
    logger.error(
      `Failed to mark shipment email sent for fulfillment ${fulfillmentId}: ${(error as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["order.fulfillment_created", "fulfillment.updated"],
}