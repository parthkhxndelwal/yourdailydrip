import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Query } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PREORDER_MODULE } from "../modules/preorder"
import { PreorderStatus } from "../modules/preorder/models/preorder"

type PreorderVariantRow = {
  id: string
  variant_id?: string
  available_date?: Date | string | null
}

type PreorderCreatedContext = {
  email?: string
  display_id?: string | null
  metadata?: Record<string, unknown> | null
  items?: { id: string; variant_id?: string; title?: string; quantity: number }[]
}

export default async function preorderCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve<Query>(ContainerRegistrationKeys.QUERY)
  const preorderModule = container.resolve(PREORDER_MODULE)
  const orderModule = container.resolve(Modules.ORDER)
  const notificationModule = container.resolve(Modules.NOTIFICATION)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "email",
      "display_id",
      "metadata",
      "items.id",
      "items.variant_id",
      "items.title",
      "items.quantity",
    ],
    filters: { id: data.id },
  })
  const order = orders[0] as PreorderCreatedContext | undefined
  if (!order) {
    logger.warn(`Skipping preorder processing for order ${data.id}: order not found`)
    return
  }

  const variantIds = (order.items ?? [])
    .map((item) => item.variant_id)
    .filter((id): id is string => Boolean(id))
  if (variantIds.length === 0) {
    return
  }

  const preorderVariants = await preorderModule.listPreorderVariants({
    variant_id: variantIds,
    status: "enabled",
  })
  if (preorderVariants.length === 0) {
    return
  }

  const availableDates = preorderVariants
    .map((variant: PreorderVariantRow) => variant.available_date)
    .filter((date): date is Date => date instanceof Date)
  if (availableDates.length === 0) {
    logger.warn(
      `Skipping preorder processing for order ${data.id}: preorder variants have no available dates`
    )
    return
  }
  const expectedShipDate = new Date(
    Math.min(...availableDates.map((date) => date.getTime()))
  ).toISOString()

  const variantById = new Map<string, PreorderVariantRow>(
    preorderVariants.map((variant: PreorderVariantRow) => [variant.variant_id ?? "", variant])
  )
  const preorderLines = (order.items ?? []).flatMap((item) => {
    const variant = variantById.get(item.variant_id ?? "")
    return variant === undefined
      ? []
      : [{ variant, title: item.title, quantity: item.quantity }]
  })

  if (preorderLines.length === 0) {
    return
  }

  await preorderModule.createPreorders(
    preorderLines.map((line) => ({
      order_id: data.id,
      item_id: line.variant.id,
      status: PreorderStatus.PENDING,
    }))
  )

  await orderModule.updateOrders(
    { id: data.id },
    {
      metadata: {
        ...(order.metadata ?? {}),
        preorder_expected_ship_date: expectedShipDate,
      },
    }
  )

  try {
    await notificationModule.createNotifications({
      to: order.email ?? "",
      channel: "email",
      template: "preorder_ack",
      data: {
        order_id: data.id,
        display_id: order.display_id,
        expected_ship_date: expectedShipDate,
        items: preorderLines.map((line) => ({
          title: line.title ?? "Item",
          quantity: line.quantity,
        })),
      },
      trigger_type: "order.placed",
      resource_id: data.id,
    })
  } catch (error) {
    logger.error(
      `Failed to send preorder ack email for order ${data.id}: ${(error as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
