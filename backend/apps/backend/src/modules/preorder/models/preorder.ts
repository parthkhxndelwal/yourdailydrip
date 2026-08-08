import { model } from "@medusajs/framework/utils"
import { PreorderVariant } from "./preorder-variant"

export enum PreorderStatus {
  PENDING = "pending",
  FULFILLED = "fulfilled",
  CANCELLED = "cancelled",
}

export const Preorder = model
  .define(
    "preorder",
    {
      id: model.id({ prefix: "po" }).primaryKey(),
      order_id: model.text().index(),
      item: model.belongsTo(() => PreorderVariant, {
        mappedBy: "preorders",
      }),
      status: model.enum(Object.values(PreorderStatus)).default(
        PreorderStatus.PENDING
      ),
    }
  )
  .indexes([
    {
      on: ["item_id", "status"],
    },
  ])
