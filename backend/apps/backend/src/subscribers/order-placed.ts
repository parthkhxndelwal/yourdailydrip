import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Query } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import type { createOrderFulfillmentWorkflow } from "@medusajs/core-flows"
import { PREORDER_MODULE } from "../modules/preorder"
import { PreorderVariantStatus } from "../modules/preorder/models/preorder-variant"

// Medusa v2 fulfillment providers are registered in the container under
// `fp_<identifier>_<id>` (see @medusajs/fulfillment/dist/loaders/providers.js).
// The ithink provider's static identifier is "ithink" and medusa-config.ts
// registers it with id "ithink", so the key is "fp_ithink_ithink" (same shape
// as the manual provider's "fp_manual_manual"). "fp_ithink" is a fallback for
// installs that omit the provider id.
const ITHINK_PROVIDER_KEYS = ["fp_ithink_ithink", "fp_ithink"] as const

type IthinkModeProvider = { getMode: () => "dashboard" | "book" }

type OrderFulfillmentContext = {
  payment_collections?: { status: string }[]
  fulfillments?: { id: string }[]
  items?: { id: string; quantity: number; variant_id?: string }[]
}

function resolveIthinkMode(
  container: { resolve: (key: string) => unknown },
  logger: Logger
): "dashboard" | "book" | undefined {
  for (const key of ITHINK_PROVIDER_KEYS) {
    try {
      const provider = container.resolve(key) as IthinkModeProvider | undefined
      if (provider) {
        return provider.getMode()
      }
    } catch {
      // fall through to the next candidate key
    }
  }
  logger.warn(
    `iThink fulfillment provider not resolvable via ${ITHINK_PROVIDER_KEYS.join(", ")}; keeping auto-submit`
  )
  return undefined
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
    fields: [
      "payment_collections.status",
      "fulfillments.id",
      "items.id",
      "items.quantity",
      "items.variant_id",
    ],
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

  const variantIds = order.items
    .map((item) => item.variant_id)
    .filter((id): id is string => Boolean(id))
  if (variantIds.length > 0) {
    const preorderModule = container.resolve(PREORDER_MODULE)
    const preorderVariants = await preorderModule.listPreorderVariants({
      variant_id: variantIds,
      status: PreorderVariantStatus.ENABLED,
    })
    if (preorderVariants.length > 0) {
      logger.info(`Skipping iThink registration for pre-order order ${data.id}`)
      return
    }
  }

  const mode = resolveIthinkMode(container, logger)
  if (mode === "dashboard") {
    logger.info("auto-submit disabled in dashboard mode; create fulfillment in admin to sync")
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
