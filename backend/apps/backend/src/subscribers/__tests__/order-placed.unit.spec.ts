import type { SubscriberArgs } from "@medusajs/framework"
import registerOrderWithIthinkHandler from "../order-placed"

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
    createOrderFulfillmentWorkflow: jest
      .fn()
      .mockReturnValue({ run: jest.fn().mockResolvedValue({ result: { id: "ful_1" } }) }),
    preorder: {
      listPreorderVariants: jest.fn().mockResolvedValue(preorderVariants),
    },
  }
  const container = {
    resolve: (key: string): unknown => deps[key as keyof typeof deps],
  } as unknown as Record<string, unknown>
  return { deps, container }
}

describe("order.placed subscriber (iThink registration)", () => {
  it("creates a fulfillment for a paid order with items", async () => {
    const { deps, container } = makeContainer([
      {
        payment_collections: [{ status: "captured" }],
        fulfillments: [],
        items: [
          { id: "orli_1", quantity: 1 },
          { id: "orli_2", quantity: 2 },
        ],
      },
    ])

    await registerOrderWithIthinkHandler(makeArgs(container))

    expect(deps.query.graph).toHaveBeenCalledWith({
      entity: "order",
      fields: [
        "payment_collections.status",
        "fulfillments.id",
        "items.id",
        "items.quantity",
        "items.variant_id",
      ],
      filters: { id: "order_1" },
    })
    expect(deps.createOrderFulfillmentWorkflow).toHaveBeenCalledTimes(1)
    const workflow = deps.createOrderFulfillmentWorkflow.mock.results[0].value
    expect(workflow.run).toHaveBeenCalledWith({
      input: {
        order_id: "order_1",
        items: [
          { id: "orli_1", quantity: 1 },
          { id: "orli_2", quantity: 2 },
        ],
      },
    })
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("order_1"))
  })

  it("skips when payment is not captured", async () => {
    const { deps, container } = makeContainer([
      {
        payment_collections: [{ status: "awaiting" }],
        fulfillments: [],
        items: [{ id: "orli_1", quantity: 1 }],
      },
    ])

    await registerOrderWithIthinkHandler(makeArgs(container))

    expect(deps.createOrderFulfillmentWorkflow).not.toHaveBeenCalled()
    expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringContaining("payment not captured"))
  })

  it("skips when the order has no payment collections", async () => {
    const { deps, container } = makeContainer([
      {
        fulfillments: [],
        items: [{ id: "orli_1", quantity: 1 }],
      },
    ])

    await registerOrderWithIthinkHandler(makeArgs(container))

    expect(deps.createOrderFulfillmentWorkflow).not.toHaveBeenCalled()
  })

  it("skips when a fulfillment already exists", async () => {
    const { deps, container } = makeContainer([
      {
        payment_collections: [{ status: "captured" }],
        fulfillments: [{ id: "ful_1" }],
        items: [{ id: "orli_1", quantity: 1 }],
      },
    ])

    await registerOrderWithIthinkHandler(makeArgs(container))

    expect(deps.createOrderFulfillmentWorkflow).not.toHaveBeenCalled()
    expect(deps.logger.info).toHaveBeenCalledWith(expect.stringContaining("already exists"))
  })

  it("skips when the order has no items", async () => {
    const { deps, container } = makeContainer([
      {
        payment_collections: [{ status: "captured" }],
        fulfillments: [],
        items: [],
      },
    ])

    await registerOrderWithIthinkHandler(makeArgs(container))

    expect(deps.createOrderFulfillmentWorkflow).not.toHaveBeenCalled()
  })

  it("skips when the order is not found", async () => {
    const { deps, container } = makeContainer([])

    await registerOrderWithIthinkHandler(makeArgs(container))

    expect(deps.createOrderFulfillmentWorkflow).not.toHaveBeenCalled()
    expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringContaining("not found"))
  })

  it("skips iThink registration when the order contains a pre-order variant", async () => {
    const { deps, container } = makeContainer(
      [
        {
          payment_collections: [{ status: "captured" }],
          fulfillments: [],
          items: [{ id: "orli_1", quantity: 1, variant_id: "variant_1" }],
        },
      ],
      [{ id: "pov_1", variant_id: "variant_1", status: "enabled" }]
    )

    await registerOrderWithIthinkHandler(makeArgs(container))

    expect(deps.preorder.listPreorderVariants).toHaveBeenCalledWith({
      variant_id: ["variant_1"],
      status: "enabled",
    })
    expect(deps.createOrderFulfillmentWorkflow).not.toHaveBeenCalled()
    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("pre-order order order_1")
    )
  })
})
