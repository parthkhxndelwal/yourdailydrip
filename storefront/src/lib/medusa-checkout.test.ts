// Unit tests for the checkout data layer's iThink rate-hint helpers and the
// shipping method detail fallback. The SDK client is mocked; the helpers must
// map backend failures (502 rate_unavailable, network, malformed payloads) to
// null so checkout never blocks on hints.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./medusa", () => ({
  sdk: { client: { fetch: vi.fn() } },
}));

import { sdk } from "./medusa";
import {
  fetchShippingRateHints,
  parseShippingRateHints,
  shippingOptionDetail,
  type StoreShippingMethod,
  type StoreShippingOption,
} from "./medusa-checkout";

const fetchMock = vi.mocked(sdk.client.fetch);

// Mirror of the 200 shape of GET /store/ithink/rates.
const HINTS_PAYLOAD = {
  cheapest: { logistic: "Delhivery", rate: 40, delivery_tat: "3 days" },
  fastest: { logistic: "BlueDart", rate: 55, delivery_tat: "1 day" },
  expected_delivery_date: "2026-08-14",
  currency: "INR",
  from_pincode: "560001",
  to_pincode: "110001",
};

const option = (data: Record<string, unknown>): StoreShippingOption =>
  ({ id: "opt_1", provider_id: "ithink", amount: 40, data }) as unknown as StoreShippingOption;

const method = (data: Record<string, unknown>): StoreShippingMethod =>
  ({ id: "sm_1", name: "Standard", amount: 40, data }) as unknown as StoreShippingMethod;

describe("fetchShippingRateHints", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns typed hints for a 200 response", async () => {
    fetchMock.mockResolvedValue(HINTS_PAYLOAD);

    const hints = await fetchShippingRateHints("110001");

    expect(fetchMock).toHaveBeenCalledWith("/store/ithink/rates", {
      query: { pincode: "110001" },
    });
    expect(hints).toEqual(HINTS_PAYLOAD);
  });

  it("sends the product mrp when provided", async () => {
    fetchMock.mockResolvedValue(HINTS_PAYLOAD);

    await fetchShippingRateHints("110001", 749);

    expect(fetchMock).toHaveBeenCalledWith("/store/ithink/rates", {
      query: { pincode: "110001", mrp: "749" },
    });
  });

  it("omits the mrp query for non-positive values", async () => {
    fetchMock.mockResolvedValue(HINTS_PAYLOAD);

    await fetchShippingRateHints("110001", 0);

    expect(fetchMock).toHaveBeenCalledWith("/store/ithink/rates", {
      query: { pincode: "110001" },
    });
  });

  it("maps a 502 rate_unavailable to null", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("rate_unavailable"), { status: 502 }));

    await expect(fetchShippingRateHints("110001")).resolves.toBeNull();
  });

  it("maps a network error to null", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(fetchShippingRateHints("110001")).resolves.toBeNull();
  });

  it("maps a malformed 200 payload to null", async () => {
    fetchMock.mockResolvedValue({ error: "rate_unavailable" });

    await expect(fetchShippingRateHints("110001")).resolves.toBeNull();
  });
});

describe("parseShippingRateHints", () => {
  it("returns null for a non-object payload", () => {
    expect(parseShippingRateHints(null)).toBeNull();
    expect(parseShippingRateHints("nope")).toBeNull();
  });

  it("returns null when cheapest or fastest is missing", () => {
    expect(parseShippingRateHints({ cheapest: { logistic: "X", rate: 1 } })).toBeNull();
    expect(parseShippingRateHints({ fastest: { logistic: "X", rate: 1 } })).toBeNull();
  });

  it("returns null when a hint lacks a logistic or a number rate", () => {
    expect(parseShippingRateHints({ ...HINTS_PAYLOAD, cheapest: { rate: 1 } })).toBeNull();
    expect(
      parseShippingRateHints({ ...HINTS_PAYLOAD, fastest: { logistic: "X", rate: "40" } }),
    ).toBeNull();
  });

  it("parses a full payload", () => {
    expect(parseShippingRateHints(HINTS_PAYLOAD)).toEqual(HINTS_PAYLOAD);
  });
});

describe("shippingOptionDetail", () => {
  it("reads delivery_tat and expected_delivery_date from the shipping method data over the option data", () => {
    const optionData = { delivery_tat: "3 days", logistic_name: "Delhivery" };
    const methodData = {
      delivery_tat: "1 day",
      expected_delivery_date: "2026-08-14",
      logistic_name: "BlueDart",
    };

    expect(shippingOptionDetail(option(optionData), method(methodData))).toBe(
      "Delivery in 1 day · Arrives by 2026-08-14 · via Delhivery",
    );
  });

  it("falls back to the option data when the shipping method carries no data", () => {
    expect(
      shippingOptionDetail(
        option({ delivery_tat: "3 days", logistic_name: "Delhivery" }),
        method({}),
      ),
    ).toBe("Delivery in 3 days · via Delhivery");
  });

  it("renders option data when no shipping method is passed", () => {
    expect(
      shippingOptionDetail(option({ delivery_tat: "3 days", logistic_name: "Delhivery" })),
    ).toBe("Delivery in 3 days · via Delhivery");
  });

  it("returns null when neither carries any detail", () => {
    expect(shippingOptionDetail(option({}), method({}))).toBeNull();
  });
});
