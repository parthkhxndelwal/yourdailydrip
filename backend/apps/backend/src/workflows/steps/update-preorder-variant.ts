import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PREORDER_MODULE } from "../../modules/preorder"
import { PreorderVariantStatus } from "../../modules/preorder/models/preorder-variant"

type UpdatePreorderVariantStepInput = {
  id: string
  available_date: string
}

type UpdatePreorderVariantCompensationInput = {
  id: string
  available_date?: Date
  status?: PreorderVariantStatus
}

export const updatePreorderVariantStep = createStep(
  "update-preorder-variant",
  async (input: UpdatePreorderVariantStepInput, { container }) => {
    const preorderModule = container.resolve(PREORDER_MODULE)

    const [before] = await preorderModule.listPreorderVariants({ id: input.id })

    const [preorderVariant] = await preorderModule.updatePreorderVariants({
      selector: { id: input.id },
      data: {
        available_date: new Date(input.available_date),
        status: PreorderVariantStatus.ENABLED,
      },
    })

    return new StepResponse(
      preorderVariant,
      {
        id: preorderVariant.id,
        available_date: before?.available_date,
        status: before?.status,
      } satisfies UpdatePreorderVariantCompensationInput
    )
  },
  async (compensation: UpdatePreorderVariantCompensationInput, { container }) => {
    const preorderModule = container.resolve(PREORDER_MODULE)

    await preorderModule.updatePreorderVariants({
      selector: { id: compensation.id },
      data: {
        available_date: compensation.available_date,
        status: compensation.status,
      },
    })
  }
)