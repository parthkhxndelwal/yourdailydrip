import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { blockMixedPreorderCart } from "../middlewares"

function requestMock(
  deps: Record<string, unknown>,
  body: unknown,
  params: Record<string, string>
): MedusaRequest {
  return {
    body,
    params,
    scope: { resolve: (key: string) => deps[key] },
  } as unknown as MedusaRequest
}

const logger = { warn: jest.fn() }

function depsFor(query: { graph: jest.Mock }) {
  return {
    [ContainerRegistrationKeys.QUERY]: query,
    [ContainerRegistrationKeys.LOGGER]: logger,
  }
}

describe("blockMixedPreorderCart middleware", () => {
  beforeEach(() => {
    logger.warn.mockClear()
  })

  it("passes through when variant_id is missing", async () => {
    const graph = jest.fn()
    const next = jest.fn()
    const req = requestMock(depsFor({ graph }), {}, { id: "cart_1" })

    await blockMixedPreorderCart(
      req,
      {} as MedusaResponse,
      next as unknown as MedusaNextFunction
    )

    expect(graph).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("fails open when the preorder_variant query errors (e.g. table missing)", async () => {
    const graph = jest
      .fn()
      .mockRejectedValue(new Error('relation "preorder_variant" does not exist'))
    const next = jest.fn()
    const req = requestMock(
      depsFor({ graph }),
      { variant_id: "variant_1" },
      { id: "cart_1" }
    )

    await blockMixedPreorderCart(
      req,
      {} as MedusaResponse,
      next as unknown as MedusaNextFunction
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("blockMixedPreorderCart skipped")
    )
  })

  it("still rejects mixing a preorder item into a cart with in-stock items", async () => {
    const graph = jest
      .fn()
      .mockResolvedValueOnce({ data: [{ variant_id: "variant_pre" }] })
      .mockResolvedValueOnce({ data: [{ items: [{ variant_id: "variant_normal" }] }] })
      .mockResolvedValueOnce({ data: [] })
    const next = jest.fn()
    const req = requestMock(
      depsFor({ graph }),
      { variant_id: "variant_pre" },
      { id: "cart_1" }
    )

    await expect(
      blockMixedPreorderCart(
        req,
        {} as MedusaResponse,
        next as unknown as MedusaNextFunction
      )
    ).rejects.toThrow(MedusaError)
    expect(next).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })
})
