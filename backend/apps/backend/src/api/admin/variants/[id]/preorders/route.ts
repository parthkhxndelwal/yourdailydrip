import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  disablePreorderVariantWorkflow,
} from "../../../../../workflows/disable-preorder-variant"
import {
  upsertProductVariantPreorderWorkflow,
} from "../../../../../workflows/upsert-product-variant-preorder"
import { AdminPostVariantPreorderBody } from "../../../../middlewares"

export async function POST(
  req: MedusaRequest<AdminPostVariantPreorderBody>,
  res: MedusaResponse
) {
  const { id } = req.params

  const { result } = await upsertProductVariantPreorderWorkflow(req.scope).run({
    input: {
      variant_id: id,
      available_date: req.validatedBody.available_date,
    },
  })

  return res.status(200).json({ preorder_variant: result.preorder_variant })
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params

  const { result } = await disablePreorderVariantWorkflow(req.scope).run({
    input: {
      variant_id: id,
    },
  })

  return res.status(200).json({ preorder_variant: result.preorder_variant })
}