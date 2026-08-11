import type { Logger } from "@medusajs/framework/types"
import type { ValidateFulfillmentDataContext } from "@medusajs/framework/types"
import { IthinkClient } from "../../clients/ithink-client"
import { IthinkFulfillmentService } from "../ithink-fulfillment"
import type { IthinkProviderOptions } from "../mappers"
import { RATE_CACHE_MAX_ENTRIES, cacheRate, clearRateCache, getCachedRate } from "../fulfillment-validation"

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger

const dashboardOptions: IthinkProviderOptions = {
  base_url: "https://pre-alpha.ithinklogistics.com/api_v3",
  access_token: "tok-test",
  secret_key: "key-test",
  pickup_address_id: "addr-test",
  gst_number: "27ABCDE1234F1Z5",
  mode: "dashboard",
  return_address_id: "return-1",
  order_no_prefix: "YDD-",
}

const bookOptions: IthinkProviderOptions = {
  ...dashboardOptions,
  mode: "book",
}

function itemFixtures(): unknown[] {
  return [
    {
      id: "li1",
      quantity: 2,
      unit_price: 400,
      variant: {
        id: "variant_1",
        weight: 0.5,
        length: 20,
        height: 10,
        width: 15,
        material: "glass",
        product: { id: "prod_1" },
      },
      product: { id: "prod_1", collection_id: "col_1", categories: [], tags: [] },
    },
  ]
}

function contextFixture(): ValidateFulfillmentDataContext {
  return {
    id: "cart_1",
    shipping_address: {
      id: "saddr_1",
      first_name: "Jane",
      last_name: "Doe",
      address_1: "456 Elm St",
      city: "Bengaluru",
      country_code: "in",
      postal_code: "560001",
    },
    items: itemFixtures(),
    from_location: {
      id: "sloc_1",
      address: { postal_code: "110001" },
    },
  } as unknown as ValidateFulfillmentDataContext
}

function courierRates() {
  return {
    rates: [
      { logistic_name: "Delhivery", rate: 40, delivery_tat: "3" },
      { logistic_name: "BlueDart", rate: 55, delivery_tat: "1" },
    ],
    zone: "A",
    expectedDeliveryDate: "2026-08-12",
  }
}

describe("IthinkFulfillmentService validateFulfillmentData dashboard-mode rate estimate", () => {
  let service: IthinkFulfillmentService

  beforeEach(() => {
    clearRateCache()
    jest.restoreAllMocks()
    service = new IthinkFulfillmentService({ logger }, dashboardOptions)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    clearRateCache()
    ;(logger.error as jest.Mock).mockClear()
  })

  it("does not call rate/check when no pincode is present", async () => {
    const checkRate = jest.spyOn(IthinkClient.prototype, "checkRate").mockResolvedValue(courierRates())
    const context = {
      ...contextFixture(),
      shipping_address: { id: "saddr_1", city: "Bengaluru", country_code: "in" },
    } as unknown as ValidateFulfillmentDataContext

    const result = await service.validateFulfillmentData(
      { logistic_name: "delhivery" },
      { weight_kg: "0.5" },
      context
    )

    expect(checkRate).not.toHaveBeenCalled()
    expect(result).toEqual({ logistic_name: "delhivery", weight_kg: "0.5" })
  })

  it("calls rate/check once for two validations of the same pincode within TTL", async () => {
    const checkRate = jest.spyOn(IthinkClient.prototype, "checkRate").mockResolvedValue(courierRates())
    const checkPincode = jest.spyOn(IthinkClient.prototype, "checkPincode").mockResolvedValue(true)
    const context = contextFixture()

    const first = await service.validateFulfillmentData({}, {}, context)
    const second = await service.validateFulfillmentData({}, {}, context)

    expect(checkRate).toHaveBeenCalledTimes(1)
    expect(checkPincode).toHaveBeenCalledTimes(2)
    expect(first).toEqual(second)
    expect(first.delivery_tat).toBe(1)
  })

  it("merges the six scalar fields with min-rate and min-TAT values", async () => {
    jest.spyOn(IthinkClient.prototype, "checkRate").mockResolvedValue(courierRates())
    jest.spyOn(IthinkClient.prototype, "checkPincode").mockResolvedValue(true)

    const result = await service.validateFulfillmentData({}, {}, contextFixture())

    expect(result.cheapest_logistic).toBe("Delhivery")
    expect(result.cheapest_rate).toBe(40)
    expect(result.fastest_logistic).toBe("BlueDart")
    expect(result.fastest_rate).toBe(55)
    expect(result.delivery_tat).toBe(1)
    expect(result.expected_delivery_date).toBe("2026-08-12")
    expect(result).not.toHaveProperty("rates")
    expect(result.to_pincode).toBe("560001")
    expect(result.weight_kg).toBe(1)
  })

  it("returns the input data unchanged when rate/check throws", async () => {
    jest
      .spyOn(IthinkClient.prototype, "checkRate")
      .mockRejectedValue(new Error("iThink is down"))
    jest.spyOn(IthinkClient.prototype, "checkPincode").mockResolvedValue(true)

    const result = await service.validateFulfillmentData(
      { logistic_name: "delhivery" },
      { weight_kg: "0.5" },
      contextFixture()
    )

    expect(result).toEqual({ logistic_name: "delhivery", weight_kg: "0.5" })
    expect(result).not.toHaveProperty("delivery_tat")
    expect(logger.error as jest.Mock).toHaveBeenCalled()
  })

  it("re-fetches rates after the 30-minute TTL expires", async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-08-09T00:00:00Z"))
    try {
      const checkRate = jest.spyOn(IthinkClient.prototype, "checkRate").mockResolvedValue(courierRates())
      jest.spyOn(IthinkClient.prototype, "checkPincode").mockResolvedValue(true)

      await service.validateFulfillmentData({}, {}, contextFixture())
      jest.setSystemTime(new Date("2026-08-09T00:29:00Z"))
      await service.validateFulfillmentData({}, {}, contextFixture())
      expect(checkRate).toHaveBeenCalledTimes(1)

      jest.setSystemTime(new Date("2026-08-09T01:00:00Z"))
      await service.validateFulfillmentData({}, {}, contextFixture())
      expect(checkRate).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it("evicts the oldest entry when the cache exceeds 1000 entries", () => {
    for (let index = 0; index < RATE_CACHE_MAX_ENTRIES + 1; index += 1) {
      cacheRate(`pincode-${index}`, courierRates())
    }
    expect(getCachedRate("pincode-0")).toBeUndefined()
    expect(getCachedRate(`pincode-${RATE_CACHE_MAX_ENTRIES}`)).toBeDefined()
  })
})

describe("IthinkFulfillmentService validateFulfillmentData book-mode is unchanged", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("never calls rate/check in book mode and keeps pincode serviceability validation", async () => {
    const checkRate = jest.spyOn(IthinkClient.prototype, "checkRate").mockResolvedValue(courierRates())
    const checkPincode = jest.spyOn(IthinkClient.prototype, "checkPincode").mockResolvedValue(true)
    const service = new IthinkFulfillmentService({ logger }, bookOptions)

    const result = await service.validateFulfillmentData({}, {}, contextFixture())

    expect(checkRate).not.toHaveBeenCalled()
    expect(checkPincode).toHaveBeenCalledWith("560001")
    expect(result).not.toHaveProperty("delivery_tat")
    expect(result).not.toHaveProperty("cheapest_logistic")
    expect(result.to_pincode).toBe("560001")
  })

  it("still throws for unserviceable pincodes in book mode", async () => {
    jest.spyOn(IthinkClient.prototype, "checkPincode").mockResolvedValue(false)
    const service = new IthinkFulfillmentService({ logger }, bookOptions)

    await expect(
      service.validateFulfillmentData({}, {}, contextFixture())
    ).rejects.toThrow("not serviceable")
  })
})

describe("validated shipping method data flows into fulfillment.data", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("createFulfillment preserves the validated rate fields in the returned fulfillment data", async () => {
    // The framework passes the shipping method data (produced by
    // validateFulfillmentData) as the provider createFulfillment `data`
    // argument; the provider merges it into the fulfillment data it returns.
    jest.spyOn(IthinkClient.prototype, "addOrder").mockResolvedValue({
      status: "Success",
      remark: "ok",
      waybill: "IT00000001",
      refnum: "R1",
      logistic_name: "Delhivery",
    })
    const service = new IthinkFulfillmentService({ logger }, bookOptions)
    const shippingMethodData = {
      delivery_tat: 1,
      expected_delivery_date: "2026-08-12",
      cheapest_logistic: "Delhivery",
      cheapest_rate: 40,
      fastest_logistic: "BlueDart",
      fastest_rate: 55,
      logistic_name: "delhivery",
      to_pincode: "560001",
    }

    const result = await service.createFulfillment(
      shippingMethodData,
      [
        {
          id: "fulitem1",
          title: "Serum",
          sku: "SER-1",
          quantity: 1,
          line_item_id: "li1",
        },
      ],
      {
        id: "ord_1",
        display_id: 1001,
        created_at: new Date("2026-08-01T10:00:00Z"),
        shipping_address: {
          id: "addr_1",
          created_at: new Date("2026-08-01T10:00:00Z"),
          updated_at: new Date("2026-08-01T10:00:00Z"),
          first_name: "Jane",
          last_name: "Doe",
          address_1: "456 Elm St",
          postal_code: "560001",
          city: "Bengaluru",
          province: "Karnataka",
          country_code: "in",
          phone: "9876543210",
        },
      },
      {}
    )

    expect(result.data.delivery_tat).toBe(1)
    expect(result.data.cheapest_logistic).toBe("Delhivery")
    expect(result.data.fastest_logistic).toBe("BlueDart")
    expect(result.data.expected_delivery_date).toBe("2026-08-12")
    expect(result.data.awb).toBe("IT00000001")
  })
})
