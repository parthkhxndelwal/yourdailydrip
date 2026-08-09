import type { SubscriberArgs } from "@medusajs/framework"
import preorderCreatedHandler from "../preorder-created"

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
      createPreorders: jest.fn().mockResolvedValue([{ id: "po_1" }]),
      listPreorders: jest.fn().mockResolvedValue([]),
      updatePreorders: jest.fn().mockResolvedValue([]),
    },
    order: {
      updateOrders: jest.fn().mockResolvedValue([{ id: "order_1" }]),
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

describe("order.placed subscriber (preorder processing)", () => {
  const ackExpected = {
    order_id: "order_1",
    display_id: 1001,
    expected_ship_date: new Date("2026-08-15").toISOString(),
    items: [
      { title: "Rooted - Preorder", quantity: 1 },
      { title: "Rooted - Gift", quantity: 2 },
    ],
  }

  it("creates preorder records, writes the expected ship date, and sends the ack email", async () => {
    const { deps, container } = makeContainer(
      [
        {
          email: "customer@example.com",
          display_id: 1001,
          metadata: { region: "in" },
          items: [
            { id: "orli_1", variant_id: "variant_1", title: "Rooted - Preorder", quantity: 1 },
            { id: "orli_2", variant_id: "variant_2", title: "Rooted - Gift", quantity: 2 },
          ],
        },
      ],
      [
        { id: "pov_1", variant_id: "variant_1", available_date: new Date("2026-09-01") },
        { id: "pov_2", variant_id: "variant_2", available_date: new Date("2026-08-15") },
      ]
    )

    await preorderCreatedHandler(makeArgs(container))

    expect(deps.query.graph).toHaveBeenCalledWith({
      entity: "order",
      fields: [
        "email",
        "display_id",
        "metadata",
        "items.id",
        "items.variant_id",
        "items.title",
        "items.quantity",
      ],
      filters: { id: "order_1" },
    })
    expect(deps.preorder.listPreorderVariants).toHaveBeenCalledWith({
      variant_id: ["variant_1", "variant_2"],
      status: "enabled",
    })
    expect(deps.preorder.createPreorders).toHaveBeenCalledWith([
      { order_id: "order_1", item_id: "pov_1", status: "pending" },
      { order_id: "order_1", item_id: "pov_2", status: "pending" },
    ])
    expect(deps.order.updateOrders).toHaveBeenCalledWith(
      { id: "order_1" },
      {
        metadata: {
          region: "in",
          preorder_expected_ship_date: new Date("2026-08-15").toISOString(),
        },
      }
    )
    expect(deps.notification.createNotifications).toHaveBeenCalledTimes(1)
    expect(deps.notification.createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        channel: "email",
        template: "preorder_ack",
        data: ackExpected,
        trigger_type: "order.placed",
        resource_id: "order_1",
      })
    )
  })

  it("is a no-op when the order has no enabled preorder variants", async () => {
    const { deps, container } = makeContainer([
      {
        email: "customer@example.com",
        display_id: 1001,
        metadata: {},
        items: [
          { id: "orli_1", variant_id: "variant_1", title: "Demo Serum", quantity: 1 },
        ],
      },
    ])

    await preorderCreatedHandler(makeArgs(container))

    expect(deps.preorder.listPreorderVariants).toHaveBeenCalledWith({
      variant_id: ["variant_1"],
      status: "enabled",
    })
    expect(deps.preorder.createPreorders).not.toHaveBeenCalled()
    expect(deps.order.updateOrders).not.toHaveBeenCalled()
    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
  })

  it("is a no-op when enabled preorder variants carry no available date", async () => {
    const { deps, container } = makeContainer(
      [
        {
          email: "customer@example.com",
          display_id: 1001,
          metadata: {},
          items: [
            { id: "orli_1", variant_id: "variant_1", title: "Rooted - Preorder", quantity: 1 },
          ],
        },
      ],
      [{ id: "pov_1", variant_id: "variant_1" }]
    )

    await preorderCreatedHandler(makeArgs(container))

    expect(deps.preorder.listPreorderVariants).toHaveBeenCalledWith({
      variant_id: ["variant_1"],
      status: "enabled",
    })
    expect(deps.preorder.createPreorders).not.toHaveBeenCalled()
    expect(deps.order.updateOrders).not.toHaveBeenCalled()
    expect(deps.notification.createNotifications).not.toHaveBeenCalled()
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("no available dates")
    )
  })
})