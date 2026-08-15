import type { SubscriberArgs } from "@medusajs/framework"
import shipmentNotificationHandler from "../shipment-notification"

type ShipmentEventData = {
  order_id?: string
  fulfillment_id?: string
  id?: string
  no_notification?: boolean
}

type FulfillmentData = Record<string, unknown>

function makeArgs(
  container: Record<string, unknown>,
  data: ShipmentEventData
): SubscriberArgs<ShipmentEventData> {
  return {
    event: { name: "order.fulfillment_created", data },
    container: container as unknown as SubscriberArgs<ShipmentEventData>["container"],
    pluginOptions: {},
  }
}

function makeContainer(orderData: Record<string, unknown>[], fulfillment: FulfillmentData) {
  const deps = {
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    query: {
      graph: jest.fn().mockResolvedValue({ data: orderData }),
    },
    fulfillment: {
      retrieveFulfillment: jest.fn().mockResolvedValue(fulfillment),
      updateFulfillments: jest.fn().mockResolvedValue([{ id: "ful_1" }]),
    },
    notification: {
      createNotifications: jest.fn().mockResolvedValue({ id: "notif_1" }),
    },
  }
  const container = {
    resolve: (key: string): unknown => deps[key as keyof typeof deps],
  } as unknown as Record<string, unknown>
  return { deps, container }
}

describe("shipment notification subscriber", () => {
  it("skips when fulfillment_created carries no awb (no email, no flag write)", async () => {
    const { deps, container } = makeContainer(
      [{ email: "customer@example.com", display_id: 1001 }],
      { data: {}, metadata: {}, order_id: "order_1" }
    )

    await shipmentNotificationHandler(
      makeArgs(container, { order_id: "order_1", fulfillment_id: "ful_1" })
    )

    expect(deps.fulfillment.retrieveFulfillment).toHaveBeenCalledWith("ful_1")
    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
    expect(deps.fulfillment.updateFulfillments).not.toHaveBeenCalled()
  })

  it("sends order_shipped on fulfillment.updated with awb and writes the sent flag", async () => {
    const { deps, container } = makeContainer(
      [{ email: "customer@example.com", display_id: 1001 }],
      {
        data: { awb: "AWB123" },
        metadata: { existing: "keep" },
        order_id: "order_1",
      }
    )

    await shipmentNotificationHandler(makeArgs(container, { id: "ful_1" }))

    expect(deps.fulfillment.retrieveFulfillment).toHaveBeenCalledWith("ful_1")
    expect(deps.notification.createNotifications).toHaveBeenCalledTimes(1)
    expect(deps.notification.createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        channel: "email",
        template: "order_shipped",
        data: expect.objectContaining({
          display_id: 1001,
          awb: "AWB123",
          track_url: expect.stringContaining("/track-order?awb="),
        }),
        trigger_type: "order.fulfillment_created",
        resource_id: "order_1",
      })
    )
    expect(deps.fulfillment.updateFulfillments).toHaveBeenCalledWith({
      selector: { id: "ful_1" },
      data: {
        metadata: {
          existing: "keep",
          shipped_email_sent: true,
        },
      },
    })
  })

  it("does not send a second email when the sent flag is already set", async () => {
    const { deps, container } = makeContainer(
      [{ email: "customer@example.com", display_id: 1001 }],
      {
        data: { awb: "AWB123" },
        metadata: { shipped_email_sent: true },
        order_id: "order_1",
      }
    )

    await shipmentNotificationHandler(
      makeArgs(container, { order_id: "order_1", fulfillment_id: "ful_1" })
    )

    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
    expect(deps.fulfillment.updateFulfillments).not.toHaveBeenCalled()
  })

  it("skips when no_notification is set on fulfillment_created", async () => {
    const { deps, container } = makeContainer(
      [{ email: "customer@example.com", display_id: 1001 }],
      { data: { awb: "AWB123" }, metadata: {}, order_id: "order_1" }
    )

    await shipmentNotificationHandler(
      makeArgs(container, {
        order_id: "order_1",
        fulfillment_id: "ful_1",
        no_notification: true,
      })
    )

    expect(deps.fulfillment.retrieveFulfillment).not.toHaveBeenCalled()
    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
    expect(deps.fulfillment.updateFulfillments).not.toHaveBeenCalled()
  })
})