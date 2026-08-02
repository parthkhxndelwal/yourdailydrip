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
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import type { Logger } from "@medusajs/framework/types"
import { IthinkClient } from "../clients/ithink-client"
import { toNumber, toOrderDate } from "../clients/payloads"
import type { AddOrderLine, AddOrderParams } from "../clients/types"
import {
  CARRIER_OPTIONS,
  DEFAULT_WEIGHT_KG,
  cartTotal,
  numberValue,
  optionLogisticName,
  priceForItem,
  recipientName,
  shipmentDimensions,
  shipmentDimensionsForOrder,
  stringValue,
  toClientOptions,
  totalWeightKg,
  type IthinkProviderOptions,
} from "./mappers"

export type { IthinkProviderOptions } from "./mappers"

export class IthinkFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "ithink"

  private readonly client: IthinkClient
  private readonly options: IthinkProviderOptions
  private readonly logger: Logger

  constructor(container: { logger: Logger }, options: IthinkProviderOptions) {
    super()
    this.logger = container.logger
    this.options = options
    this.client = new IthinkClient(toClientOptions(options))
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
    const postalCode = context.shipping_address?.postal_code
    if (!postalCode) {
      return { ...optionData, ...data }
    }
    const serviceable = await this.client.checkPincode(postalCode)
    if (!serviceable) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Pincode ${postalCode} is not serviceable by iThink couriers`
      )
    }
    const dimensions = shipmentDimensions(context.items, this.options)
    return {
      ...optionData,
      ...data,
      to_pincode: postalCode,
      weight_kg: totalWeightKg(context.items, this.options),
      shipment_length_cm: dimensions.lengthCm,
      shipment_width_cm: dimensions.widthCm,
      shipment_height_cm: dimensions.heightCm,
    }
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
    const address = order.shipping_address
    const dimensions = shipmentDimensionsForOrder(data, this.options)
    const params: AddOrderParams = {
      orderNumber: String(order.display_id ?? order.id ?? "medusa-order"),
      orderDate: toOrderDate(order.created_at ?? new Date()),
      totalAmount: toNumber(order.subtotal ?? order.item_subtotal ?? order.total ?? 0),
      recipientName: recipientName(address),
      addressLine1: address.address_1 ?? "",
      addressLine2: address.address_2,
      pin: address.postal_code ?? "",
      city: address.city,
      state: address.province,
      country: address.country_code,
      phone: address.phone ?? "",
      email: order.email,
      paymentMode: "Prepaid",
      shipmentLengthCm: dimensions.lengthCm,
      shipmentWidthCm: dimensions.widthCm,
      shipmentHeightCm: dimensions.heightCm,
      weightKg: numberValue(data.weight_kg) ?? this.options.default_weight_kg ?? DEFAULT_WEIGHT_KG,
      lines: items.map((item) => ({
        name: item.title ?? item.sku ?? "Product",
        sku: item.sku,
        quantity: item.quantity ?? 0,
        price: priceForItem(item, order),
      })),
      pickupAddressId: this.options.pickup_address_id,
      gstNumber: this.options.gst_number,
      logistics: optionLogisticName(data),
    }
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
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot cancel an iThink shipment without an AWB"
      )
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
