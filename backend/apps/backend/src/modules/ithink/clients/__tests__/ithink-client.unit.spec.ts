import type { Logger } from "@medusajs/framework/types"
import {
  IthinkClient,
  buildGetDetailsBody,
  buildOrderBody,
  buildRateBody,
  buildSyncOrderBody,
} from "../ithink-client"
import { IthinkFulfillmentService } from "../../services/ithink-fulfillment"
import { cartTotal } from "../../services/mappers"
import type { IthinkClientOptions, RateCheckParams } from "../types"

const options: IthinkClientOptions = {
  baseUrl: "https://pre-alpha.ithinklogistics.com/api_v3/",
  accessToken: "tok-test",
  secretKey: "key-test",
  pickupAddressId: "addr-test",
  defaultWeightKg: 0.5,
  defaultLengthCm: 20,
  defaultWidthCm: 15,
  defaultHeightCm: 10,
}

const rateParams: RateCheckParams = {
  fromPincode: "110001",
  toPincode: "560001",
  weightKg: 0.5,
  productMrp: 749,
}

function fakeResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

function fakeFetch(handler: (url: string, init: RequestInit) => unknown) {
  return (async (url: string, init: RequestInit) => {
    return fakeResponse(handler(url, init))
  }) as typeof fetch
}

function parseCapturedBody(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

describe("IthinkClient request envelope", () => {
  it("wraps every payload in a data key with credentials inside it and none in headers", async () => {
    let capturedInit: RequestInit | undefined
    const client = new IthinkClient({
      ...options,
      fetchImpl: (async (_url, init) => {
        capturedInit = init
        return fakeResponse({ status: "success", data: "yes" })
      }) as typeof fetch,
    })
    await client.checkPincode("560001")
    const body = parseCapturedBody(capturedInit!)
    expect(body).toEqual({
      data: {
        pincode: "560001",
        access_token: "tok-test",
        secret_key: "key-test",
      },
    })
    expect(capturedInit!.headers).toEqual({ "Content-Type": "application/json" })
    expect(Object.keys(body)).toEqual(["data"])
  })
})

describe("buildRateBody", () => {
  it("uses the V3 rate field names", () => {
    const body = buildRateBody({ ...rateParams, lengthCm: 20, widthCm: 15, heightCm: 10 })
    expect(body).toEqual({
      from_pincode: "110001",
      to_pincode: "560001",
      shipping_length_cms: "20",
      shipping_width_cms: "15",
      shipping_height_cms: "10",
      shipping_weight_kg: 0.5,
      order_type: "forward",
      payment_method: "Prepaid",
      product_mrp: 749,
    })
  })

  it("omits dimension fields when unknown", () => {
    const body = buildRateBody(rateParams)
    expect("shipping_length_cms" in body).toBe(false)
    expect("shipping_width_cms" in body).toBe(false)
    expect("shipping_height_cms" in body).toBe(false)
  })
})

describe("buildOrderBody", () => {
  const orderParams = {
    orderNumber: "1001",
    orderDate: "01-08-2026",
    totalAmount: 749,
    recipientName: "Jane Doe",
    addressLine1: "456 Elm St",
    pin: "560001",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    phone: "9876543210",
    email: "jane@example.com",
    paymentMode: "Prepaid" as const,
    shipmentLengthCm: 20,
    shipmentWidthCm: 15,
    shipmentHeightCm: 10,
    weightKg: 0.5,
    lines: [{ name: "Serum", sku: "SER-1", quantity: 1, price: 749 }],
    pickupAddressId: "addr-test",
    gstNumber: "27ABCDE1234F1Z5",
  }

  it("builds the V3 add-order body with shipments[] and product_* fields", () => {
    const body = buildOrderBody(orderParams)
    expect(body.shipments).toHaveLength(1)
    const shipment = (body.shipments as Record<string, unknown>[])[0]
    expect(shipment.order).toBe("1001")
    expect(shipment.payment_mode).toBe("Prepaid")
    expect(shipment.phone).toBe("9876543210")
    expect(shipment.alt_phone).toBe("9876543210")
    expect(shipment.first_attemp_discount).toBe("0")
    expect(shipment.cod_charges).toBe("0")
    expect(shipment.advance_amount).toBe("0")
    expect(shipment.cod_amount).toBe("0")
    expect(shipment.gst_number).toBe("27ABCDE1234F1Z5")
    expect(shipment.eway_bill_number).toBe("")
    expect(shipment.products).toEqual([
      { product_name: "Serum", product_sku: "SER-1", product_quantity: "1", product_price: "749" },
    ])
    expect(body.pickup_address_id).toBe("addr-test")
    expect(body.s_type).toBe("")
    expect(body.order_type).toBe("")
    expect("access_token" in body).toBe(false)
    expect("logistics" in body).toBe(false)
  })

  it("includes logistics when a carrier is selected", () => {
    const body = buildOrderBody({ ...orderParams, logistics: "delhivery" })
    expect(body.logistics).toBe("delhivery")
  })

  it("sends the return address id from the options parameter", () => {
    const body = buildOrderBody(orderParams, { returnAddressId: "return-1" })
    const shipment = (body.shipments as Record<string, unknown>[])[0]
    expect(shipment.return_address_id).toBe("return-1")
  })

  it("defaults return_address_id to an empty string for backward compatibility", () => {
    const body = buildOrderBody(orderParams)
    const shipment = (body.shipments as Record<string, unknown>[])[0]
    expect(shipment.return_address_id).toBe("")
  })

  it("sends reseller_name from the params, defaulting to an empty string", () => {
    const body = buildOrderBody({ ...orderParams, resellerName: "Daily Drip" })
    const shipment = (body.shipments as Record<string, unknown>[])[0]
    expect(shipment.reseller_name).toBe("Daily Drip")
    const plainBody = buildOrderBody(orderParams)
    const plainShipment = (plainBody.shipments as Record<string, unknown>[])[0]
    expect(plainShipment.reseller_name).toBe("")
  })
})

describe("buildSyncOrderBody", () => {
  it("matches the add-order payload shape without a logistics key", () => {
    const body = buildSyncOrderBody([orderParamsForAddOrder()], options)
    expect(body.shipments).toHaveLength(1)
    const shipment = (body.shipments as Record<string, unknown>[])[0]
    expect(shipment.order).toBe("1001")
    expect(shipment.payment_mode).toBe("Prepaid")
    expect(shipment.phone).toBe("9876543210")
    expect(shipment.alt_phone).toBe("9876543210")
    expect(shipment.gst_number).toBe("")
    expect(shipment.eway_bill_number).toBe("")
    expect(shipment.products).toEqual([
      { product_name: "Serum", product_sku: "", product_quantity: "1", product_price: "749" },
    ])
    expect(body.pickup_address_id).toBe("addr-test")
    expect(body.s_type).toBe("")
    expect(body.order_type).toBe("")
    expect("logistics" in body).toBe(false)
    expect(JSON.stringify(body)).not.toContain("logistics")
  })

  it("accepts a single order object", () => {
    const body = buildSyncOrderBody(orderParamsForAddOrder(), options)
    expect(body.shipments).toHaveLength(1)
  })

  it("sends the return address id from client options", () => {
    const body = buildSyncOrderBody(orderParamsForAddOrder(), {
      ...options,
      returnAddressId: "return-1",
    })
    const shipment = (body.shipments as Record<string, unknown>[])[0]
    expect(shipment.return_address_id).toBe("return-1")
  })

  it("sends reseller_name from client options", () => {
    const body = buildSyncOrderBody(orderParamsForAddOrder(), {
      ...options,
      resellerName: "Daily Drip",
    })
    const shipment = (body.shipments as Record<string, unknown>[])[0]
    expect(shipment.reseller_name).toBe("Daily Drip")
  })
})

describe("buildGetDetailsBody", () => {
  it("sends a comma-joined order_no list and no awb_number_list", () => {
    const body = buildGetDetailsBody(["YDD-1", "YDD-2", "YDD-3"])
    expect(body).toEqual({ order_no: "YDD-1,YDD-2,YDD-3" })
    expect("awb_number_list" in body).toBe(false)
  })
})

describe("cartTotal", () => {
  it("falls back to unit_price * quantity when item.total is an empty string", () => {
    const total = cartTotal([
      { unit_price: 549, quantity: 2, total: "" },
      { unit_price: 799, quantity: 1, total: "" },
    ] as unknown as Parameters<typeof cartTotal>[0])
    expect(total).toBe(549 * 2 + 799)
  })

  it("falls back to unit_price * quantity when item.total is zero", () => {
    const total = cartTotal([
      { unit_price: 549, quantity: 2, total: 0 },
    ] as unknown as Parameters<typeof cartTotal>[0])
    expect(total).toBe(549 * 2)
  })

  it("uses item.total when it is a valid non-zero number", () => {
    const total = cartTotal([
      { unit_price: 549, quantity: 2, total: 1200 },
    ] as unknown as Parameters<typeof cartTotal>[0])
    expect(total).toBe(1200)
  })

  it("returns 0 for an empty cart", () => {
    expect(cartTotal([])).toBe(0)
  })
})

describe("IthinkClient response parsing", () => {
  it("parses rate data returned as an array", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        data: [{ logistic_name: "delhivery", rate: 153.4 }],
      })),
    })
    const result = await client.checkRate(rateParams)
    expect(result.rates).toHaveLength(1)
    expect(result.rates[0].logistic_name).toBe("delhivery")
    expect(result.rates[0].rate).toBe(153.4)
  })

  it("parses rate data returned as an index-keyed object", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        data: {
          "0": { logistic_name: "delhivery", rate: 153.4 },
          "1": { logistic_name: "xpressbees", rate: 160.0 },
        },
      })),
    })
    const result = await client.checkRate(rateParams)
    expect(result.rates).toHaveLength(2)
    expect(result.rates[0].logistic_name).toBe("delhivery")
    expect(result.rates[1].logistic_name).toBe("xpressbees")
  })

  it("parses add-order data returned as an index-keyed object", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        data: {
          "1": {
            status: "Success",
            remark: "ok",
            waybill: "IT00000001",
            refnum: "R1",
            logistic_name: "delhivery",
          },
        },
      })),
    })
    const created = await client.addOrder({
      ...orderParamsForAddOrder(),
      logistics: "delhivery",
    })
    expect(created.waybill).toBe("IT00000001")
  })

  it("threads the client returnAddressId option into the add-order payload", async () => {
    let capturedInit: RequestInit | undefined
    const client = new IthinkClient({
      ...options,
      returnAddressId: "return-1",
      fetchImpl: (async (_url, init) => {
        capturedInit = init
        return fakeResponse({
          status: "success",
          data: {
            "1": {
              status: "Success",
              remark: "ok",
              waybill: "IT00000001",
              refnum: "R1",
              logistic_name: "delhivery",
            },
          },
        })
      }) as typeof fetch,
    })
    await client.addOrder(orderParamsForAddOrder())
    const envelope = parseCapturedBody(capturedInit!).data as Record<string, unknown>
    const shipment = (envelope.shipments as Record<string, unknown>[])[0]
    expect(shipment.return_address_id).toBe("return-1")
  })

  it("parses add-order data returned as an array", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        data: [
          {
            status: "Success",
            remark: "ok",
            waybill: "IT00000002",
            refnum: "R2",
            logistic_name: "xpressbees",
          },
        ],
      })),
    })
    const created = await client.addOrder(orderParamsForAddOrder())
    expect(created.waybill).toBe("IT00000002")
  })

  it("surfaces the iThink html_message when add-order validation fails", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        status_code: 200,
        html_message: "Shipment #1 reseller_name field must be present.",
        data: {
          "1": {
            status: "Failed",
            remark: "Shipment #1 reseller_name field must be present.",
          },
        },
      })),
    })
    await expect(client.addOrder(orderParamsForAddOrder())).rejects.toThrow(
      "Shipment #1 reseller_name field must be present."
    )
  })

  it("surfaces the entry remark when add-order fails without html_message", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        status_code: 200,
        data: {
          "1": {
            status: "Failed",
            remark: "Shipment #1 gst field must be present.",
          },
        },
      })),
    })
    await expect(client.addOrder(orderParamsForAddOrder())).rejects.toThrow(
      "Shipment #1 gst field must be present."
    )
  })

  it("implicates the carrier and payment mode when the pincode is not serviceable", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        status_code: 200,
        html_message: "",
        data: {
          "1": { status: "error", remark: "Pincode Not Serviceable." },
        },
      })),
    })
    await expect(
      client.addOrder({
        ...orderParamsForAddOrder(),
        logistics: "Delhivery",
        pin: "110006",
      })
    ).rejects.toThrow(/Delhivery.*Prepaid.*110006/)
  })

  it("implicates the wallet balance when iThink reports insufficient funds", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        status_code: 200,
        html_message: "",
        data: {
          "1": { status: "error", remark: "Insufficient wallet balance." },
        },
      })),
    })
    await expect(client.addOrder(orderParamsForAddOrder())).rejects.toThrow(/Recharge/)
  })

  it("sends A4 page size and display flags with the label request", async () => {
    let capturedInit: RequestInit | undefined
    const client = new IthinkClient({
      ...options,
      fetchImpl: (async (_url, init) => {
        capturedInit = init
        return fakeResponse({ status: "success", file_name: "https://cdn.ithinklogistics.com/label.pdf" })
      }) as typeof fetch,
    })
    await client.getLabel(["IT00000001"])
    expect(parseCapturedBody(capturedInit!)).toEqual({
      data: {
        awb_numbers: "IT00000001",
        page_size: "A4",
        display_cod_prepaid: "",
        display_shipper_mobile: "",
        display_shipper_address: "",
        access_token: "tok-test",
        secret_key: "key-test",
      },
    })
  })

  it("caps cancel requests at 100 awb_numbers inside the data envelope", async () => {
    let capturedInit: RequestInit | undefined
    const client = new IthinkClient({
      ...options,
      fetchImpl: (async (_url, init) => {
        capturedInit = init
        return fakeResponse({ status: "success", data: {} })
      }) as typeof fetch,
    })
    const manyAwbs = Array.from({ length: 120 }, (_, i) => `AWB${i}`)
    await client.cancelOrder(manyAwbs)
    const body = parseCapturedBody(capturedInit!)
    const data = body.data as Record<string, unknown>
    expect(String(data.awb_numbers).split(",")).toHaveLength(100)
  })

  it("nests get_awb window fields under data", async () => {
    let capturedInit: RequestInit | undefined
    const client = new IthinkClient({
      ...options,
      fetchImpl: (async (_url, init) => {
        capturedInit = init
        return fakeResponse({
          status: "success",
          "Awb list": [{ airway_bill_no: "IT00000001" }],
        })
      }) as typeof fetch,
    })
    const awbs = await client.getAwbsInWindow({
      startDateTime: "2026-08-01 10:00:00",
      endDateTime: "2026-08-01 10:30:00",
    })
    expect(awbs).toEqual(["IT00000001"])
    expect(parseCapturedBody(capturedInit!)).toEqual({
      data: {
        start_date_time: "2026-08-01 10:00:00",
        end_date_time: "2026-08-01 10:30:00",
        access_token: "tok-test",
        secret_key: "key-test",
      },
    })
  })

  it("treats a 'No Data found.' response as an empty AWB window", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "error",
        message: "No Data found.",
      })),
    })
    const awbs = await client.getAwbsInWindow({
      startDateTime: "2026-08-01 10:00:00",
      endDateTime: "2026-08-01 10:30:00",
    })
    expect(awbs).toEqual([])
  })

  it("still throws on other get_awb errors", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "error",
        message: "Invalid date window",
      })),
    })
    await expect(
      client.getAwbsInWindow({
        startDateTime: "bad",
        endDateTime: "bad",
      })
    ).rejects.toThrow("Invalid date window")
  })

  it("chunks tracking into 10 AWBs per request inside the data envelope", async () => {
    const captured: string[] = []
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch((_url, init) => {
        const body = parseCapturedBody(init)
        const data = body.data as Record<string, unknown>
        captured.push(String(data.awb_number_list))
        const requested = String(data.awb_number_list).split(",")
        const response: Record<string, unknown> = {}
        for (const awb of requested) {
          response[awb] = { awb_no: awb, current_status: "Picked Up", current_status_code: "PU" }
        }
        return { status: "success", data: response }
      }),
    })
    const awbs = Array.from({ length: 12 }, (_, i) => `IT${String(i + 1).padStart(7, "0")}`)
    const tracked = await client.trackShipments(awbs)
    expect(tracked).toHaveLength(12)
    expect(captured).toHaveLength(2)
    expect(captured[0]).toBe(awbs.slice(0, 10).join(","))
    expect(captured[1]).toBe(awbs.slice(10).join(","))
  })

  it("chunks syncOrders at 25 per request with auth inside the data envelope", async () => {
    const captured: Record<string, unknown>[] = []
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch((_url, init) => {
        const body = parseCapturedBody(init)
        captured.push(body)
        const data = body.data as Record<string, unknown>
        const shipments = data.shipments as Record<string, unknown>[]
        const response: Record<string, unknown> = {}
        shipments.forEach((shipment, index) => {
          response[String(index)] = { status: "Success", refnum: `REF-${shipment.order}` }
        })
        return { status: "success", data: response }
      }),
    })
    const orders = Array.from({ length: 26 }, (_, i) => ({
      ...orderParamsForAddOrder(),
      orderNumber: `YDD-${i + 1}`,
    }))
    const refnums = await client.syncOrders(orders)
    expect(refnums).toHaveLength(26)
    expect(refnums[0]).toBe("REF-YDD-1")
    expect(refnums[25]).toBe("REF-YDD-26")
    expect(captured).toHaveLength(2)
    expect((captured[0].data as Record<string, unknown>).shipments as unknown[]).toHaveLength(25)
    expect((captured[1].data as Record<string, unknown>).shipments as unknown[]).toHaveLength(1)
    const firstData = captured[0].data as Record<string, unknown>
    expect(firstData.access_token).toBe("tok-test")
    expect(firstData.secret_key).toBe("key-test")
    expect("logistics" in firstData).toBe(false)
    expect(JSON.stringify(captured[0])).not.toContain("logistics")
  })

  it("normalizes a sync error envelope to a MedusaError", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "error",
        message: "Invalid access token",
      })),
    })
    await expect(client.syncOrders([orderParamsForAddOrder()])).rejects.toThrow(
      "Invalid access token"
    )
  })

  it("surfaces the entry remark when a shipment fails to sync", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        status_code: 200,
        data: {
          "1": { status: "error", remark: "Pincode Not Serviceable." },
        },
      })),
    })
    await expect(client.syncOrders([orderParamsForAddOrder()])).rejects.toThrow(
      "Pincode Not Serviceable."
    )
  })

  it("keeps 500 order numbers in a single get_details request", async () => {
    const captured: Record<string, unknown>[] = []
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch((_url, init) => {
        const body = parseCapturedBody(init)
        captured.push(body)
        const data = body.data as Record<string, unknown>
        const orderNos = String(data.order_no).split(",")
        const response: Record<string, unknown> = {}
        for (const orderNo of orderNos) {
          response[orderNo] = { order: orderNo, awb_no: `AWB-${orderNo}` }
        }
        return { status: "success", data: response }
      }),
    })
    const orderNos = Array.from({ length: 500 }, (_, i) => `YDD-${i + 1}`)
    const details = await client.getOrderDetails(orderNos)
    expect(details).toHaveLength(500)
    expect(captured).toHaveLength(1)
    const data = captured[0].data as Record<string, unknown>
    expect(String(data.order_no).split(",")).toHaveLength(500)
    expect(data.awb_number_list).toBeUndefined()
  })

  it("splits 501 order numbers into two get_details requests", async () => {
    const captured: Record<string, unknown>[] = []
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch((_url, init) => {
        const body = parseCapturedBody(init)
        captured.push(body)
        const data = body.data as Record<string, unknown>
        const orderNos = String(data.order_no).split(",")
        const response: Record<string, unknown> = {}
        for (const orderNo of orderNos) {
          response[orderNo] = { order: orderNo }
        }
        return { status: "success", data: response }
      }),
    })
    const orderNos = Array.from({ length: 501 }, (_, i) => `YDD-${i + 1}`)
    const details = await client.getOrderDetails(orderNos)
    expect(details).toHaveLength(501)
    expect(captured).toHaveLength(2)
    expect(String((captured[0].data as Record<string, unknown>).order_no).split(",")).toHaveLength(500)
    expect(String((captured[1].data as Record<string, unknown>).order_no).split(",")).toHaveLength(1)
  })

  it("normalizes get_details entries with missing fields without throwing", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "success",
        data: {
          "YDD-1": { awb_no: "IT00000001" },
          "YDD-2": { logistic: "Delhivery", expected_delivery_date: "2026-08-18" },
          "YDD-3": { order: "YDD-3", latest_courier_status: "" },
        },
      })),
    })
    const details = await client.getOrderDetails(["YDD-1", "YDD-2", "YDD-3"])
    expect(details).toHaveLength(3)
    expect(details[0]).toEqual({
      order_no: "YDD-1",
      awb_no: "IT00000001",
      logistic: undefined,
      latest_courier_status: undefined,
      expected_delivery_date: undefined,
    })
    expect(details[1]).toEqual({
      order_no: "YDD-2",
      awb_no: undefined,
      logistic: "Delhivery",
      latest_courier_status: undefined,
      expected_delivery_date: "2026-08-18",
    })
    expect(details[2].order_no).toBe("YDD-3")
    expect(details[2].latest_courier_status).toBeUndefined()
  })

  it("treats a 'No Data found.' get_details response as an empty result", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "error",
        message: "No Data found.",
      })),
    })
    const details = await client.getOrderDetails(["YDD-1"])
    expect(details).toEqual([])
  })

  it("normalizes a get_details error envelope to a MedusaError", async () => {
    const client = new IthinkClient({
      ...options,
      fetchImpl: fakeFetch(() => ({
        status: "error",
        message: "Invalid order number",
      })),
    })
    await expect(client.getOrderDetails(["YDD-1"])).rejects.toThrow("Invalid order number")
  })

  it("makes no request for an empty order number list", async () => {
    const fetchMock = jest.fn()
    const client = new IthinkClient({ ...options, fetchImpl: fetchMock as typeof fetch })
    expect(await client.getOrderDetails([])).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("IthinkFulfillmentService.createFulfillment", () => {
  it("passes the selected logistics carrier into order/add.json data", async () => {
    let capturedInit: RequestInit | undefined
    const fetchMock = jest.fn(async (_url: unknown, init: RequestInit) => {
      capturedInit = init
      return fakeResponse({
        status: "success",
        status_code: 200,
        data: {
          "1": {
            status: "Success",
            remark: "ok",
            waybill: "IT00000001",
            refnum: "R1",
            logistic_name: "delhivery",
            tracking_url: "https://ithinklogistics.co.in/postship/tracking/IT00000001",
          },
        },
      })
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch
    const logger = { info: jest.fn() } as unknown as Logger
    try {
      const service = new IthinkFulfillmentService(
        { logger },
        {
          base_url: "https://pre-alpha.ithinklogistics.com/api_v3",
          access_token: "tok-test",
          secret_key: "key-test",
          pickup_address_id: "addr-test",
          gst_number: "27ABCDE1234F1Z5",
          mode: "book",
        }
      )
      const result = await service.createFulfillment(
        { logistic_name: "delhivery", weight_kg: "0.5" },
        [{ id: "fulitem1", title: "Serum", sku: "SER-1", quantity: 1, line_item_id: "li1" }],
        {
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
        },
        {}
      )
      const body = parseCapturedBody(capturedInit!)
      const data = body.data as Record<string, unknown>
      expect(data.logistics).toBe("Delhivery")
      expect(data.pickup_address_id).toBe("addr-test")
      expect(data.access_token).toBe("tok-test")
      expect(data.secret_key).toBe("key-test")
      const shipment = (data.shipments as Record<string, unknown>[])[0]
      expect(shipment.payment_mode).toBe("Prepaid")
      expect(shipment.gst_number).toBe("27ABCDE1234F1Z5")
      expect(shipment.eway_bill_number).toBe("")
      expect(shipment.products).toEqual([
        { product_name: "Serum", product_sku: "SER-1", product_quantity: "1", product_price: "0" },
      ])
      expect(result.data.awb).toBe("IT00000001")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

function orderParamsForAddOrder() {
  return {
    orderNumber: "1001",
    orderDate: "01-08-2026",
    totalAmount: 749,
    recipientName: "Jane Doe",
    addressLine1: "456 Elm St",
    pin: "560001",
    phone: "9876543210",
    paymentMode: "Prepaid" as const,
    shipmentLengthCm: 20,
    shipmentWidthCm: 15,
    shipmentHeightCm: 10,
    weightKg: 0.5,
    lines: [{ name: "Serum", quantity: 1, price: 749 }],
    pickupAddressId: "addr-test",
  }
}
