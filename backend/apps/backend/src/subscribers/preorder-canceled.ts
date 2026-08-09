import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Query } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PREORDER_MODULE } from "../modules/preorder"
import { PreorderStatus } from "../modules/preorder/models/preorder"

type PreorderCanceledContext = {
  email?: string
  display_id?: string | null
}

export default async function preorderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve<Query>(ContainerRegistrationKeys.QUERY)
  const preorderModule = container.resolve(PREORDER_MODULE)
  const notificationModule = container.resolve(Modules.NOTIFICATION)

  const preorders = await preorderModule.listPreorders({ order_id: data.id })
  if (preorders.length === 0) {
    return
  }

  await preorderModule.updatePreorders({
    selector: { order_id: data.id },
    data: { status: PreorderStatus.CANCELLED },
  })

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["email", "display_id"],
    filters: { id: data.id },
  })
  const order = orders[0] as PreorderCanceledContext | undefined
  if (!order) {
    logger.warn(`Skipping preorder refund email for order ${data.id}: order not found`)
    return
  }

  try {
    await notificationModule.createNotifications({
      to: order.email ?? "",
      channel: "email",
      template: "preorder_refund",
      data: {
        order_id: data.id,
        display_id: order.display_id,
      },
      trigger_type: "order.canceled",
      resource_id: data.id,
    })
  } catch (error) {
    logger.error(
      `Failed to send preorder refund email for order ${data.id}: ${(error as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}