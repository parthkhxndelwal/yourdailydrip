import type { IthinkScanEvent, IthinkTrackShipment } from "../clients/types"

// Terminal statuses stop further active polling. Mirrors the iThink V3 status
// table: DL (Delivered / RTO Delivered), CN (Cancelled), and the Lost/Shortage
// family have no in-flight transitions worth re-polling.
export const TERMINAL_STATUS_CODES = new Set([
  "DL",
  "CN",
  "Lost",
  "Shortage",
  "RTO Shortage",
])

export function isTerminalStatusCode(code: string | undefined): boolean {
  return typeof code === "string" && TERMINAL_STATUS_CODES.has(code.trim())
}

export type NormalizedScan = {
  status: string
  statusCode: string
  location: string
  remark: string
  at: string
}

export type NormalizedTrackShipment = {
  awb: string
  status: string
  statusCode: string
  expectedDeliveryDate?: string
  promiseDeliveryDate?: string
  terminal: boolean
  scans: NormalizedScan[]
}

function scanFrom(event: IthinkScanEvent): NormalizedScan {
  return {
    status: event.status ?? "Update",
    statusCode: event.status_code ?? "",
    location: event.scan_location ?? "",
    remark: event.remark ?? "",
    at: event.scan_date_time ?? "",
  }
}

export function normalizeTrackShipment(shipment: IthinkTrackShipment): NormalizedTrackShipment {
  const statusCode = shipment.current_status_code ?? ""
  const scans = Array.isArray(shipment.scan_details)
    ? shipment.scan_details.map(scanFrom)
    : []
  return {
    awb: shipment.awb_no,
    status: shipment.current_status ?? "",
    statusCode,
    expectedDeliveryDate: shipment.expected_delivery_date || undefined,
    promiseDeliveryDate: shipment.promise_delivery_date || undefined,
    terminal: isTerminalStatusCode(statusCode),
    scans,
  }
}
