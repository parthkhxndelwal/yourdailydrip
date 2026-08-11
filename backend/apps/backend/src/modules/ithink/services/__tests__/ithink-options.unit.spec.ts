import type { Logger } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { IthinkFulfillmentService } from "../ithink-fulfillment"
import { resolveProviderOptions } from "../mappers"
import type { IthinkProviderOptions } from "../mappers"

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger

const baseOptions: IthinkProviderOptions = {
  base_url: "https://pre-alpha.ithinklogistics.com/api_v3",
  access_token: "tok-test",
  secret_key: "key-test",
  pickup_address_id: "addr-test",
}

describe("IthinkFulfillmentService mode options", () => {
  it("getMode() returns dashboard when no mode option is passed", () => {
    const service = new IthinkFulfillmentService({ logger }, baseOptions)
    expect(service.getMode()).toBe("dashboard")
  })

  it("getMode() returns book when the mode option is book", () => {
    const service = new IthinkFulfillmentService({ logger }, { ...baseOptions, mode: "book" })
    expect(service.getMode()).toBe("book")
  })

  it("rejects an invalid mode value with a typed MedusaError", () => {
    const options = { ...baseOptions, mode: "invalid" } as unknown as IthinkProviderOptions
    let error: unknown
    try {
      resolveProviderOptions(options)
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(MedusaError)
    expect((error as MedusaError).type).toBe(MedusaError.Types.INVALID_DATA)
  })

  it("rejects an invalid mode value in the provider constructor", () => {
    const options = { ...baseOptions, mode: "invalid" } as unknown as IthinkProviderOptions
    expect(() => new IthinkFulfillmentService({ logger }, options)).toThrow(MedusaError)
  })
})

describe("IthinkFulfillmentService getOptions", () => {
  it("returns the resolved options with mode, order_no_prefix, and poll_enabled defaults", () => {
    const service = new IthinkFulfillmentService(
      { logger },
      { ...baseOptions, return_address_id: "return-1" }
    )
    expect(service.getOptions()).toEqual({
      ...baseOptions,
      return_address_id: "return-1",
      mode: "dashboard",
      order_no_prefix: "",
      poll_enabled: true,
    })
  })

  it("preserves explicitly passed mode, order_no_prefix, and poll_enabled", () => {
    const service = new IthinkFulfillmentService(
      { logger },
      { ...baseOptions, mode: "book", order_no_prefix: "YDD-", poll_enabled: false }
    )
    expect(service.getOptions()).toEqual({
      ...baseOptions,
      mode: "book",
      order_no_prefix: "YDD-",
      poll_enabled: false,
    })
  })
})

describe("resolveProviderOptions", () => {
  it("keeps existing option keys unchanged", () => {
    const resolved = resolveProviderOptions({
      ...baseOptions,
      gst_number: "27ABCDE1234F1Z5",
      default_weight_kg: 1,
    })
    expect(resolved.pickup_address_id).toBe("addr-test")
    expect(resolved.gst_number).toBe("27ABCDE1234F1Z5")
    expect(resolved.default_weight_kg).toBe(1)
  })
})
