import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PREORDER_MODULE } from "../../modules/preorder"
import { PreorderVariantStatus } from "../../modules/preorder/models/preorder-variant"

type DisablePreorderVariantStepInput = {
  variant_id: string
}

type DisablePreorderVariantCompensationInput = {
  id: string
  available_date?: Date
  status?: PreorderVariantStatus
}

export const disablePreorderVariantStep = createStep(
  "disable-preorder-variant",
  async (input: DisablePreorderVariantStepInput, { container }) => {
    const preorderModule = container.resolve(PREORDER_MODULE)

    const [before] = await preorderModule.listPreorderVariants({
      variant_id: input.variant_id,
    })
    if (!before) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Preorder variant record for variant ${input.variant_id} was not found`
      )
    }

    const [preorderVariant] = await preorderModule.updatePreorderVariants({
      selector: { id: before.id },
      data: { status: PreorderVariantStatus.DISABLED },
    })

    return new StepResponse(
      preorderVariant,
      {
        id: preorderVariant.id,
        available_date: before.available_date,
        status: before.status,
      } satisfies DisablePreorderVariantCompensationInput
    )
  },
  async (compensation: DisablePreorderVariantCompensationInput, { container }) => {
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