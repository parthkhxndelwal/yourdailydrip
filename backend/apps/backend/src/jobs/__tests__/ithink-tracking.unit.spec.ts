import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  FulfillmentEvents,
  Modules,
} from "@medusajs/framework/utils"
import { IthinkClient } from "../../modules/ithink/clients/ithink-client"
import type { OrderDetails } from "../../modules/ithink/clients/types"
import type { IthinkProviderOptions } from "../../modules/ithink/services/mappers"
import ithinkTrackingPoll from "../ithink-tracking"

const baseOptions: IthinkProviderOptions = {
  base_url: "https://pre-alpha.ithinklogistics.com/api_v3",
  access_token: "tok-test",
  secret_key: "key-test",
  pickup_address_id: "addr-test",
  mode: "dashboard",
  order_no_prefix: "YDD-",
  poll_enabled: true,
}

function fulfillment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ful_1",
    provider_id: "ithink",
    shipping_option_id: "so_1",
    data: { provider: "ithink", mode: "dashboard", order_no: "YDD-1001", refnum: "REF-1" },
    metadata: null,
    created_at: new Date("2026-08-01T10:00:00Z"),
    updated_at: new Date("2026-08-01T10:00:00Z"),
    ...overrides,
  }
}

function awbFulfillment(awb: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return fulfillment({
    id: `ful_${awb}`,
    data: { awb },
    ...overrides,
  })
}

type Deps = {
  logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock }
  fulfillment: {
    listFulfillments: jest.Mock
    updateFulfillment: jest.Mock
  }
  eventBus: { emit: jest.Mock }
  provider: { getOptions: jest.Mock }
}

function makeDeps(options: Partial<IthinkProviderOptions> = {}): Deps {
  return {
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    fulfillment: {
      listFulfillments: jest.fn().mockResolvedValue([]),
      updateFulfillment: jest.fn().mockResolvedValue({ id: "ful_1" }),
    },
    eventBus: { emit: jest.fn().mockResolvedValue({}) },
    provider: { getOptions: jest.fn().mockReturnValue({ ...baseOptions, ...options }) },
  }
}

function makeContainer(deps: Deps): MedusaContainer {
  const registry: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: deps.logger,
    fp_ithink_ithink: deps.provider,
    [Modules.FULFILLMENT]: deps.fulfillment,
    [Modules.EVENT_BUS]: deps.eventBus,
  }
  return {
    resolve: (key: string): unknown => {
      if (!(key in registry)) {
        throw new Error(`container has no ${key}`)
      }
      return registry[key]
    },
  } as unknown as MedusaContainer
}

function run(deps: Deps): Promise<void> {
  return ithinkTrackingPoll(makeContainer(deps))
}

function updateInput(
  deps: Deps,
  callIndex = 0
): {
  metadata: {
    ithink_tracking: {
      awb_no?: string
      logistic?: string
      latest_courier_status?: string
      expected_delivery_date?: string
      tracked_at?: string
    }
  }
} & Record<string, unknown> {
  return deps.fulfillment.updateFulfillment.mock.calls[callIndex][1] as {
    metadata: {
      ithink_tracking: {
        awb_no?: string
        logistic?: string
        latest_courier_status?: string
        expected_delivery_date?: string
        tracked_at?: string
      }
    }
  } & Record<string, unknown>
}

describe("ithink-tracking reconciliation job", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("short-circuits when poll_enabled is false", async () => {
    const deps = makeDeps({ poll_enabled: false })

    await run(deps)

    expect(deps.fulfillment.listFulfillments).not.toHaveBeenCalled()
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("poll_enabled"))
  })

  it("logs and returns when the ithink provider is not resolvable", async () => {
    const deps = makeDeps()
    const registry: Record<string, unknown> = {
      [ContainerRegistrationKeys.LOGGER]: deps.logger,
      [Modules.FULFILLMENT]: deps.fulfillment,
      [Modules.EVENT_BUS]: deps.eventBus,
    }
    const container = {
      resolve: (key: string): unknown => {
        if (!(key in registry)) {
          throw new Error(`container has no ${key}`)
        }
        return registry[key]
      },
    } as unknown as MedusaContainer

    await ithinkTrackingPoll(container)

    expect(deps.fulfillment.listFulfillments).not.toHaveBeenCalled()
    expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringContaining("provider"))
  })

  it("discovers the AWB via get_details and updates the fulfillment data", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([fulfillment()])
    const details: OrderDetails[] = [
      {
        order_no: "YDD-1001",
        awb_no: "IT0001",
        logistic: "Delhivery",
        latest_courier_status: "Manifested",
        expected_delivery_date: "2026-08-05",
      },
    ]
    const detailsSpy = jest
      .spyOn(IthinkClient.prototype, "getOrderDetails")
      .mockResolvedValue(details)

    await run(deps)

    expect(detailsSpy).toHaveBeenCalledWith(["YDD-1001"])
    expect(deps.fulfillment.updateFulfillment).toHaveBeenCalledTimes(1)
    const input = updateInput(deps)
    expect(input.data).toMatchObject({
      awb: "IT0001",
      logistic: "Delhivery",
      latest_courier_status: "Manifested",
      expected_delivery_date: "2026-08-05",
      order_no: "YDD-1001",
    })
    expect(input.shipped_at).toBeInstanceOf(Date)
    expect(deps.eventBus.emit).toHaveBeenCalledWith({
      name: FulfillmentEvents.FULFILLMENT_UPDATED,
      data: { id: "ful_1" },
    })
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("emitted"))
  })

  it("leaves fulfillments pending when get_details has no AWB for the order", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([fulfillment()])
    jest.spyOn(IthinkClient.prototype, "getOrderDetails").mockResolvedValue([])

    await run(deps)

    expect(deps.fulfillment.updateFulfillment).not.toHaveBeenCalled()
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("pending"))
    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("1 pending")
    )
  })

  it("paginates with take 20 until the pages are exhausted", async () => {
    const deps = makeDeps()
    const all = Array.from({ length: 41 }, (_, index) =>
      fulfillment({ id: `ful_${index}`, data: { provider: "ithink", order_no: `YDD-${index}` } })
    )
    deps.fulfillment.listFulfillments.mockImplementation(
      async (_filters: unknown, options: { take: number; skip: number }) =>
        all.slice(options.skip, options.skip + options.take)
    )
    jest.spyOn(IthinkClient.prototype, "getOrderDetails").mockResolvedValue([])

    await run(deps)

    expect(deps.fulfillment.listFulfillments).toHaveBeenCalledWith(
      { provider_id: "ithink" },
      { take: 20, skip: 0 }
    )
    expect(deps.fulfillment.listFulfillments).toHaveBeenCalledWith(
      { provider_id: "ithink" },
      { take: 20, skip: 20 }
    )
    expect(deps.fulfillment.listFulfillments).toHaveBeenCalledWith(
      { provider_id: "ithink" },
      { take: 20, skip: 40 }
    )
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("41 pending"))
  })

  it("selects dashboard-mode and legacy book-mode fulfillments only", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([
      fulfillment({ id: "ful_dash", data: { provider: "ithink", order_no: "YDD-1" } }),
      awbFulfillment("IT-L1", { id: "ful_legacy" }),
      awbFulfillment("IT-L2", { id: "ful_manual", provider_id: "manual" }),
      fulfillment({ id: "ful_other", provider_id: "manual", data: { provider: "manual" } }),
    ])
    const detailsSpy = jest
      .spyOn(IthinkClient.prototype, "getOrderDetails")
      .mockResolvedValue([{ order_no: "YDD-1", awb_no: "IT-D1" }])
    const windowSpy = jest
      .spyOn(IthinkClient.prototype, "getAwbsInWindow")
      .mockResolvedValue(["IT-L1"])
    const trackSpy = jest
      .spyOn(IthinkClient.prototype, "trackShipments")
      .mockResolvedValue([
        { awb_no: "IT-L1", current_status: "In Transit", current_status_code: "INT" },
      ])

    await run(deps)

    expect(detailsSpy).toHaveBeenCalledWith(["YDD-1"])
    expect(windowSpy).toHaveBeenCalledTimes(1)
    expect(trackSpy).toHaveBeenCalledWith(["IT-L1"])
    const updatedIds = deps.fulfillment.updateFulfillment.mock.calls.map(
      (call) => call[0] as string
    )
    expect(updatedIds).toEqual(expect.arrayContaining(["ful_dash", "ful_legacy"]))
    expect(updatedIds).not.toContain("ful_manual")
    expect(updatedIds).not.toContain("ful_other")
  })

  it("enriches tracked AWBs and writes the tracking snapshot", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([
      awbFulfillment("IT0001", { data: { awb: "IT0001", logistic: "Delhivery" } }),
    ])
    jest.spyOn(IthinkClient.prototype, "getAwbsInWindow").mockResolvedValue(["IT0001"])
    jest.spyOn(IthinkClient.prototype, "trackShipments").mockResolvedValue([
      {
        awb_no: "IT0001",
        current_status: "In Transit",
        current_status_code: "INT",
        expected_delivery_date: "2026-08-05",
      },
    ])

    await run(deps)

    expect(deps.fulfillment.updateFulfillment).toHaveBeenCalledTimes(1)
    const input = updateInput(deps)
    expect(input.metadata.ithink_tracking).toMatchObject({
      awb_no: "IT0001",
      logistic: "Delhivery",
      latest_courier_status: "In Transit",
      expected_delivery_date: "2026-08-05",
    })
    expect(input.metadata.ithink_tracking.tracked_at).toEqual(expect.any(String))
    expect(input.shipped_at).toBeInstanceOf(Date)
  })

  it("sets shipped_at once and never overwrites an existing timestamp", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([
      awbFulfillment("IT0001", {
        shipped_at: new Date("2026-08-02T10:00:00Z"),
        data: { awb: "IT0001" },
      }),
    ])
    jest.spyOn(IthinkClient.prototype, "getAwbsInWindow").mockResolvedValue(["IT0001"])
    jest.spyOn(IthinkClient.prototype, "trackShipments").mockResolvedValue([
      { awb_no: "IT0001", current_status: "In Transit", current_status_code: "INT" },
    ])

    await run(deps)

    expect(deps.fulfillment.updateFulfillment).toHaveBeenCalledTimes(1)
    expect(updateInput(deps)).not.toHaveProperty("shipped_at")
  })

  it("sets delivered_at on DL status and does not re-write an unchanged snapshot", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([
      awbFulfillment("IT0001", { data: { awb: "IT0001" } }),
    ])
    jest.spyOn(IthinkClient.prototype, "getAwbsInWindow").mockResolvedValue(["IT0001"])
    const shipment = {
      awb_no: "IT0001",
      current_status: "Delivered",
      current_status_code: "DL",
    }
    jest.spyOn(IthinkClient.prototype, "trackShipments").mockResolvedValue([shipment])

    await run(deps)

    expect(deps.fulfillment.updateFulfillment).toHaveBeenCalledTimes(1)
    expect(updateInput(deps).delivered_at).toBeInstanceOf(Date)

    // Second run: fulfillment carries delivered_at and the stored snapshot.
    const snapshot = updateInput(deps).metadata.ithink_tracking
    deps.fulfillment.updateFulfillment.mockClear()
    deps.fulfillment.listFulfillments.mockResolvedValue([
      awbFulfillment("IT0001", {
        delivered_at: new Date("2026-08-06T10:00:00Z"),
        data: { awb: "IT0001" },
        metadata: { ithink_tracking: snapshot },
      }),
    ])

    await run(deps)

    expect(deps.fulfillment.updateFulfillment).not.toHaveBeenCalled()
  })

  it("snapshots terminal statuses without writing timestamps", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([
      awbFulfillment("IT0001", { data: { awb: "IT0001" } }),
    ])
    jest.spyOn(IthinkClient.prototype, "getAwbsInWindow").mockResolvedValue(["IT0001"])
    jest.spyOn(IthinkClient.prototype, "trackShipments").mockResolvedValue([
      { awb_no: "IT0001", current_status: "Cancelled", current_status_code: "CN" },
    ])

    await run(deps)

    expect(deps.fulfillment.updateFulfillment).toHaveBeenCalledTimes(1)
    const input = updateInput(deps)
    expect(input.metadata.ithink_tracking.latest_courier_status).toBe("Cancelled")
    expect(input).not.toHaveProperty("shipped_at")
    expect(input).not.toHaveProperty("delivered_at")
  })

  it("does not call getOrderDetails when every fulfillment already has an AWB", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([
      awbFulfillment("IT0001"),
      awbFulfillment("IT0002"),
    ])
    const detailsSpy = jest
      .spyOn(IthinkClient.prototype, "getOrderDetails")
      .mockResolvedValue([])
    jest.spyOn(IthinkClient.prototype, "getAwbsInWindow").mockResolvedValue([])

    await run(deps)

    expect(detailsSpy).not.toHaveBeenCalled()
    expect(deps.fulfillment.updateFulfillment).not.toHaveBeenCalled()
  })

  it("continues with remaining chunks when one trackShipments chunk fails", async () => {
    const deps = makeDeps()
    const awbs = Array.from({ length: 12 }, (_, index) => `IT${String(index + 1).padStart(4, "0")}`)
    deps.fulfillment.listFulfillments.mockResolvedValue(
      awbs.map((awb) => awbFulfillment(awb))
    )
    jest.spyOn(IthinkClient.prototype, "getAwbsInWindow").mockResolvedValue(awbs)
    jest
      .spyOn(IthinkClient.prototype, "trackShipments")
      .mockImplementation(async (chunk: string[]) => {
        if (chunk.length === 10) {
          throw new Error("chunk boom")
        }
        return chunk.map((awb) => ({
          awb_no: awb,
          current_status: "In Transit",
          current_status_code: "INT",
        }))
      })

    await expect(run(deps)).resolves.toBeUndefined()

    expect(deps.fulfillment.updateFulfillment).toHaveBeenCalledTimes(2)
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("1 failed"))
  })

  it("isolates a getAwbsInWindow failure and still completes the run", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockResolvedValue([
      awbFulfillment("IT0001", { data: { awb: "IT0001" } }),
    ])
    const trackSpy = jest
      .spyOn(IthinkClient.prototype, "trackShipments")
      .mockResolvedValue([])
    jest
      .spyOn(IthinkClient.prototype, "getAwbsInWindow")
      .mockRejectedValue(new Error("window boom"))

    await expect(run(deps)).resolves.toBeUndefined()

    expect(trackSpy).not.toHaveBeenCalled()
    expect(deps.fulfillment.updateFulfillment).not.toHaveBeenCalled()
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("1 failed"))
  })

  it("completes without throwing when a listFulfillments page fails", async () => {
    const deps = makeDeps()
    deps.fulfillment.listFulfillments.mockRejectedValue(new Error("db boom"))

    await expect(run(deps)).resolves.toBeUndefined()

    expect(deps.logger.error).toHaveBeenCalledWith(expect.stringContaining("listFulfillments"))
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("1 failed"))
  })
})
