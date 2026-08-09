import { useQueryGraphStep, createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { PREORDER_MODULE } from "../modules/preorder"
import { createPreorderVariantStep } from "./steps/create-preorder-variant"
import { updatePreorderVariantStep } from "./steps/update-preorder-variant"
import { setVariantAllowBackorderStep } from "./steps/set-variant-allow-backorder"

type UpsertProductVariantPreorderInput = {
  variant_id: string
  available_date: string
}

export const upsertProductVariantPreorderWorkflow = createWorkflow(
  "upsert-product-variant-preorder",
  function (input: UpsertProductVariantPreorderInput) {
    useQueryGraphStep({
      entity: "product_variant",
      fields: ["id"],
      filters: { id: input.variant_id },
      options: {
        throwIfKeyNotFound: true,
      },
    })

    const existing = useQueryGraphStep({
      entity: "preorder_variant",
      fields: ["id", "status"],
      filters: { variant_id: input.variant_id },
    }).config({ name: "query-existing-preorder-variant" })

    const created = when({ existing, input }, ({ existing, input }) => {
      return existing.data.length === 0
    }).then(() => {
      const record = createPreorderVariantStep({
        variant_id: input.variant_id,
        available_date: input.available_date,
      })

      const linkData = transform({ record, input }, ({ record, input }) => {
        return [
          {
            [PREORDER_MODULE]: { preorder_variant_id: record.id },
            [Modules.PRODUCT]: { product_variant_id: input.variant_id },
          },
        ]
      })

      createRemoteLinkStep(linkData)

      return record
    })

    when({ existing, input }, ({ existing, input }) => {
      return existing.data.length > 0
    }).then(() => {
      return updatePreorderVariantStep({
        id: existing.data[0].id,
        available_date: input.available_date,
      })
    })

    setVariantAllowBackorderStep({
      id: input.variant_id,
      allow_backorder: true,
    })

    const preorderVariant = transform(
      { created, existing, input },
      ({ created, existing, input }) => {
        const record = created ?? existing.data[0]

        return {
          id: record.id,
          status: "enabled",
          available_date: input.available_date,
        }
      }
    )

    return new WorkflowResponse({
      preorder_variant: preorderVariant,
    })
  }
)