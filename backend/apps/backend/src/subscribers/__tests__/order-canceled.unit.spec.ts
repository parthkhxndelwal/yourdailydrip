import type { SubscriberArgs } from "@medusajs/framework"
import orderCanceledHandler from "../order-canceled"

type OrderData = Record<string, unknown>

function makeArgs(container: Record<string, unknown>): SubscriberArgs<{ id: string }> {
  return {
    event: { name: "order.canceled", data: { id: "order_1" } },
    container: container as unknown as SubscriberArgs<{ id: string }>["container"],
    pluginOptions: {},
  }
}

function makeContainer(orderData: OrderData[], preorders: unknown[] = []) {
  const deps = {
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    query: {
      graph: jest.fn().mockResolvedValue({ data: orderData }),
    },
    preorder: {
      listPreorders: jest.fn().mockResolvedValue(preorders),
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

describe("order.canceled subscriber (order canceled email)", () => {
  it("sends order_canceled when no preorder rows exist", async () => {
    const { deps, container } = makeContainer([
      { email: "customer@example.com", display_id: 1001 },
    ])

    await orderCanceledHandler(makeArgs(container))

    expect(deps.preorder.listPreorders).toHaveBeenCalledWith({ order_id: "order_1" })
    expect(deps.notification.createNotifications).toHaveBeenCalledTimes(1)
    expect(deps.notification.createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        channel: "email",
        template: "order_canceled",
        data: { display_id: 1001 },
        trigger_type: "order.canceled",
        resource_id: "order_1",
      })
    )
  })

  it("skips when preorder rows exist", async () => {
    const { deps, container } = makeContainer(
      [{ email: "customer@example.com", display_id: 1001 }],
      [{ id: "po_1", order_id: "order_1" }]
    )

    await orderCanceledHandler(makeArgs(container))

    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when the order is not found", async () => {
    const { deps, container } = makeContainer([])

    await orderCanceledHandler(makeArgs(container))

    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
    expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringContaining("not found"))
  })
})