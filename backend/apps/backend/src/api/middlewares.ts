import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { Query } from "@medusajs/framework"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

export const AdminPostVariantPreorderSchema = z.object({
  available_date: z.string().refine((value) => {
    return Number.isFinite(Date.parse(value))
  }, "available_date must be a valid ISO date string"),
})

export type AdminPostVariantPreorderBody = z.infer<typeof AdminPostVariantPreorderSchema>

const MIXED_CART_ERROR_MESSAGE =
  "You can't mix pre-order and in-stock items in one cart. Please place them as separate orders."

type PreorderVariantRow = { variant_id: string }

type CartLineItem = { variant_id: string | null }

export async function blockMixedPreorderCart(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const variantId = (req.body as { variant_id?: unknown } | undefined)?.variant_id
  if (typeof variantId !== "string") {
    next()
    return
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as Query

    const { data: incomingPreorders } = await query.graph({
      entity: "preorder_variant",
      fields: ["variant_id"],
      filters: { variant_id: variantId, status: "enabled" },
    })
    const incomingIsPreorder = incomingPreorders.length > 0

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["items.variant_id"],
      filters: { id: req.params.id },
    })
    const cart = carts[0] as { items?: CartLineItem[] } | undefined
    const existingVariantIds = (cart?.items ?? [])
      .map((item) => item.variant_id)
      .filter((itemVariantId): itemVariantId is string => Boolean(itemVariantId))
    const existingIds = [...new Set(existingVariantIds)]

    if (existingIds.length === 0) {
      next()
      return
    }

    const { data: existingRows } = await query.graph({
      entity: "preorder_variant",
      fields: ["variant_id"],
      filters: { variant_id: existingIds, status: "enabled" },
    })
    const existingPreorderIds = new Set(
      (existingRows as PreorderVariantRow[]).map((row) => row.variant_id)
    )

    const existingHasPreorder = existingIds.some((id) => existingPreorderIds.has(id))
    const existingHasNormal = existingIds.some((id) => !existingPreorderIds.has(id))

    if (
      (incomingIsPreorder && existingHasNormal) ||
      (!incomingIsPreorder && existingHasPreorder)
    ) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, MIXED_CART_ERROR_MESSAGE)
    }

    next()
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error
    }
    // Fail open: this guard is a business rule, not an availability gate -
    // infrastructure errors here must never 500 add-to-cart.
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.warn(`blockMixedPreorderCart skipped: ${(error as Error).message}`)
    next()
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/variants/:id/preorders",
      method: "POST",
      middlewares: [
        validateAndTransformBody(AdminPostVariantPreorderSchema),
      ],
    },
    {
      matcher: "/store/carts/:id/line-items",
      method: "POST",
      middlewares: [blockMixedPreorderCart],
    },
  ],
})