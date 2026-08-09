import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Query } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PREORDER_MODULE } from "../modules/preorder"

type PreorderShippedContext = {
  email?: string
  display_id?: string | null
}

export default async function preorderShippedHandler({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id: string
  fulfillment_id: string
  no_notification?: boolean
}>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve<Query>(ContainerRegistrationKeys.QUERY)
  const preorderModule = container.resolve(PREORDER_MODULE)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const notificationModule = container.resolve(Modules.NOTIFICATION)

  if (data.no_notification) {
    logger.info(
      `Skipping preorder shipping email for order ${data.order_id}: no_notification set`
    )
    return
  }

  const preorders = await preorderModule.listPreorders({ order_id: data.order_id })
  if (preorders.length === 0) {
    return
  }

  let awb: string | undefined
  try {
    const fulfillment = await fulfillmentModule.retrieveFulfillment(data.fulfillment_id)
    const fulfillmentData = (fulfillment?.data ?? {}) as Record<string, unknown>
    const metadata = (fulfillment?.metadata ?? {}) as Record<string, unknown>
    const rawAwb = fulfillmentData.awb ?? metadata.awb
    awb = typeof rawAwb === "string" ? rawAwb : undefined
  } catch (error) {
    logger.error(
      `Failed to fetch fulfillment ${data.fulfillment_id} for order ${data.order_id}: ${(error as Error).message}`
    )
    return
  }
  if (!awb) {
    logger.warn(
      `No AWB found on fulfillment ${data.fulfillment_id}; skipping preorder shipping email for order ${data.order_id}`
    )
    return
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["email", "display_id"],
    filters: { id: data.order_id },
  })
  const order = orders[0] as PreorderShippedContext | undefined
  if (!order) {
    logger.warn(`Skipping preorder shipping email for order ${data.order_id}: order not found`)
    return
  }

  try {
    await notificationModule.createNotifications({
      to: order.email ?? "",
      channel: "email",
      template: "preorder_shipped",
      data: {
        order_id: data.order_id,
        display_id: order.display_id,
        awb,
        track_url: `${process.env.STOREFRONT_BASE_URL ?? ""}/track-order?awb=${awb}`,
      },
      trigger_type: "order.fulfillment_created",
      resource_id: data.order_id,
    })
  } catch (error) {
    logger.error(
      `Failed to send preorder shipping email for order ${data.order_id}: ${(error as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
}