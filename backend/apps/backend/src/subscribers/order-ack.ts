import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Query } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PREORDER_MODULE } from "../modules/preorder"
import { formatInr } from "../modules/resend/layout"

type OrderAckContext = {
  email?: string
  display_id?: string | null
  total: number
  items?: {
    id: string
    variant_id?: string
    title?: string
    thumbnail?: string | null
    unit_price?: number
    quantity: number
  }[]
}

export default async function orderAckHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve<Query>(ContainerRegistrationKeys.QUERY)
  const preorderModule = container.resolve(PREORDER_MODULE)
  const notificationModule = container.resolve(Modules.NOTIFICATION)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "email",
      "display_id",
      "total",
      "items.id",
      "items.variant_id",
      "items.title",
      "items.thumbnail",
      "items.unit_price",
      "items.quantity",
    ],
    filters: { id: data.id },
  })
  const order = orders[0] as OrderAckContext | undefined
  if (!order) {
    logger.warn(`Skipping order ack email for order ${data.id}: order not found`)
    return
  }

  const variantIds = (order.items ?? [])
    .map((item) => item.variant_id)
    .filter((id): id is string => Boolean(id))
  if (variantIds.length === 0) {
    return
  }

  // Check the VARIANT source, not preorder rows: order.placed subscribers run
  // concurrently and preorder-created.ts creates the rows. If any item is an
  // enabled preorder variant, preorder-created.ts sends preorder_ack instead.
  const preorderVariants = await preorderModule.listPreorderVariants({
    variant_id: variantIds,
    status: "enabled",
  })
  if (preorderVariants.length > 0) {
    return
  }

  if (!order.email) {
    logger.warn(`Skipping order ack email for order ${data.id}: no email`)
    return
  }

  try {
    await notificationModule.createNotifications({
      to: order.email ?? "",
      channel: "email",
      template: "order_ack",
      data: {
        display_id: order.display_id,
        total: formatInr(order.total),
        items: (order.items ?? []).map((item) => ({
          title: item.title ?? "Item",
          quantity: item.quantity,
          thumbnail: item.thumbnail ?? undefined,
          unit_price:
            typeof item.unit_price === "number" ? formatInr(item.unit_price) : undefined,
        })),
        order_url: `${process.env.STOREFRONT_BASE_URL ?? ""}/order-confirmation?order=${data.id}`,
      },
      trigger_type: "order.placed",
      resource_id: data.id,
    })
  } catch (error) {
    logger.error(
      `Failed to send order ack email for order ${data.id}: ${(error as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}