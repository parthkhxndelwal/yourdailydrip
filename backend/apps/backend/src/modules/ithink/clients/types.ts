export type IthinkClientOptions = {
  baseUrl: string
  accessToken: string
  secretKey: string
  pickupAddressId: string
  defaultWeightKg: number
  defaultLengthCm: number
  defaultWidthCm: number
  defaultHeightCm: number
  fetchImpl?: typeof fetch
}

export type RateCheckParams = {
  fromPincode: string
  toPincode: string
  weightKg: number
  productMrp: number
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

export const ENDPOINTS = {
  rate: "/rate/check.json",
  pincode: "/pincode/check.json",
  order: "/order/add.json",
  cancel: "/order/cancel.json",
  label: "/shipping/label.json",
  getAwb: "/order/get_awb.json",
  track: "/order/track.json",
} as const

export const REQUEST_TIMEOUT_MS = 15_000
