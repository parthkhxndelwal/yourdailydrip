import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { disablePreorderVariantStep } from "./steps/disable-preorder-variant"
import { setVariantAllowBackorderStep } from "./steps/set-variant-allow-backorder"

type DisablePreorderVariantInput = {
  variant_id: string
}

export const disablePreorderVariantWorkflow = createWorkflow(
  "disable-preorder-variant",
  function (input: DisablePreorderVariantInput) {
    const existing = useQueryGraphStep({
      entity: "preorder_variant",
      fields: ["id", "available_date"],
      filters: { variant_id: input.variant_id },
    })

    const record = disablePreorderVariantStep({
      variant_id: input.variant_id,
    })

    setVariantAllowBackorderStep({
      id: input.variant_id,
      allow_backorder: false,
    })

    const preorderVariant = transform({ record, existing }, ({ record, existing }) => {
      return {
        id: record.id,
        status: "disabled",
        available_date: existing.data[0].available_date,
      }
    })

    return new WorkflowResponse({
      preorder_variant: preorderVariant,
    })
  }
)