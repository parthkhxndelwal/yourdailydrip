import type {
  AddOrderParams,
  IthinkClientOptions,
  RateCheckParams,
} from "./types"

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function toOrderDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${day}-${month}-${date.getFullYear()}`
}

export function toIthinkDateTime(value: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0")
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
    `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  )
}

// Every V3 endpoint receives its fields (and credentials, via withAuth) inside
// a single `data` key; the client wraps builder output with { data: ... }.
export function buildRateBody(params: RateCheckParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from_pincode: params.fromPincode,
    to_pincode: params.toPincode,
    shipping_weight_kg: params.weightKg,
    order_type: "forward",
    payment_method: "Prepaid",
  }
  if (params.productMrp !== undefined) body.product_mrp = params.productMrp
  if (params.lengthCm !== undefined) body.shipping_length_cms = String(params.lengthCm)
  if (params.widthCm !== undefined) body.shipping_width_cms = String(params.widthCm)
  if (params.heightCm !== undefined) body.shipping_height_cms = String(params.heightCm)
  return body
}

function shipmentBody(
  params: AddOrderParams,
  options?: { returnAddressId?: string; resellerName?: string }
): Record<string, unknown> {
  return {
    waybill: "",
    order: params.orderNumber,
    sub_order: "",
    order_date: params.orderDate,
    total_amount: params.totalAmount,
    name: params.recipientName,
    add: params.addressLine1,
    add2: params.addressLine2 ?? "",
    add3: "",
    pin: params.pin,
    city: params.city ?? "",
    state: params.state ?? "",
    country: params.country ?? "",
    phone: params.phone,
    alt_phone: params.phone,
    email: params.email ?? "",
    is_billing_same_as_shipping: "yes",
    billing_name: params.recipientName,
    billing_add: params.addressLine1,
    billing_pin: params.pin,
    billing_phone: params.phone,
    billing_email: params.email ?? "",
    products: params.lines.map((line) => ({
      product_name: line.name,
      product_sku: line.sku ?? "",
      product_quantity: String(line.quantity),
      product_price: String(line.price),
    })),
    shipment_length: String(params.shipmentLengthCm),
    shipment_width: String(params.shipmentWidthCm),
    shipment_height: String(params.shipmentHeightCm),
    weight: String(params.weightKg),
    shipping_charges: "0",
    giftwrap_charges: "0",
    transaction_charges: "0",
    total_discount: "0",
    first_attemp_discount: "0",
    cod_charges: "0",
    advance_amount: "0",
    cod_amount: "0",
    // reseller_name is a required per-shipment field on order/sync.json and
    // order/add.json; iThink rejects the payload when it is absent.
    reseller_name: params.resellerName ?? options?.resellerName ?? "",
    // eway_bill_number is generated per-shipment by iThink only when the
    // consignment value exceeds the statutory threshold (Rs. 50,000); the
    // store provides only its GST number.
    gst_number: params.gstNumber ?? "",
    eway_bill_number: "",
    payment_mode: params.paymentMode,
    return_address_id: options?.returnAddressId ?? "",
  }
}

export function buildOrderBody(
  params: AddOrderParams,
  options?: { returnAddressId?: string }
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    shipments: [shipmentBody(params, options)],
    pickup_address_id: params.pickupAddressId,
    s_type: "",
    order_type: "",
  }
  if (params.logistics) {
    data.logistics = params.logistics
  }
  return data
}

// order/sync.json mirrors order/add.json but never books the shipment: the
// order lands in the iThink Store Order tab unbooked (no AWB), so there is no
// `logistics` key and no waybill in the response.
export function buildSyncOrderBody(
  orderData: AddOrderParams | AddOrderParams[],
  options: IthinkClientOptions
): Record<string, unknown> {
  const orders = Array.isArray(orderData) ? orderData : [orderData]
  return {
    shipments: orders.map((order) => shipmentBody(order, options)),
    pickup_address_id: orders[0]?.pickupAddressId ?? options.pickupAddressId,
    s_type: "",
    order_type: "",
  }
}

// order/get_details.json looks up a comma-separated list of order numbers in
// the `order_no` key (its `order_no_list` sibling belongs to the separate
// store/get-order-details.json endpoint which requires a platform_id).
export function buildGetDetailsBody(orderNos: string[]): Record<string, unknown> {
  return { order_no: orderNos.join(",") }
}

export function withAuth(
  body: Record<string, unknown>,
  options: IthinkClientOptions
): Record<string, unknown> {
  return {
    ...body,
    access_token: options.accessToken,
    secret_key: options.secretKey,
  }
}
