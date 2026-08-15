import type { SubscriberArgs } from "@medusajs/framework"
import orderAckHandler from "../order-ack"

type OrderData = Record<string, unknown>

function makeArgs(container: Record<string, unknown>): SubscriberArgs<{ id: string }> {
  return {
    event: { name: "order.placed", data: { id: "order_1" } },
    container: container as unknown as SubscriberArgs<{ id: string }>["container"],
    pluginOptions: {},
  }
}

function makeContainer(orderData: OrderData[], preorderVariants: unknown[] = []) {
  const deps = {
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    query: {
      graph: jest.fn().mockResolvedValue({ data: orderData }),
    },
    preorder: {
      listPreorderVariants: jest.fn().mockResolvedValue(preorderVariants),
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

describe("order.placed subscriber (order ack email)", () => {
  it("sends order_ack when no item is an enabled preorder variant", async () => {
    const { deps, container } = makeContainer([
      {
        email: "customer@example.com",
        display_id: 1001,
        total: 749,
        items: [
          {
            id: "orli_1",
            variant_id: "variant_1",
            title: "Rooted - Preorder",
            quantity: 1,
            thumbnail: "thumb_1",
            unit_price: 499,
          },
          {
            id: "orli_2",
            variant_id: "variant_2",
            title: "Rooted - Gift",
            quantity: 2,
            thumbnail: "thumb_2",
            unit_price: 250,
          },
        ],
      },
    ])

    await orderAckHandler(makeArgs(container))

    expect(deps.query.graph).toHaveBeenCalledWith({
      entity: "order",
      fields: [
        "email",
        "display_id",
        "total",
        "items.id",
        "items.variant_id",
        "items.title",
        "items.thumbnail",
        "items.unit_price",
        "items.quantity",
      ],
      filters: { id: "order_1" },
    })
    expect(deps.preorder.listPreorderVariants).toHaveBeenCalledWith({
      variant_id: ["variant_1", "variant_2"],
      status: "enabled",
    })
    expect(deps.notification.createNotifications).toHaveBeenCalledTimes(1)
    expect(deps.notification.createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        channel: "email",
        template: "order_ack",
        data: {
          display_id: 1001,
          total: "₹749",
          items: [
            { title: "Rooted - Preorder", quantity: 1, thumbnail: "thumb_1", unit_price: "₹499" },
            { title: "Rooted - Gift", quantity: 2, thumbnail: "thumb_2", unit_price: "₹250" },
          ],
          order_url: "/order-confirmation?order=order_1",
        },
        trigger_type: "order.placed",
        resource_id: "order_1",
      })
    )
  })

  it("skips when an item is an enabled preorder variant", async () => {
    const { deps, container } = makeContainer(
      [
        {
          email: "customer@example.com",
          display_id: 1001,
          total: 749,
          items: [
            { id: "orli_1", variant_id: "variant_1", title: "Rooted - Preorder", quantity: 1 },
          ],
        },
      ],
      [{ id: "pov_1", variant_id: "variant_1", status: "enabled" }]
    )

    await orderAckHandler(makeArgs(container))

    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when the order is not found", async () => {
    const { deps, container } = makeContainer([])

    await orderAckHandler(makeArgs(container))

    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
    expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringContaining("not found"))
  })
})