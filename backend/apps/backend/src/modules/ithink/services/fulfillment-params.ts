import type { FulfillmentItemDTO, FulfillmentOrderDTO } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { toNumber, toOrderDate } from "../clients/payloads"
import type { AddOrderLine, AddOrderParams } from "../clients/types"
import {
  DEFAULT_WEIGHT_KG,
  numberValue,
  priceForItem,
  recipientName,
  shipmentDimensionsForOrder,
  type IthinkProviderOptions,
} from "./mappers"

export type BuildOrderParamsInput = {
  data: Record<string, unknown>
  items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[]
  order: Partial<FulfillmentOrderDTO>
  options: IthinkProviderOptions
  orderNumber: string
  logistics?: string
}

export function buildOrderParams(input: BuildOrderParamsInput): AddOrderParams {
  const address = input.order.shipping_address
  if (!address) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "iThink requires a shipping address to create a shipment"
    )
  }
  const dimensions = shipmentDimensionsForOrder(input.data, input.options)
  return {
    orderNumber: input.orderNumber,
    orderDate: toOrderDate(input.order.created_at ?? new Date()),
    totalAmount: toNumber(input.order.subtotal ?? input.order.item_subtotal ?? input.order.total ?? 0),
    recipientName: recipientName(address),
    addressLine1: address.address_1 ?? "",
    addressLine2: address.address_2,
    pin: address.postal_code ?? "",
    city: address.city,
    state: address.province,
    country: address.country_code,
    phone: address.phone ?? "",
    email: input.order.email,
    paymentMode: "Prepaid",
    shipmentLengthCm: dimensions.lengthCm,
    shipmentWidthCm: dimensions.widthCm,
    shipmentHeightCm: dimensions.heightCm,
    weightKg:
      numberValue(input.data.weight_kg) ?? input.options.default_weight_kg ?? DEFAULT_WEIGHT_KG,
    lines: input.items.map(
      (item): AddOrderLine => ({
        name: item.title ?? item.sku ?? "Product",
        sku: item.sku,
        quantity: item.quantity ?? 0,
        price: priceForItem(item, input.order),
      })
    ),
    pickupAddressId: input.options.pickup_address_id,
    gstNumber: input.options.gst_number,
    logistics: input.logistics,
  }
}
