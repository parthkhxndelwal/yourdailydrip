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
export function prioritizeShippingOptions(
  options: StoreShippingOption[],
): StoreShippingOption[] {
  const ithink = options
    .filter(isIthinkShippingOption)
    .sort((a, b) => a.amount - b.amount);
  const others = options.filter((option) => !isIthinkShippingOption(option));
  return [...ithink, ...others];
}

/**
 * Logistic detail line for an option (delivery TAT / carrier from the option
 * data) — rendered only when the server returned it, never fabricated.
 */
export function shippingOptionDetail(option: StoreShippingOption): string | null {
  const parts: string[] = [];
  const deliveryTat = optionDataString(option, "delivery_tat");
  const logisticName = optionDataString(option, "logistic_name");
  if (deliveryTat) parts.push(`Delivery in ${deliveryTat}`);
  if (logisticName) parts.push(`via ${logisticName}`);
  return parts.length > 0 ? parts.join(" · ") : null;
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
export function formatAddressLine(address?: {
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
} | null): string {
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
