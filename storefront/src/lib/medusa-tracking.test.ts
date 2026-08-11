import { describe, expect, it } from "vitest";

import { parseTrackResponse } from "./medusa-tracking";

const snapshot = {
  awb: "5330000310052",
  status: "Delivered",
  statusCode: "DEL",
  expectedDeliveryDate: "2026-08-05",
  terminal: true,
  scans: [
    {
      status: "Delivered",
      statusCode: "DEL",
      location: "Mumbai",
      remark: "Delivered to customer",
      at: "2026-08-05 14:30:00",
    },
  ],
};

describe("parseTrackResponse", () => {
  it("maps a pending payload to { state: 'pending', refnum, order_no }", () => {
    const pending = {
      state: "pending",
      refnum: "DD2408010001",
      order_no: "10001",
      provider: "ithink",
      message:
        "Order synced with logistics provider. Tracking AWB will appear once the courier dispatches it.",
    };

    expect(parseTrackResponse(pending)).toEqual({
      state: "pending",
      refnum: "DD2408010001",
      order_no: "10001",
    });
  });

  it("maps a pending payload without a refnum to a pending state with undefined refnum", () => {
    const pending = {
      state: "pending",
      order_no: "10001",
      provider: "ithink",
      message:
        "Order synced with logistics provider. Tracking AWB will appear once the courier dispatches it.",
    };

    expect(parseTrackResponse(pending)).toEqual({
      state: "pending",
      refnum: undefined,
      order_no: "10001",
    });
  });

  it("passes a full tracking snapshot through unchanged", () => {
    expect(parseTrackResponse(snapshot)).toEqual(snapshot);
  });

  it("returns null for a payload without an awb or pending state", () => {
    expect(
      parseTrackResponse({ message: "No shipment found for this tracking number" }),
    ).toBeNull();
  });

  it("returns null for a malformed snapshot missing its scans", () => {
    expect(parseTrackResponse({ awb: "5330000310052", status: "Delivered" })).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    expect(parseTrackResponse(null)).toBeNull();
    expect(parseTrackResponse("nope")).toBeNull();
    expect(parseTrackResponse(42)).toBeNull();
  });
});
