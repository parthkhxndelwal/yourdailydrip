import assert from "node:assert"
import type { MedusaContainer } from "@medusajs/framework"
import { IthinkClient } from "../modules/ithink/clients/ithink-client"
import {
  buildOrderBody,
  buildRateBody,
  toIthinkDateTime,
  toNumber,
  toOrderDate,
  withAuth,
} from "../modules/ithink/clients/payloads"
import type { IthinkClientOptions } from "../modules/ithink/clients/types"
import {
  isTerminalStatusCode,
  normalizeTrackShipment,
} from "../modules/ithink/services/tracking"

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

function fakeFetch(handler: (url: string, init: RequestInit) => unknown) {
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    const data = handler(url, { ...init, body })
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(data),
    } as Response
  }) as typeof fetch
  return fetchImpl
}

async function main(): Promise<void> {
  const rateBody = buildRateBody({
    fromPincode: "110001",
    toPincode: "560001",
    weightKg: 0.5,
    productMrp: 749,
  })
  assert.strictEqual(rateBody.from_pincode, "110001")
  assert.strictEqual(rateBody.to_pincode, "560001")
  assert.strictEqual(rateBody.shipping_weight_kg, 0.5)
  assert.strictEqual(rateBody.payment_method, "Prepaid")
  assert.strictEqual(rateBody.order_type, "forward")
  assert.strictEqual(rateBody.product_mrp, 749)
  assert.strictEqual("shipping_length_cms" in rateBody, false, "optional dims omitted when undefined")
  const rateBodyDims = buildRateBody({
    fromPincode: "110001",
    toPincode: "560001",
    weightKg: 0.5,
    productMrp: 749,
    lengthCm: 20,
    widthCm: 15,
    heightCm: 10,
  })
  assert.strictEqual(rateBodyDims.shipping_length_cms, "20")
  assert.strictEqual(rateBodyDims.shipping_width_cms, "15")
  assert.strictEqual(rateBodyDims.shipping_height_cms, "10")

  const orderBody = buildOrderBody({
    orderNumber: "1001",
    orderDate: "01-08-2026",
    totalAmount: 749,
    recipientName: "Jane Doe",
    addressLine1: "456 Elm St",
    pin: "560001",
    phone: "9876543210",
    email: "jane@example.com",
    paymentMode: "Prepaid",
    shipmentLengthCm: 20,
    shipmentWidthCm: 15,
    shipmentHeightCm: 10,
    weightKg: 0.5,
    lines: [{ name: "Serum", sku: "SER-1", quantity: 1, price: 749 }],
    pickupAddressId: "addr-test",
    logistics: "delhivery",
  })
  const shipment = (orderBody.shipments as Record<string, unknown>[])[0]
  assert.strictEqual(shipment.order, "1001")
  assert.strictEqual(shipment.total_amount, 749)
  assert.strictEqual(shipment.name, "Jane Doe")
  assert.strictEqual(shipment.pin, "560001")
  assert.strictEqual(shipment.payment_mode, "Prepaid")
  assert.strictEqual(orderBody.pickup_address_id, "addr-test")
  assert.strictEqual(orderBody.logistics, "delhivery")
  assert.deepStrictEqual(shipment.products, [
    { product_name: "Serum", product_sku: "SER-1", product_quantity: "1", product_price: "749" },
  ])

  const authed = withAuth({ pincode: "560001" }, options)
  assert.strictEqual(authed.access_token, "tok-test")
  assert.strictEqual(authed.secret_key, "key-test")
  assert.strictEqual(authed.pincode, "560001")

  assert.strictEqual(toOrderDate("2026-08-01T10:00:00Z"), "01-08-2026")
  assert.strictEqual(toNumber(749), 749)
  assert.strictEqual(toNumber("749.5"), 749.5)
  assert.strictEqual(toNumber("not-a-number"), 0)
  assert.strictEqual(toNumber(undefined), 0)

  const pincodeOkClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch(() => ({ status: "success", data: "yes" })),
  })
  assert.strictEqual(await pincodeOkClient.checkPincode("560001"), true)

  const pincodeNoClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch(() => ({ status: "success", data: "no" })),
  })
  assert.strictEqual(await pincodeNoClient.checkPincode("560001"), false)

  const rateClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch(() => ({
      status: "success",
      data: [{ logistic_name: "delhivery", rate: 153.4, delivery_tat: "2-3" }],
    })),
  })
  const rates = await rateClient.checkRate({
    fromPincode: "110001",
    toPincode: "560001",
    weightKg: 0.5,
    productMrp: 749,
  })
  assert.strictEqual(rates.rates.length, 1)
  assert.strictEqual(rates.rates[0].logistic_name, "delhivery")
  assert.strictEqual(rates.rates[0].rate, 153.4)

  const addOrderClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch(() => ({
      status: "success",
      data: {
        "1": { status: "Success", remark: "ok", waybill: "IT00000001", refnum: "R1", logistic_name: "delhivery" },
      },
    })),
  })
  const created = await addOrderClient.addOrder({
    orderNumber: "1001",
    orderDate: "01-08-2026",
    totalAmount: 749,
    recipientName: "Jane Doe",
    addressLine1: "456 Elm St",
    pin: "560001",
    phone: "9876543210",
    paymentMode: "Prepaid",
    shipmentLengthCm: 20,
    shipmentWidthCm: 15,
    shipmentHeightCm: 10,
    weightKg: 0.5,
    lines: [{ name: "Serum", quantity: 1, price: 749 }],
    pickupAddressId: "addr-test",
  })
  assert.strictEqual(created.waybill, "IT00000001")

  let labelUrl = ""
  const labelClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch(() => ({ status: "success", file_name: "https://cdn.ithinklogistics.com/label.pdf" })),
  })
  labelUrl = await labelClient.getLabel(["IT00000001"])
  assert.strictEqual(labelUrl, "https://cdn.ithinklogistics.com/label.pdf")

  const failingClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch(() => ({ status: "error", message: "rate not found" })),
  })
  await assert.rejects(
    () =>
      failingClient.checkRate({
        fromPincode: "110001",
        toPincode: "560001",
        weightKg: 0.5,
        productMrp: 749,
      }),
    /rate not found/
  )

  const httpErrorClient = new IthinkClient({
    ...options,
    fetchImpl: (async () => {
      return { ok: false, status: 500, text: async () => "boom" } as Response
    }) as typeof fetch,
  })
  await assert.rejects(() => httpErrorClient.checkPincode("560001"), /HTTP 500/)

  let getAwbBody: Record<string, unknown> = {}
  const getAwbClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch((_url, init) => {
      getAwbBody = init.body as unknown as Record<string, unknown>
      return { status: "success", "Awb list": [{ airway_bill_no: "IT00000001" }, { airway_bill_no: "IT00000002" }] }
    }),
  })
  const windowAwbs = await getAwbClient.getAwbsInWindow({
    startDateTime: "2026-08-01 10:00:00",
    endDateTime: "2026-08-01 10:30:00",
  })
  assert.deepStrictEqual(windowAwbs, ["IT00000001", "IT00000002"])
  const getAwbData = (getAwbBody.data as Record<string, unknown>)
  assert.strictEqual(getAwbData.start_date_time, "2026-08-01 10:00:00")
  assert.strictEqual(getAwbData.end_date_time, "2026-08-01 10:30:00")
  assert.strictEqual(getAwbData.access_token, "tok-test", "auth is inside the data envelope for get_awb")
  assert.strictEqual(getAwbData.secret_key, "key-test", "auth is inside the data envelope for get_awb")

  const getAwbEmptyClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch(() => ({ status: "success" })),
  })
  assert.deepStrictEqual(
    await getAwbEmptyClient.getAwbsInWindow({
      startDateTime: "2026-08-01 10:00:00",
      endDateTime: "2026-08-01 10:30:00",
    }),
    []
  )

  let trackBodies: Record<string, unknown>[] = []
  const trackClient = new IthinkClient({
    ...options,
    fetchImpl: fakeFetch((_url, init) => {
      trackBodies.push(init.body as unknown as Record<string, unknown>)
      const body = init.body as unknown as Record<string, unknown>
      const data = body.data as Record<string, unknown>
      const requested = String(data.awb_number_list).split(",")
      const responseData: Record<string, unknown> = {}
      for (const awb of requested) {
        if (awb === "IT00000011") {
          continue
        }
        responseData[awb] = {
          awb_no: awb,
          current_status: "Picked Up",
          current_status_code: "PU",
          expected_delivery_date: "2026-08-04",
          scan_details: [
            {
              status: "Picked Up",
              status_code: "PU",
              scan_location: "Mumbai",
              remark: "Shipment picked up",
              scan_date_time: "2026-08-01 11:15:00",
            },
          ],
        }
      }
      return { status: "success", data: responseData }
    }),
  })
  const tracked = await trackClient.trackShipments([
    "IT00000001",
    "IT00000001",
    "IT00000002",
    "IT00000003",
    "IT00000004",
    "IT00000005",
    "IT00000006",
    "IT00000007",
    "IT00000008",
    "IT00000009",
    "IT00000010",
    "IT00000011",
  ])
  assert.strictEqual(tracked.length, 10, "AWBs missing from the response are skipped")
  assert.strictEqual(tracked[0].awb_no, "IT00000001")
  assert.strictEqual(tracked[0].current_status_code, "PU")
  assert.strictEqual(trackBodies.length, 2, "12 unique AWBs are chunked into 10 + 2")
  const firstTrackData = (trackBodies[0].data as Record<string, unknown>)
  const secondTrackData = (trackBodies[1].data as Record<string, unknown>)
  assert.strictEqual(firstTrackData.awb_number_list, "IT00000001,IT00000002,IT00000003,IT00000004,IT00000005,IT00000006,IT00000007,IT00000008,IT00000009,IT00000010")
  assert.strictEqual(secondTrackData.awb_number_list, "IT00000011")
  assert.strictEqual(firstTrackData.access_token, "tok-test", "auth is inside the data envelope for track")
  assert.strictEqual(firstTrackData.secret_key, "key-test", "auth is inside the data envelope for track")

  assert.deepStrictEqual(await trackClient.trackShipments([]), [])

  assert.strictEqual(toIthinkDateTime(new Date(2026, 7, 1, 9, 5, 3)), "2026-08-01 09:05:03")
  assert.strictEqual(isTerminalStatusCode("DL"), true)
  assert.strictEqual(isTerminalStatusCode("CN"), true)
  assert.strictEqual(isTerminalStatusCode("Lost"), true)
  assert.strictEqual(isTerminalStatusCode("Shortage"), true)
  assert.strictEqual(isTerminalStatusCode("RTO Shortage"), true)
  assert.strictEqual(isTerminalStatusCode("PU"), false)
  assert.strictEqual(isTerminalStatusCode(undefined), false)

  const normalized = normalizeTrackShipment({
    awb_no: "IT00000001",
    current_status: "Delivered",
    current_status_code: "DL",
    expected_delivery_date: "2026-08-02",
    scan_details: [
      {
        status: "Picked Up",
        status_code: "PU",
        scan_location: "Mumbai",
        remark: "Shipment picked up",
        scan_date_time: "2026-08-01 11:15:00",
      },
      {
        status: "Delivered",
        status_code: "DL",
        scan_location: "Bengaluru",
        remark: "Delivered to recipient",
        scan_date_time: "2026-08-02 16:40:00",
      },
    ],
  })
  assert.strictEqual(normalized.awb, "IT00000001")
  assert.strictEqual(normalized.statusCode, "DL")
  assert.strictEqual(normalized.terminal, true)
  assert.strictEqual(normalized.expectedDeliveryDate, "2026-08-02")
  assert.strictEqual(normalized.scans.length, 2)
  assert.deepStrictEqual(normalized.scans[0], {
    status: "Picked Up",
    statusCode: "PU",
    location: "Mumbai",
    remark: "Shipment picked up",
    at: "2026-08-01 11:15:00",
  })

  const inTransit = normalizeTrackShipment({
    awb_no: "IT00000002",
    current_status: "In Transit",
    current_status_code: "IT",
    scan_details: undefined,
  })
  assert.strictEqual(inTransit.terminal, false)
  assert.deepStrictEqual(inTransit.scans, [])

  console.log(
    "SMOKE PASS: payload builders, auth-in-body, pincode, rate, order, label, errors, tracking"
  )
}

// medusa exec invokes the default export with { container, args }; the smoke
// checks use injected fakes only, so the container is accepted but unused.
export default async function ithinkPayloadSmoke(_scriptParams: {
  container: MedusaContainer
}): Promise<void> {
  try {
    await main()
  } catch (error) {
    console.error("SMOKE FAIL:", error)
    throw error
  }
}
