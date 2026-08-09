import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

type SetVariantAllowBackorderStepInput = {
  id: string
  allow_backorder: boolean
}

type SetVariantAllowBackorderCompensationInput = {
  id: string
  allow_backorder: boolean
}

export const setVariantAllowBackorderStep = createStep(
  "set-variant-allow-backorder",
  async (input: SetVariantAllowBackorderStepInput, { container }) => {
    const productModule = container.resolve(Modules.PRODUCT)

    const variant = await productModule.retrieveProductVariant(input.id, {
      select: ["id", "allow_backorder"],
    })

    await productModule.updateProductVariants(
      { id: input.id },
      { allow_backorder: input.allow_backorder }
    )

    return new StepResponse(
      { id: input.id },
      {
        id: input.id,
        allow_backorder: variant.allow_backorder ?? false,
      }
    )
  },
  async (
    compensation: SetVariantAllowBackorderCompensationInput,
    { container }
  ) => {
    const productModule = container.resolve(Modules.PRODUCT)

    await productModule.updateProductVariants(
      { id: compensation.id },
      { allow_backorder: compensation.allow_backorder }
    )
  }
)