import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PREORDER_MODULE } from "../../modules/preorder"
import { PreorderVariantStatus } from "../../modules/preorder/models/preorder-variant"

type CreatePreorderVariantStepInput = {
  variant_id: string
  available_date: string
}

export const createPreorderVariantStep = createStep(
  "create-preorder-variant",
  async (input: CreatePreorderVariantStepInput, { container }) => {
    const preorderModule = container.resolve(PREORDER_MODULE)

    const preorderVariant = await preorderModule.createPreorderVariants({
      variant_id: input.variant_id,
      available_date: new Date(input.available_date),
      status: PreorderVariantStatus.ENABLED,
    })

    return new StepResponse(preorderVariant, input.variant_id)
  },
  async (variantId, { container }) => {
    const preorderModule = container.resolve(PREORDER_MODULE)

    await preorderModule.deletePreorderVariants({ variant_id: variantId })
  }
)