export type IthinkMode = "dashboard" | "book"

export type IthinkClientOptions = {
  baseUrl: string
  accessToken: string
  secretKey: string
  pickupAddressId: string
  defaultWeightKg: number
  defaultLengthCm: number
  defaultWidthCm: number
  defaultHeightCm: number
  // "dashboard" hands orders to the iThink dashboard (sync only, no booking);
  // "book" books immediately via order/add.json. Defaults to "dashboard".
  mode?: IthinkMode
  returnAddressId?: string
  // Reseller/store name iThink requires on every shipment ("reseller_name").
  orderNoPrefix?: string
  resellerName?: string
  pollEnabled?: boolean
  fetchImpl?: typeof fetch
}

export type RateCheckParams = {
  fromPincode: string
  toPincode: string
  weightKg: number
  // Optional for pincode-only rate hints that have no cart context; the rate
  // body omits product_mrp when absent.
  productMrp?: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
}

export type IthinkRate = {
  logistic_name: string
  logistic_service_type?: string
  prepaid?: string
  cod?: string
  rate: number
  logistics_zone?: string
  delivery_tat?: string
}

export type RateCheckResult = {
  rates: IthinkRate[]
  zone?: string
  expectedDeliveryDate?: string
}

export type AddOrderLine = {
  name: string
  sku?: string
  quantity: number
  price: number
}

export type AddOrderParams = {
  orderNumber: string
  orderDate: string
  totalAmount: number
  recipientName: string
  addressLine1: string
  addressLine2?: string
  pin: string
  city?: string
  state?: string
  country?: string
  phone: string
  email?: string
  paymentMode: "Prepaid" | "COD"
  shipmentLengthCm: number
  shipmentWidthCm: number
  shipmentHeightCm: number
  weightKg: number
  lines: AddOrderLine[]
  pickupAddressId: string
  // Store GST number, sent as the shipment's `gst_number` field.
  gstNumber?: string
  // Reseller/store name, sent as the shipment's `reseller_name` field
  // (required by iThink on order/sync.json and order/add.json).
  resellerName?: string
  // Selected logistics carrier (logistic_name from the shipping option data).
  // Sent as the top-level `logistics` key of the order/add.json data envelope.
  logistics?: string
}

export type AddOrderSuccess = {
  status: string
  remark: string
  waybill: string
  refnum: string
  logistic_name: string
  tracking_url?: string
}

export type IthinkEnvelope = {
  status?: string
  status_code?: number
  message?: string
  html_message?: string
  msg?: string
  data?: unknown
  file_name?: string
  zone?: string
  expected_delivery_date?: string
  "Awb list"?: { airway_bill_no?: string }[]
}

export type GetAwbParams = {
  startDateTime: string
  endDateTime: string
}

export type IthinkScanEvent = {
  status: string
  status_code: string
  scan_location: string
  remark: string
  scan_date_time: string
  status_reason?: string
}

export type IthinkTrackShipment = {
  awb_no: string
  message?: string
  current_status?: string
  current_status_code?: string
  expected_delivery_date?: string
  promise_delivery_date?: string
  last_scan_details?: {
    status?: string
    status_code?: string
    status_date_time?: string
    scan_location?: string
    remark?: string
    reason?: string
  }
  scan_details?: IthinkScanEvent[]
}

// Per-shipment result of order/sync.json: syncs the order into the iThink
// Store Order tab without booking it (no AWB is generated).
export type SyncOrderResponse = {
  status: string
  refnum: string
  message?: string
  errors?: unknown[]
}

// One normalized entry of an order/get_details.json response. Every field is
// optional because iThink may omit fields for synced-but-unbooked orders.
export type OrderDetails = {
  order_no?: string
  awb_no?: string
  logistic?: string
  latest_courier_status?: string
  expected_delivery_date?: string
}

// Normalized get_details result set.
export type GetDetailsResponse = {
  orders?: OrderDetails[]
}

export const ENDPOINTS = {
  rate: "/rate/check.json",
  pincode: "/pincode/check.json",
  order: "/order/add.json",
  syncOrder: "/order/sync.json",
  orderDetails: "/order/get_details.json",
  cancel: "/order/cancel.json",
  label: "/shipping/label.json",
  getAwb: "/order/get_awb.json",
  track: "/order/track.json",
} as const

export const REQUEST_TIMEOUT_MS = 15_000

// iThink API caps: order/sync.json accepts at most 25 shipments per request;
// order/get_details.json accepts at most 500 lookup values per request.
export const SYNC_CHUNK_SIZE = 25
export const DETAILS_CHUNK_SIZE = 500
