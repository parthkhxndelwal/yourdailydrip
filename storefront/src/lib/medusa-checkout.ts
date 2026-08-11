// Checkout data layer for the storefront, on top of the shared Medusa SDK.
//
// The four Store API calls the checkout flow needs:
//   1. cart.update                  — persist email + shipping/billing address
//   2. fulfillment.listCartOptions  — shipping options for the cart
//   3. cart.addShippingMethod       — attach the chosen option to the cart
//   4. cart.complete                — turn the cart into an order
//
// Types are derived from the installed SDK's own method signatures so they
// cannot drift. Every SDK body is a plain object — never JSON.stringify.
// Prices are as-is INR amounts (749 = 749) — never divide/multiply.

import { sdk } from "./medusa";

// ── SDK-derived types ────────────────────────────────────────────────────────

type UpdateCartBody = Parameters<typeof sdk.store.cart.update>[1];

export type StoreShippingOption = Awaited<
  ReturnType<typeof sdk.store.fulfillment.listCartOptions>
>["shipping_options"][number];

export type CompleteCartResult = Awaited<ReturnType<typeof sdk.store.cart.complete>>;

export type PlacedOrder = Extract<CompleteCartResult, { type: "order" }>;

export type AddressPayload = Exclude<NonNullable<UpdateCartBody["shipping_address"]>, string>;

// ── iThink Logistics shipping options ────────────────────────────────────────
//
// iThink options are detected by the fulfillment provider id ("ithink",
// registered in medusa-config.ts) or by `logistic_name` present in the option
// data (todo 11 stores it there via getFulfillmentOptions). The cart-resolved
// `option.amount` is the real rate returned by the iThink rate check — never a
// hardcoded price. `delivery_tat` is rendered only when the option data carries
// it; it is not fabricated when absent.

export const ITHINK_PROVIDER_ID = "ithink";

function optionDataString(option: StoreShippingOption, key: string): string | undefined {
  const value = option.data?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function isIthinkShippingOption(option: StoreShippingOption): boolean {
  return (
    option.provider_id === ITHINK_PROVIDER_ID ||
    optionDataString(option, "logistic_name") !== undefined
  );
}

/**
 * Prioritize iThink shipping options for the checkout radio list: iThink
 * carrier options come first, sorted cheapest-first by the real returned rate;
 * any non-iThink options (e.g. a manual fallback option) keep their returned
 * order after them. This only reorders what the server returned — it never
 * invents prices or options.
 */
export function prioritizeShippingOptions(options: StoreShippingOption[]): StoreShippingOption[] {
  const ithink = options.filter(isIthinkShippingOption).sort((a, b) => a.amount - b.amount);
  const others = options.filter((option) => !isIthinkShippingOption(option));
  return [...ithink, ...others];
}

export type StoreShippingMethod = NonNullable<
  Awaited<ReturnType<typeof sdk.store.cart.retrieve>>["cart"]["shipping_methods"]
>[number];

/**
 * Logistic detail line for the selected shipping method (delivery TAT /
 * expected delivery date / carrier). `delivery_tat` and
 * `expected_delivery_date` are read from the shipping method's data first —
 * the fulfillment provider persists them there at validateFulfillmentData —
 * falling back to the option's own data; `logistic_name` comes from the
 * option data. Rendered only when present, never fabricated.
 */
export function shippingOptionDetail(
  option: StoreShippingOption,
  method?: StoreShippingMethod,
): string | null {
  const parts: string[] = [];
  const deliveryTat =
    dataString(method?.data, "delivery_tat") ?? optionDataString(option, "delivery_tat");
  const expectedDeliveryDate =
    dataString(method?.data, "expected_delivery_date") ??
    optionDataString(option, "expected_delivery_date");
  const logisticName = optionDataString(option, "logistic_name");
  if (deliveryTat) parts.push(`Delivery in ${deliveryTat}`);
  if (expectedDeliveryDate) parts.push(`Arrives by ${expectedDeliveryDate}`);
  if (logisticName) parts.push(`via ${logisticName}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function dataString(data: unknown, key: string): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// ── iThink shipping rate hints ──────────────────────────────────────────────
//
// Mirror of GET /store/ithink/rates (backend/src/api/store/ithink/rates/
// route.ts): the cheapest and fastest courier for a delivery pincode plus the
// expected delivery date. Hints are informational only — the customer never
// picks a courier; the dashboard decides at dispatch. On any backend failure
// the route answers 502 { error: "rate_unavailable" } and the storefront
// renders no hint: checkout must never block on this.

export type ShippingRateHint = {
  logistic: string;
  rate: number;
  delivery_tat?: string;
};

export type ShippingRateHints = {
  cheapest: ShippingRateHint;
  fastest: ShippingRateHint;
  expected_delivery_date?: string;
  currency: string;
  from_pincode: string;
  to_pincode: string;
};

/**
 * Parse the /store/ithink/rates response into typed hints. Anything malformed
 * (missing cheapest/fastest, non-number rate, ...) is treated as no hints
 * (null) so the UI renders nothing instead of crashing.
 */
export function parseShippingRateHints(payload: unknown): ShippingRateHints | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const cheapest = parseRateHint(record.cheapest);
  const fastest = parseRateHint(record.fastest);
  if (!cheapest || !fastest) return null;
  return {
    cheapest,
    fastest,
    expected_delivery_date: optionalString(record.expected_delivery_date),
    currency: optionalString(record.currency) ?? "",
    from_pincode: optionalString(record.from_pincode) ?? "",
    to_pincode: optionalString(record.to_pincode) ?? "",
  };
}

function parseRateHint(value: unknown): ShippingRateHint | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.logistic !== "string" || typeof record.rate !== "number") return null;
  return {
    logistic: record.logistic,
    rate: record.rate,
    delivery_tat: optionalString(record.delivery_tat),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Fetch the cheapest/fastest courier hints for a delivery pincode from the
 * store rates route (through the shared SDK client, never raw fetch). Any
 * failure — 502 rate_unavailable, 400, network — maps to null: hints are
 * informational and checkout must proceed without them.
 */
export async function fetchShippingRateHints(
  pincode: string,
  productMrp?: number,
): Promise<ShippingRateHints | null> {
  try {
    const payload = await sdk.client.fetch<unknown>("/store/ithink/rates", {
      query: {
        pincode,
        ...(productMrp && productMrp > 0 ? { mrp: String(productMrp) } : {}),
      },
    });
    return parseShippingRateHints(payload);
  } catch {
    return null;
  }
}

// ── App-facing India shipping address form ───────────────────────────────────

export const COUNTRY_CODE = "in";

export type ShippingAddressForm = {
  first_name: string;
  last_name: string;
  phone: string;
  address_1: string;
  address_2: string;
  city: string;
  province: string;
  postal_code: string;
};

const REQUIRED_LABELS: Record<keyof ShippingAddressForm, string> = {
  first_name: "First name",
  last_name: "Last name",
  phone: "Phone number",
  address_1: "Street address",
  address_2: "",
  city: "City",
  province: "State",
  postal_code: "Pincode",
};

/**
 * Pure client-side validation of the address form. Returns a map of per-field
 * messages; an empty object means the form is valid. Runs before any SDK call.
 */
export function validateAddress(
  address: ShippingAddressForm,
): Partial<Record<keyof ShippingAddressForm, string>> {
  const errors: Partial<Record<keyof ShippingAddressForm, string>> = {};
  for (const field of Object.keys(REQUIRED_LABELS) as (keyof ShippingAddressForm)[]) {
    if (field === "address_2") continue;
    if (!address[field].trim()) {
      errors[field] = `${REQUIRED_LABELS[field]} is required`;
    }
  }
  if (address.phone.trim() && !/^[6-9]\d{9}$/.test(address.phone.trim())) {
    errors.phone = "Enter a valid 10-digit Indian mobile number";
  }
  if (address.postal_code.trim() && !/^\d{6}$/.test(address.postal_code.trim())) {
    errors.postal_code = "Enter a valid 6-digit Indian pincode";
  }
  return errors;
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address";
  return null;
}

/** Map the address form to the SDK payload. Country defaults to India; values are trimmed. */
export function toAddressPayload(address: ShippingAddressForm): AddressPayload {
  const clean = (value: string) => value.trim();
  return {
    first_name: clean(address.first_name),
    last_name: clean(address.last_name),
    phone: clean(address.phone),
    address_1: clean(address.address_1),
    address_2: clean(address.address_2) || null,
    city: clean(address.city),
    province: clean(address.province),
    postal_code: clean(address.postal_code),
    country_code: COUNTRY_CODE,
  };
}

/** One-line display of a saved cart/shipping address (e.g. the payment review). */
export function formatAddressLine(
  address?: {
    first_name?: string | null;
    last_name?: string | null;
    address_1?: string | null;
    address_2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
  } | null,
): string {
  if (!address) return "—";
  const parts = [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.address_1,
    address.address_2,
    [address.city, address.province].filter(Boolean).join(", "),
    address.postal_code,
  ].filter(Boolean);
  return parts.join(", ") || "—";
}
