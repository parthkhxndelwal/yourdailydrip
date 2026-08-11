import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { GET } from "../route"

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

function fakeRequest(storeModule: unknown): MedusaRequest {
  return {
    scope: { resolve: (key: string) => (key === Modules.STORE ? storeModule : undefined) },
  } as unknown as MedusaRequest
}

function storeModule(metadata: Record<string, unknown> | null): {
  listStores: jest.Mock
  module: { listStores: jest.Mock }
} {
  const listStores = jest.fn(async () => [{ id: "store_1", metadata }])
  return { listStores, module: { listStores } }
}

describe("GET /store/announcement", () => {
  it("returns the announcement config when the store metadata is valid", async () => {
    const { listStores, module } = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: "2026-08-31T23:59:59Z",
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      text: "Flat 15% off this weekend",
      ends_at: "2026-08-31T23:59:59Z",
    })
    expect(listStores).toHaveBeenCalledWith({}, { take: 1, select: ["id", "metadata"] })
  })

  it("returns nulls when the announcement_bar key is missing", async () => {
    const { module } = storeModule({})
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null })
  })

  it("returns nulls when the store has no metadata at all", async () => {
    const { module } = storeModule(null)
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null })
  })

  it("returns nulls when ends_at is not parseable as a date", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: "not-a-date",
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null })
  })

  it("returns nulls when text is empty", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: "",
        ends_at: "2026-08-31T23:59:59Z",
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null })
  })

  it("returns nulls when text is not a string", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: 42,
        ends_at: "2026-08-31T23:59:59Z",
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null })
  })

  it("returns nulls when announcement_bar is malformed", async () => {
    const { module } = storeModule({
      announcement_bar: "flat 15% off",
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null })
  })

  it("returns 502 when the store module service throws", async () => {
    const listStores = jest.fn(async () => {
      throw new Error("store module down")
    })
    const res = fakeResponse()

    await GET(fakeRequest({ listStores }), res)

    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: "announcement_unavailable" })
  })
})
