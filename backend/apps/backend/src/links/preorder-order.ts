import { defineLink } from "@medusajs/framework/utils"
import PreorderModule from "../modules/preorder"
import OrderModule from "@medusajs/medusa/order"

// Read-only link: preorder.order_id maps to order.id so preorder rows can be
// joined to orders in Query without a link table or mutating the Order module.
export default defineLink(
  {
    linkable: PreorderModule.linkable.preorder,
    field: "order_id",
  },
  OrderModule.linkable.order,
  {
    readOnly: true,
  }
)
