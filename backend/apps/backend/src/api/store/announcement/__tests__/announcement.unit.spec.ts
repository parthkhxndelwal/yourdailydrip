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
      show_countdown: true,
      link: null,
    })
    expect(listStores).toHaveBeenCalledWith({}, { take: 1, select: ["id", "metadata"] })
  })

  it("returns nulls when the announcement_bar key is missing", async () => {
    const { module } = storeModule({})
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null, show_countdown: true, link: null })
  })

  it("returns nulls when the store has no metadata at all", async () => {
    const { module } = storeModule(null)
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null, show_countdown: true, link: null })
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
    expect(res.body).toEqual({ text: null, ends_at: null, show_countdown: true, link: null })
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
    expect(res.body).toEqual({ text: null, ends_at: null, show_countdown: true, link: null })
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
    expect(res.body).toEqual({ text: null, ends_at: null, show_countdown: true, link: null })
  })

  it("returns nulls when announcement_bar is malformed", async () => {
    const { module } = storeModule({
      announcement_bar: "flat 15% off",
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: null, ends_at: null, show_countdown: true, link: null })
  })

  it("treats an empty ends_at as no countdown without invalidating the config", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: "",
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      text: "Flat 15% off this weekend",
      ends_at: null,
      show_countdown: true,
      link: null,
    })
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

  it("defaults show_countdown to true and link to null for legacy configs", async () => {
    const { module } = storeModule({
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
      show_countdown: true,
      link: null,
    })
  })

  it("honors show_countdown false", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: "2026-08-31T23:59:59Z",
        show_countdown: false,
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      text: "Flat 15% off this weekend",
      ends_at: "2026-08-31T23:59:59Z",
      show_countdown: false,
      link: null,
    })
  })

  it("returns link null when show_link is false", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: "2026-08-31T23:59:59Z",
        link_label: "Shop now",
        link_url: "https://yourdailydrip.com/shop",
        show_link: false,
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      text: "Flat 15% off this weekend",
      ends_at: "2026-08-31T23:59:59Z",
      show_countdown: true,
      link: null,
    })
  })

  it("returns the link object when show_link is true with a label and url", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: "2026-08-31T23:59:59Z",
        show_countdown: false,
        link_label: "Shop now",
        link_url: "https://yourdailydrip.com/shop",
        show_link: true,
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      text: "Flat 15% off this weekend",
      ends_at: "2026-08-31T23:59:59Z",
      show_countdown: false,
      link: { label: "Shop now", url: "https://yourdailydrip.com/shop" },
    })
  })

  it("returns link null when show_link is true but label or url is missing or empty", async () => {
    const missingLabel = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: "2026-08-31T23:59:59Z",
        link_url: "https://yourdailydrip.com/shop",
        show_link: true,
      },
    })
    const res1 = fakeResponse()
    await GET(fakeRequest(missingLabel.module), res1)
    expect(res1.statusCode).toBe(200)
    expect(res1.body).toEqual({
      text: "Flat 15% off this weekend",
      ends_at: "2026-08-31T23:59:59Z",
      show_countdown: true,
      link: null,
    })

    const emptyUrl = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: "2026-08-31T23:59:59Z",
        link_label: "Shop now",
        link_url: "   ",
        show_link: true,
      },
    })
    const res2 = fakeResponse()
    await GET(fakeRequest(emptyUrl.module), res2)
    expect(res2.statusCode).toBe(200)
    expect(res2.body).toEqual({
      text: "Flat 15% off this weekend",
      ends_at: "2026-08-31T23:59:59Z",
      show_countdown: true,
      link: null,
    })
  })

  it("accepts a null ends_at", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: "Flat 15% off this weekend",
        ends_at: null,
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      text: "Flat 15% off this weekend",
      ends_at: null,
      show_countdown: true,
      link: null,
    })
  })

  it("returns all nulls with default show_countdown when text is invalid", async () => {
    const { module } = storeModule({
      announcement_bar: {
        text: "",
        ends_at: "2026-08-31T23:59:59Z",
        show_countdown: false,
        link_label: "Shop now",
        link_url: "https://yourdailydrip.com/shop",
        show_link: true,
      },
    })
    const res = fakeResponse()

    await GET(fakeRequest(module), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      text: null,
      ends_at: null,
      show_countdown: true,
      link: null,
    })
  })
})
