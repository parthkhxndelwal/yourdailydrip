import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Logger } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { IthinkClient } from "../../../../../modules/ithink/clients/ithink-client"
import { IthinkFulfillmentService } from "../../../../../modules/ithink/services/ithink-fulfillment"
import { clearRateCache } from "../../../../../modules/ithink/services/fulfillment-validation"
import type { IthinkProviderOptions } from "../../../../../modules/ithink/services/mappers"
import { GET } from "../route"

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger

const providerOptions: IthinkProviderOptions = {
  base_url: "https://pre-alpha.ithinklogistics.com/api_v3",
  access_token: "tok-test",
  secret_key: "key-test",
  pickup_address_id: "addr-test",
  gst_number: "27ABCDE1234F1Z5",
  mode: "dashboard",
  return_address_id: "return-1",
  order_no_prefix: "YDD-",
}

function courierRates() {
  return {
    rates: [
      { logistic_name: "Delhivery", rate: 40, delivery_tat: "3" },
      { logistic_name: "BlueDart", rate: 55, delivery_tat: "1" },
      { logistic_name: "Xpressbees", rate: 70, delivery_tat: "2" },
    ],
    zone: "A",
    expectedDeliveryDate: "2026-08-12",
  }
}

function responseMock() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse
}

function requestMock(scope: { resolve: (key: string) => unknown }): MedusaRequest {
  return {
    query: { pincode: "560001" },
    scope,
  } as unknown as MedusaRequest
}

function stockLocationMock(postalCode: string) {
  return {
    listStockLocations: jest.fn().mockResolvedValue([{ address: { postal_code: postalCode } }]),
  }
}

describe("GET /store/ithink/rates min-rate and min-TAT computation", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns the cheapest courier by rate and the fastest by delivery_tat over all couriers", async () => {
    const provider = {
      getRateHints: jest.fn().mockResolvedValue(courierRates()),
    }
    const scope = {
      resolve: (key: string) => {
        if (key === "fp_ithink_ithink") {
          return provider
        }
        if (key === Modules.STOCK_LOCATION) {
          return stockLocationMock("110001")
        }
        return undefined
      },
    }
    const res = responseMock()

    await GET(requestMock(scope), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      cheapest: { logistic: "Delhivery", rate: 40, delivery_tat: 3 },
      fastest: { logistic: "BlueDart", rate: 55, delivery_tat: 1 },
      expected_delivery_date: "2026-08-12",
      currency: "INR",
      from_pincode: "110001",
      to_pincode: "560001",
    })
  })

  it("forwards the optional mrp query to the provider", async () => {
    const provider = {
      getRateHints: jest.fn().mockResolvedValue(courierRates()),
    }
    const scope = {
      resolve: (key: string) => {
        if (key === "fp_ithink_ithink") {
          return provider
        }
        if (key === Modules.STOCK_LOCATION) {
          return stockLocationMock("110001")
        }
        return undefined
      },
    }
    const res = responseMock()
    const req = requestMock(scope) as MedusaRequest & { query: Record<string, unknown> }
    req.query = { pincode: "560001", mrp: "999" }

    await GET(req, res)

    expect(provider.getRateHints).toHaveBeenCalledWith("110001", "560001", 999)
  })

  it("reuses the shared cache so two requests for one pincode make a single client call", async () => {
    clearRateCache()
    const service = new IthinkFulfillmentService({ logger }, providerOptions)
    const checkRate = jest
      .spyOn(IthinkClient.prototype, "checkRate")
      .mockResolvedValue(courierRates())
    const scope = {
      resolve: (key: string) => {
        if (key === "fp_ithink_ithink") {
          return service
        }
        if (key === Modules.STOCK_LOCATION) {
          return stockLocationMock("110001")
        }
        return undefined
      },
    }
    const res = responseMock()

    await GET(requestMock(scope), res)
    await GET(requestMock(scope), res)

    expect(checkRate).toHaveBeenCalledTimes(1)
    clearRateCache()
  })

  it("falls back to the fp_ithink container key when fp_ithink_ithink is absent", async () => {
    const provider = {
      getRateHints: jest.fn().mockResolvedValue(courierRates()),
    }
    const scope = {
      resolve: (key: string) => {
        if (key === "fp_ithink") {
          return provider
        }
        if (key === Modules.STOCK_LOCATION) {
          return stockLocationMock("110001")
        }
        return undefined
      },
    }
    const res = responseMock()

    await GET(requestMock(scope), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(provider.getRateHints).toHaveBeenCalledWith("110001", "560001", undefined)
  })

  it("resolves the provider from the module service internal container (production path)", async () => {
    // In prod the root container has no fp_* registration; the fulfillment
    // module service carries its internal container as __container__, and
    // Medusa's own provider access is bracket property access, not .resolve().
    const provider = {
      getRateHints: jest.fn().mockResolvedValue(courierRates()),
    }
    const scope = {
      resolve: (key: string) => {
        if (key === Modules.FULFILLMENT) {
          return { __container__: { fp_ithink_ithink: provider } }
        }
        if (key === Modules.STOCK_LOCATION) {
          return stockLocationMock("110001")
        }
        return undefined
      },
    }
    const res = responseMock()

    await GET(requestMock(scope), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(provider.getRateHints).toHaveBeenCalledWith("110001", "560001", undefined)
  })
})

describe("GET /store/ithink/rates error handling", () => {
  afterEach(() => {
    jest.restoreAllMocks()
    clearRateCache()
  })

  it("responds 400 when the pincode query parameter is missing", async () => {
    const scope = { resolve: () => undefined }
    const req = {
      query: {},
      scope,
    } as unknown as MedusaRequest
    const res = responseMock()

    await GET(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it("responds 502 with rate_unavailable when the provider is not resolvable", async () => {
    const scope = { resolve: () => undefined }
    const res = responseMock()

    await GET(requestMock(scope), res)

    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: "rate_unavailable" })
  })

  it("responds 502 when the rate check throws on the client", async () => {
    clearRateCache()
    const service = new IthinkFulfillmentService({ logger }, providerOptions)
    jest
      .spyOn(IthinkClient.prototype, "checkRate")
      .mockRejectedValue(new Error("iThink is down"))
    const scope = {
      resolve: (key: string) => {
        if (key === "fp_ithink_ithink") {
          return service
        }
        if (key === Modules.STOCK_LOCATION) {
          return stockLocationMock("110001")
        }
        return undefined
      },
    }
    const res = responseMock()

    await GET(requestMock(scope), res)

    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: "rate_unavailable" })
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ cheapest: expect.anything() })
    )
  })

  it("responds 502 when no stock location pincode exists", async () => {
    const provider = {
      getRateHints: jest.fn().mockResolvedValue(courierRates()),
    }
    const scope = {
      resolve: (key: string) => {
        if (key === "fp_ithink_ithink") {
          return provider
        }
        if (key === Modules.STOCK_LOCATION) {
          return { listStockLocations: jest.fn().mockResolvedValue([]) }
        }
        return undefined
      },
    }
    const res = responseMock()

    await GET(requestMock(scope), res)

    expect(res.status).toHaveBeenCalledWith(502)
    expect(provider.getRateHints).not.toHaveBeenCalled()
  })
})
