import { describe, expect, it } from "vitest";

import { orderAwb, orderTrackingInfo, type StoreOrder } from "./medusa-orders";

function orderWith(fulfillments: unknown[]): StoreOrder {
  return { fulfillments } as unknown as StoreOrder;
}

describe("orderTrackingInfo", () => {
  it("reads the awb from fulfillment.data when present", () => {
    const order = orderWith([{ data: { awb: "5330000310052" }, metadata: null }]);

    expect(orderTrackingInfo(order)).toEqual({ awb: "5330000310052", pending: false });
  });

  it("falls back to fulfillment.metadata.awb", () => {
    const order = orderWith([{ data: null, metadata: { awb: "5330000310052" } }]);

    expect(orderTrackingInfo(order)).toEqual({ awb: "5330000310052", pending: false });
  });

  it("reports pending with the refnum when the fulfillment has no awb yet", () => {
    const order = orderWith([
      { data: { refnum: "DD2408010001", order_no: "10001" }, metadata: null },
    ]);

    expect(orderTrackingInfo(order)).toEqual({ refnum: "DD2408010001", pending: true });
  });

  it("returns pending false without refnum when no fulfillment carries tracking data", () => {
    expect(orderTrackingInfo(orderWith([]))).toEqual({ pending: false });
    expect(orderTrackingInfo(orderWith([{ data: null, metadata: null }]))).toEqual({
      pending: false,
    });
  });

  it("ignores a non-string refnum", () => {
    const order = orderWith([{ data: { refnum: 12345 }, metadata: null }]);

    expect(orderTrackingInfo(order)).toEqual({ pending: false });
  });
});

describe("orderAwb", () => {
  it("returns the awb for a fulfilled order", () => {
    const order = orderWith([{ data: { awb: "5330000310052" }, metadata: null }]);

    expect(orderAwb(order)).toBe("5330000310052");
  });

  it("returns undefined for a pending (refnum-only) fulfillment", () => {
    const order = orderWith([
      { data: { refnum: "DD2408010001", order_no: "10001" }, metadata: null },
    ]);

    expect(orderAwb(order)).toBeUndefined();
  });
});
