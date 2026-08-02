import { MedusaError } from "@medusajs/framework/utils"
import { buildOrderBody, buildRateBody, withAuth } from "./payloads"
import {
  ENDPOINTS,
  REQUEST_TIMEOUT_MS,
  type AddOrderParams,
  type AddOrderSuccess,
  type GetAwbParams,
  type IthinkClientOptions,
  type IthinkEnvelope,
  type IthinkRate,
  type IthinkTrackShipment,
  type RateCheckParams,
  type RateCheckResult,
} from "./types"

export {
  buildOrderBody,
  buildRateBody,
  toIthinkDateTime,
  toNumber,
  toOrderDate,
  withAuth,
} from "./payloads"

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function isRateEntry(value: unknown): value is IthinkRate {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as IthinkRate).logistic_name === "string"
  )
}

function isOrderEntry(value: unknown): value is AddOrderSuccess {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as AddOrderSuccess).status === "Success"
  )
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== "")
}

function shipmentFailureHint(remark: string, params: AddOrderParams): string {
  const trimmed = remark.trim()
  switch (trimmed) {
    case "Pincode Not Serviceable.":
      return `${trimmed} (carrier ${params.logistics ?? "unknown"} with payment mode ${params.paymentMode} is not serviceable for pincode ${params.pin} on this iThink account; choose a different carrier or contact iThink)`
    case "Insufficient wallet balance.":
      return `${trimmed} Recharge the iThink account wallet and retry.`
    default:
      return trimmed
  }
}

export class IthinkClient {
  constructor(private readonly options: IthinkClientOptions) {}

  async checkPincode(pincode: string): Promise<boolean> {
    const envelope = await this.post(ENDPOINTS.pincode, { pincode })
    if (envelope.status !== "success") {
      return false
    }
    const data = envelope.data
    return data !== "no" && data !== undefined && data !== null && data !== ""
  }

  async checkRate(params: RateCheckParams): Promise<RateCheckResult> {
    const envelope = await this.post(ENDPOINTS.rate, buildRateBody(params))
    const rates = this.entryList(envelope.data).filter(isRateEntry)
    return {
      rates,
      zone: envelope.zone,
      expectedDeliveryDate: envelope.expected_delivery_date,
    }
  }

  async addOrder(params: AddOrderParams): Promise<AddOrderSuccess> {
    const envelope = await this.post(ENDPOINTS.order, buildOrderBody(params))
    const entry = this.entryList(envelope.data).find(isOrderEntry)
    if (!entry) {
      const entryRemark = this.entryList(envelope.data)
        .map((e) => (e as { remark?: string }).remark)
        .find((r): r is string => Boolean(r))
      const remark =
        firstNonEmpty(envelope.message, envelope.html_message, envelope.msg, entryRemark) ??
        "unknown error"
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `iThink could not create the shipment: ${shipmentFailureHint(remark, params)}`
      )
    }
    return entry
  }

  async cancelOrder(awbNumbers: string[]): Promise<Record<string, unknown>> {
    const envelope = await this.post(ENDPOINTS.cancel, {
      awb_numbers: awbNumbers.slice(0, 100).join(","),
    })
    return this.dataObject(envelope)
  }

  async getLabel(awbNumbers: string[]): Promise<string> {
    const envelope = await this.post(ENDPOINTS.label, {
      awb_numbers: awbNumbers.slice(0, 100).join(","),
      page_size: "A4",
      display_cod_prepaid: "",
      display_shipper_mobile: "",
      display_shipper_address: "",
    })
    if (typeof envelope.file_name === "string" && envelope.file_name.length > 0) {
      return envelope.file_name
    }
    if (envelope.status === "success" && typeof envelope.data === "string") {
      return envelope.data
    }
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "iThink did not return a shipment label")
  }

  async getAwbsInWindow(params: GetAwbParams): Promise<string[]> {
    const envelope = await this.post(
      ENDPOINTS.getAwb,
      {
        start_date_time: params.startDateTime,
        end_date_time: params.endDateTime,
      },
      { tolerateNoData: true }
    )
    const list = envelope["Awb list"]
    if (!Array.isArray(list)) {
      return []
    }
    return list
      .map((entry) => entry.airway_bill_no)
      .filter((awb): awb is string => typeof awb === "string" && awb.length > 0)
  }

  async trackShipments(awbNumbers: string[]): Promise<IthinkTrackShipment[]> {
    const unique = [...new Set(awbNumbers.filter((awb) => awb.length > 0))]
    if (unique.length === 0) {
      return []
    }
    const shipments: IthinkTrackShipment[] = []
    for (const chunk of chunkArray(unique, 10)) {
      const envelope = await this.post(ENDPOINTS.track, {
        awb_number_list: chunk.join(","),
      })
      for (const value of this.entryList(envelope.data)) {
        if (typeof value === "object" && value !== null && typeof (value as IthinkTrackShipment).awb_no === "string") {
          shipments.push(value as IthinkTrackShipment)
        }
      }
    }
    return shipments
  }

  private entryList(data: unknown): unknown[] {
    if (Array.isArray(data)) {
      return data
    }
    if (typeof data === "object" && data !== null) {
      return Object.values(data as Record<string, unknown>)
    }
    return []
  }

  private dataObject(envelope: IthinkEnvelope): Record<string, unknown> {
    const data = envelope.data
    return typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    options: { tolerateNoData?: boolean } = {}
  ): Promise<IthinkEnvelope> {
    const url = `${this.options.baseUrl.replace(/\/+$/, "")}${path}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    const fullBody = JSON.stringify({ data: withAuth(body, this.options) })
    try {
      response = await (this.options.fetchImpl ?? fetch)(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: fullBody,
        signal: controller.signal,
      })
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `iThink request to ${path} failed: ${this.errorMessage(error)}`
      )
    } finally {
      clearTimeout(timeout)
    }
    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `iThink request to ${path} failed with HTTP ${response.status}`
      )
    }
    const text = await response.text()
    let envelope: IthinkEnvelope
    try {
      envelope = JSON.parse(text) as IthinkEnvelope
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `iThink returned a non-JSON response to ${path}`
      )
    }
    if (options.tolerateNoData && envelope.message === "No Data found.") {
      // iThink reports an empty result set as a failed envelope ("No Data
      // found."); the AWB window poll treats that as an empty window.
      return envelope
    }
    if (
      envelope.status !== undefined &&
      envelope.status !== "success" &&
      envelope.status !== "Success"
    ) {
      const message =
        firstNonEmpty(envelope.message, envelope.html_message, envelope.msg) ??
        `status ${envelope.status}`
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `iThink request to ${path} failed: ${message}`
      )
    }
    if (typeof envelope.status_code === "number" && envelope.status_code >= 400) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `iThink request to ${path} failed with code ${envelope.status_code}`
      )
    }
    return envelope
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
