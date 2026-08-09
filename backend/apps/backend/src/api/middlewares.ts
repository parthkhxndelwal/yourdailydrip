import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

export const AdminPostVariantPreorderSchema = z.object({
  available_date: z.string().refine((value) => {
    return Number.isFinite(Date.parse(value))
  }, "available_date must be a valid ISO date string"),
})

export type AdminPostVariantPreorderBody = z.infer<typeof AdminPostVariantPreorderSchema>

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/variants/:id/preorders",
      method: "POST",
      middlewares: [
        validateAndTransformBody(AdminPostVariantPreorderSchema),
      ],
    },
  ],
})