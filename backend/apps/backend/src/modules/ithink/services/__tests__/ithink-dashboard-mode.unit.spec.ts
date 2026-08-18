import type { Logger } from "@medusajs/framework/types"
import type { FulfillmentItemDTO, FulfillmentOrderDTO } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { IthinkClient } from "../../clients/ithink-client"
import type { AddOrderParams } from "../../clients/types"
import { IthinkFulfillmentService } from "../ithink-fulfillment"
import type { IthinkProviderOptions } from "../mappers"

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
  reseller_name: "Daily Drip",
  mode: "dashboard",
  return_address_id: "return-1",
  order_no_prefix: "YDD-",
}

const bookOptions: IthinkProviderOptions = {
  ...dashboardOptions,
  mode: "book",
}

function itemFixture(): Partial<Omit<FulfillmentItemDTO, "fulfillment">>[] {
  return [{ id: "fulitem1", title: "Serum", sku: "SER-1", quantity: 1, line_item_id: "li1" }]
}

function orderFixture(): Partial<FulfillmentOrderDTO> {
  return {
    id: "ord_1",
    display_id: 1001,
    created_at: new Date("2026-08-01T10:00:00Z"),
    subtotal: 749,
    email: "jane@example.com",
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
  }
}

function fakeResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

function parseCapturedBody(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

describe("IthinkFulfillmentService dashboard-mode createFulfillment", () => {
  afterEach(() => {
    jest.restoreAllMocks()
    ;(logger.info as jest.Mock).mockClear()
  })

  it("calls syncOrders exactly once with order_no prefix+display_id and never addOrder", async () => {
    const syncSpy = jest
      .spyOn(IthinkClient.prototype, "syncOrders")
      .mockResolvedValue(["REF-1"])
    const addSpy = jest
      .spyOn(IthinkClient.prototype, "addOrder")
      .mockResolvedValue({
        status: "Success",
        remark: "ok",
        waybill: "IT00000001",
        refnum: "R1",
        logistic_name: "delhivery",
      })
    const service = new IthinkFulfillmentService({ logger }, dashboardOptions)

    const result = await service.createFulfillment(
      { weight_kg: "0.5" },
      itemFixture(),
      orderFixture(),
      {}
    )

    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(addSpy).not.toHaveBeenCalled()
    const payload = syncSpy.mock.calls[0][0] as AddOrderParams[]
    expect(payload).toHaveLength(1)
    expect(payload[0].orderNumber).toBe("YDD-1001")
    expect(payload[0].paymentMode).toBe("Prepaid")
    expect(payload[0].weightKg).toBe(0.5)
    expect(payload[0].pickupAddressId).toBe("addr-test")
    expect(payload[0].logistics).toBeUndefined()
    expect(result.data.refnum).toBe("REF-1")
    expect(result.data.order_no).toBe("YDD-1001")
    expect(result.data.mode).toBe("dashboard")
    expect(result.data.provider).toBe("ithink")
    expect(typeof result.data.synced_at).toBe("string")
  })

  it("sends return_address_id and no logistics in the sync request body", async () => {
    let capturedUrl: string | undefined
    let capturedInit: RequestInit | undefined
    const fetchMock = jest.fn(async (url: unknown, init: RequestInit) => {
      capturedUrl = String(url)
      capturedInit = init
      return fakeResponse({
        status: "success",
        data: {
          "1": { status: "Success", refnum: "REF-1" },
        },
      })
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch
    try {
      const service = new IthinkFulfillmentService({ logger }, dashboardOptions)

      const result = await service.createFulfillment(
        { logistic_name: "delhivery", weight_kg: "0.5" },
        itemFixture(),
        orderFixture(),
        {}
      )

      expect(capturedUrl).toContain("/order/sync.json")
      const body = parseCapturedBody(capturedInit!)
      const data = body.data as Record<string, unknown>
      expect(data.pickup_address_id).toBe("addr-test")
      expect(data.access_token).toBe("tok-test")
      expect(data.secret_key).toBe("key-test")
      expect("logistics" in data).toBe(false)
      expect(JSON.stringify(data)).not.toContain("logistics")
      const shipment = (data.shipments as Record<string, unknown>[])[0]
      expect(shipment.order).toBe("YDD-1001")
      expect(shipment.payment_mode).toBe("Prepaid")
      expect(shipment.return_address_id).toBe("return-1")
      expect(shipment.reseller_name).toBe("Daily Drip")
      expect(result.data.refnum).toBe("REF-1")
      expect(result.data.order_no).toBe("YDD-1001")
      expect(result.data).not.toHaveProperty("awb")
      expect(result.data).not.toHaveProperty("logistic_name")
      expect(result.data).not.toHaveProperty("tracking_url")
      expect(result.labels).toEqual([])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("returns existing data without calling iThink when refnum is already present", async () => {
    const syncSpy = jest.spyOn(IthinkClient.prototype, "syncOrders").mockResolvedValue([])
    const addSpy = jest
      .spyOn(IthinkClient.prototype, "addOrder")
      .mockResolvedValue({
        status: "Success",
        remark: "ok",
        waybill: "IT00000001",
        refnum: "R1",
        logistic_name: "delhivery",
      })
    const service = new IthinkFulfillmentService({ logger }, dashboardOptions)

    const result = await service.createFulfillment(
      { refnum: "REF-EXISTING", order_no: "YDD-1001" },
      itemFixture(),
      orderFixture(),
      {}
    )

    expect(syncSpy).not.toHaveBeenCalled()
    expect(addSpy).not.toHaveBeenCalled()
    expect(result.data.refnum).toBe("REF-EXISTING")
    expect(logger.info as jest.Mock).toHaveBeenCalled()
  })

  it("falls back to the medusa order id when display_id is missing", async () => {
    const syncSpy = jest
      .spyOn(IthinkClient.prototype, "syncOrders")
      .mockResolvedValue(["REF-1"])
    const service = new IthinkFulfillmentService({ logger }, dashboardOptions)

    await service.createFulfillment(
      {},
      itemFixture(),
      { ...orderFixture(), display_id: undefined },
      {}
    )

    const payload = syncSpy.mock.calls[0][0] as AddOrderParams[]
    expect(payload[0].orderNumber).toBe("YDD-ord_1")
  })

  it("propagates a syncOrders rejection as a MedusaError", async () => {
    jest
      .spyOn(IthinkClient.prototype, "syncOrders")
      .mockRejectedValue(
        new MedusaError(MedusaError.Types.INVALID_DATA, "iThink could not sync shipments: boom")
      )
    jest
      .spyOn(IthinkClient.prototype, "addOrder")
      .mockResolvedValue({
        status: "Success",
        remark: "ok",
        waybill: "IT00000001",
        refnum: "R1",
        logistic_name: "delhivery",
      })
    const service = new IthinkFulfillmentService({ logger }, dashboardOptions)

    const error = await service
      .createFulfillment({}, itemFixture(), orderFixture(), {})
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(MedusaError)
    expect((error as MedusaError).type).toBe(MedusaError.Types.INVALID_DATA)
    expect((error as MedusaError).message).toContain("boom")
  })

  it("throws a MedusaError without calling iThink when return_address_id is not configured", async () => {
    const syncSpy = jest.spyOn(IthinkClient.prototype, "syncOrders").mockResolvedValue([])
    const { return_address_id: _unused, ...noReturnOptions } = dashboardOptions
    const service = new IthinkFulfillmentService({ logger }, noReturnOptions)

    const error = await service
      .createFulfillment({}, itemFixture(), orderFixture(), {})
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(MedusaError)
    expect((error as MedusaError).type).toBe(MedusaError.Types.INVALID_DATA)
    expect(syncSpy).not.toHaveBeenCalled()
  })
})

describe("IthinkFulfillmentService cancelFulfillment", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns cancel-in-dashboard without calling the API when there is no AWB", async () => {
    const cancelSpy = jest.spyOn(IthinkClient.prototype, "cancelOrder").mockResolvedValue({})
    const service = new IthinkFulfillmentService({ logger }, dashboardOptions)

    const result = await service.cancelFulfillment({ refnum: "REF-1", order_no: "YDD-1001" })

    expect(result).toEqual({ cancelled: false, reason: "cancel-in-dashboard" })
    expect(cancelSpy).not.toHaveBeenCalled()
    expect(logger.info as jest.Mock).toHaveBeenCalled()
  })

  it("calls cancelOrder with the stored AWB when present", async () => {
    const cancelSpy = jest.spyOn(IthinkClient.prototype, "cancelOrder").mockResolvedValue({})
    const service = new IthinkFulfillmentService({ logger }, dashboardOptions)

    await service.cancelFulfillment({ awb: "IT00000001" })

    expect(cancelSpy).toHaveBeenCalledWith(["IT00000001"])
  })
})

describe("IthinkFulfillmentService book-mode createFulfillment", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("keeps book mode on order/add.json with the carrier and AWB in the result", async () => {
    const addSpy = jest
      .spyOn(IthinkClient.prototype, "addOrder")
      .mockResolvedValue({
        status: "Success",
        remark: "ok",
        waybill: "IT00000001",
        refnum: "R1",
        logistic_name: "delhivery",
      })
    const syncSpy = jest.spyOn(IthinkClient.prototype, "syncOrders").mockResolvedValue([])
    const service = new IthinkFulfillmentService({ logger }, bookOptions)

    const result = await service.createFulfillment(
      { logistic_name: "delhivery", weight_kg: "0.5" },
      itemFixture(),
      orderFixture(),
      {}
    )

    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).not.toHaveBeenCalled()
    const params = addSpy.mock.calls[0][0] as AddOrderParams
    expect(params.logistics).toBe("Delhivery")
    expect(params.orderNumber).toBe("1001")
    expect(result.data.awb).toBe("IT00000001")
    expect(result.data.refnum).toBe("R1")
  })
})
