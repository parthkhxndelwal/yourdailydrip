import {
  AbstractFulfillmentProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceContext,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import { IthinkClient } from "../clients/ithink-client"
import type { IthinkMode, RateCheckResult } from "../clients/types"
import { buildOrderParams } from "./fulfillment-params"
import { getRateHints, validateWithRates } from "./fulfillment-validation"
import {
  CARRIER_OPTIONS,
  cartTotal,
  numberValue,
  optionLogisticName,
  resolveProviderOptions,
  stringValue,
  toClientOptions,
  totalWeightKg,
  type IthinkProviderOptions,
} from "./mappers"

export class IthinkFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "ithink"

  private readonly client: IthinkClient
  private readonly options: IthinkProviderOptions
  private readonly logger: Logger

  constructor(container: { logger: Logger }, options: IthinkProviderOptions) {
    super()
    this.logger = container.logger
    this.options = resolveProviderOptions(options)
    this.client = new IthinkClient(toClientOptions(this.options))
  }

  getMode(): IthinkMode {
    return this.options.mode ?? "dashboard"
  }

  getOptions(): IthinkProviderOptions {
    return this.options
  }

  // Storefront rate hints for a delivery pincode; reuses the shared cache and
  // defaults (see getRateHints in fulfillment-validation). Undefined on error.
  async getRateHints(
    fromPincode: string,
    toPincode: string,
    productMrp?: number
  ): Promise<RateCheckResult | undefined> {
    return getRateHints(
      { client: this.client, logger: this.logger, options: this.options },
      fromPincode,
      toPincode,
      productMrp
    )
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return CARRIER_OPTIONS
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    const logisticName = data.logistic_name
    return (
      typeof logisticName === "string" &&
      CARRIER_OPTIONS.some((option) => option.logistic_name === logisticName)
    )
  }

  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return true
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    return validateWithRates(
      {
        client: this.client,
        logger: this.logger,
        options: this.options,
      },
      optionData,
      data,
      context
    )
  }

  async calculatePrice(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    const toPincode = stringValue(data?.to_pincode) ?? context.shipping_address?.postal_code
    const fromPincode = context.from_location?.address?.postal_code
    if (!toPincode || !fromPincode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "iThink rate check requires both a pickup pincode (stock location) and a delivery pincode"
      )
    }
    const productMrp = cartTotal(context.items)
    if (productMrp <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "iThink rate check requires cart items with prices (cart MRP is 0)"
      )
    }
    const result = await this.client.checkRate({
      fromPincode,
      toPincode,
      weightKg: numberValue(data?.weight_kg) ?? totalWeightKg(context.items, this.options),
      productMrp,
      lengthCm: numberValue(data?.shipment_length_cm),
      widthCm: numberValue(data?.shipment_width_cm),
      heightCm: numberValue(data?.shipment_height_cm),
    })
    const logisticName = optionLogisticName(optionData)
    const rate = logisticName
      ? result.rates.find(
          (candidate) => candidate.logistic_name.toLowerCase() === logisticName.toLowerCase()
        )
      : result.rates[0]
    if (!rate) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No iThink rate available for ${logisticName ?? "any courier"} to pincode ${toPincode}`
      )
    }
    return {
      calculated_amount: rate.rate,
      is_calculated_price_tax_inclusive: false,
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: unknown
  ): Promise<CreateFulfillmentResult> {
    if (!order?.shipping_address) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "iThink requires a shipping address to create a shipment"
      )
    }
    const existingRefnum = stringValue(data.refnum)
    if (existingRefnum) {
      this.logger.info(
        `iThink fulfillment already registered (refnum ${existingRefnum}); skipping iThink API call`
      )
      return { data: { ...data }, labels: [] }
    }
    return this.getMode() === "dashboard"
      ? this.syncToDashboard(data, items, order)
      : this.bookShipment(data, items, order)
  }

  private async syncToDashboard(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO>
  ): Promise<CreateFulfillmentResult> {
    if (!this.options.return_address_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "iThink dashboard mode requires the return_address_id provider option"
      )
    }
    const orderNo = `${this.options.order_no_prefix}${order.display_id ?? order.id}`
    const params = buildOrderParams({
      data,
      items,
      order,
      options: this.options,
      orderNumber: orderNo,
    })
    const [refnum] = await this.client.syncOrders([params])
    if (!refnum) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "iThink did not return a refnum for the synced order"
      )
    }
    this.logger.info(`iThink order synced to dashboard: refnum ${refnum} for order ${orderNo}`)
    return {
      data: {
        provider: "ithink",
        mode: "dashboard",
        refnum,
        order_no: orderNo,
        synced_at: new Date().toISOString(),
      },
      labels: [],
    }
  }

  private async bookShipment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO>
  ): Promise<CreateFulfillmentResult> {
    const params = buildOrderParams({
      data,
      items,
      order,
      options: this.options,
      orderNumber: String(order.display_id ?? order.id ?? "medusa-order"),
      logistics: optionLogisticName(data),
    })
    const result = await this.client.addOrder(params)
    const trackingUrl = result.tracking_url ?? ""
    this.logger.info(
      `iThink shipment created: AWB ${result.waybill} for order ${params.orderNumber}`
    )
    return {
      data: {
        ...data,
        awb: result.waybill,
        refnum: result.refnum,
        logistic_name: result.logistic_name,
        tracking_url: trackingUrl,
      },
      labels: [
        {
          tracking_number: result.waybill,
          tracking_url: trackingUrl,
          label_url: "",
        },
      ],
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const awb = stringValue(data.awb)
    if (!awb) {
      this.logger.info(
        "iThink shipment has no AWB; cancel it in the iThink dashboard (no API call)"
      )
      return { cancelled: false, reason: "cancel-in-dashboard" }
    }
    return this.client.cancelOrder([awb])
  }

  async getFulfillmentDocuments(data: Record<string, unknown>): Promise<any> {
    const awb = stringValue(data.awb)
    if (!awb) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot fetch an iThink label without an AWB"
      )
    }
    return this.client.getLabel([awb])
  }
}
