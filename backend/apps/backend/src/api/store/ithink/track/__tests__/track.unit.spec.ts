import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { FulfillmentDTO } from "@medusajs/framework/types"
import type { NormalizedTrackShipment } from "../../../../../modules/ithink/services/tracking"
import { GET } from "../route"

const PAGE_SIZE = 20

function fakeResponse(): MedusaResponse & { statusCode: number; body: unknown } {
  let statusCode = 200
  let body: unknown
  const res = {
    status(code: number) {
      statusCode = code
      return res
    },
    json(payload: unknown) {
      body = payload
      return res
    },
  } as unknown as MedusaResponse & { statusCode: number; body: unknown }
  Object.defineProperty(res, "statusCode", { get: () => statusCode })
  Object.defineProperty(res, "body", { get: () => body })
  return res
}

function fakeRequest(query: Record<string, unknown>, fulfillmentModule: unknown): MedusaRequest {
  return {
    query,
    scope: { resolve: () => fulfillmentModule },
  } as unknown as MedusaRequest
}

function fulfillmentFixture(awb?: string, orderNo?: string, metadata: Record<string, unknown> | null = null): FulfillmentDTO {
  return {
    id: `ful_${awb ?? orderNo ?? "unknown"}`,
    location_id: "loc_1",
    packed_at: null,
    shipped_at: null,
    delivered_at: null,
    canceled_at: null,
    created_by: null,
    data: {
      provider: "ithink",
      mode: "dashboard",
      refnum: "REF-1",
      ...(awb ? { awb } : {}),
      ...(orderNo ? { order_no: orderNo } : {}),
    },
    provider_id: "ithink",
    shipping_option_id: null,
    metadata,
    shipping_option: null,
    requires_shipping: true,
    provider: {} as FulfillmentDTO["provider"],
    delivery_address: {} as FulfillmentDTO["delivery_address"],
    items: [],
    labels: [],
    created_at: new Date("2026-08-01T10:00:00Z"),
    updated_at: new Date("2026-08-01T10:00:00Z"),
    deleted_at: null,
  }
}

function snapshotFixture(): NormalizedTrackShipment {
  return {
    awb: "IT00000105",
    status: "In Transit",
    statusCode: "INT",
    expectedDeliveryDate: "2026-08-05",
    promiseDeliveryDate: "2026-08-04",
    terminal: false,
    scans: [
      {
        status: "In Transit",
        statusCode: "INT",
        location: "Delhi Hub",
        remark: "Shipment in transit",
        at: "2026-08-03T09:30:00Z",
      },
    ],
  }
}

function paginatedModule(pages: FulfillmentDTO[][]): {
  listFulfillments: jest.Mock
  module: { listFulfillments: (filters: unknown, config: unknown) => Promise<FulfillmentDTO[]> }
} {
  const listFulfillments = jest.fn(async (_filters: unknown, config: { skip?: number }) => {
    const skip = config?.skip ?? 0
    return pages[Math.floor(skip / PAGE_SIZE)] ?? []
  })
  return { listFulfillments, module: { listFulfillments } }
}

describe("GET /store/ithink/track", () => {
  it("paginates past page 1 to find an AWB at offset 105 and returns its snapshot", async () => {
    const target = fulfillmentFixture("IT00000105", undefined, {
      ithink_tracking: snapshotFixture(),
    })
    const pages: FulfillmentDTO[][] = []
    for (let i = 0; i < 120; i++) {
      const pageIndex = Math.floor(i / PAGE_SIZE)
      pages[pageIndex] ??= []
      pages[pageIndex].push(
        i === 105 ? target : fulfillmentFixture(`IT${String(i).padStart(8, "0")}`)
      )
    }
    const { listFulfillments, module } = paginatedModule(pages)
    const res = fakeResponse()

    await GET(fakeRequest({ awb: "IT00000105" }, module), res)

    expect(res.statusCode).toBe(200)
    expect(JSON.stringify(res.body)).toBe(JSON.stringify(snapshotFixture()))
    const skips = listFulfillments.mock.calls.map((call) => (call[1] as { skip?: number }).skip)
    expect(skips).toEqual([0, 20, 40, 60, 80, 100])
    expect(listFulfillments).toHaveBeenCalledTimes(6)
    const firstConfig = listFulfillments.mock.calls[0][1] as { take?: number }
    expect(firstConfig.take).toBe(PAGE_SIZE)
  })

  it("returns the pending shape (200) for an order_no lookup of a synced-but-unbooked fulfillment", async () => {
    const pending = fulfillmentFixture(undefined, "YDD-1001")
    const { module } = paginatedModule([[pending]])
    const res = fakeResponse()

    await GET(fakeRequest({ order_no: "YDD-1001" }, module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      state: "pending",
      refnum: "REF-1",
      order_no: "YDD-1001",
      provider: "ithink",
      message: "Order synced with logistics provider. Tracking AWB will appear once the courier dispatches it.",
    })
  })

  it("returns 404 when no fulfillment matches the AWB", async () => {
    const { module } = paginatedModule([[fulfillmentFixture("IT00000001")]])
    const res = fakeResponse()

    await GET(fakeRequest({ awb: "IT99999999" }, module), res)

    expect(res.statusCode).toBe(404)
  })

  it("returns the snapshot payload unchanged when a book-mode AWB has no snapshot yet", async () => {
    const fulfillment = fulfillmentFixture("IT00000001")
    const { module } = paginatedModule([[fulfillment]])
    const res = fakeResponse()

    await GET(fakeRequest({ awb: "IT00000001" }, module), res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      message: "Tracking information is not available for this shipment yet",
    })
  })

  it("returns 400 when neither awb nor order_no is provided", async () => {
    const { module } = paginatedModule([])
    const res = fakeResponse()

    await GET(fakeRequest({}, module), res)

    expect(res.statusCode).toBe(400)
  })

  it("stops paging when a page returns fewer than PAGE_SIZE fulfillments", async () => {
    const target = fulfillmentFixture(undefined, "YDD-42")
    const { listFulfillments, module } = paginatedModule([
      Array.from({ length: PAGE_SIZE }, (_, i) => fulfillmentFixture(`IT${String(i).padStart(8, "0")}`)),
      [target],
    ])
    const res = fakeResponse()

    await GET(fakeRequest({ order_no: "YDD-42" }, module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ state: "pending" })
    expect(listFulfillments).toHaveBeenCalledTimes(2)
  })
})
