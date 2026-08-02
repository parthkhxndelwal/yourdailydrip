// Payment data layer for checkout, on top of the shared Medusa SDK.
//
// The only Store API payment call the storefront needs is session initiation:
//   sdk.store.payment.initiatePaymentSession(cart, { provider_id }) →
//   { payment_collection } with payment_sessions[].data.razorpayOrder
//
// The installed SDK signature differs from the plan text: the first argument is
// the cart object (not { cart_id }), and the SDK creates/upserts the payment
// collection itself when the cart has none. The Razorpay provider stores the
// Razorpay order (id/amount/currency) in the session's `data.razorpayOrder`.
//
// Amount truth: `razorpayOrder.amount` is paise as returned by the provider
// (₹749 → 74900). It is surfaced as-is — never multiplied or divided. The
// provider (getToPay) owns the smallest-unit conversion.

import type { StoreCart } from "./medusa-cart";
import { RazorpayCheckoutError } from "./razorpay";
import { sdk } from "./medusa";

/** Store-facing payment provider id for the Razorpay module (pp_ = payment provider). */
export const RAZORPAY_PROVIDER_ID = "pp_razorpay_razorpay" as const;

type InitiatePaymentResponse = Awaited<ReturnType<typeof sdk.store.payment.initiatePaymentSession>>;

type RazorpayPaymentSession = NonNullable<
  InitiatePaymentResponse["payment_collection"]["payment_sessions"]
>[number];

/** The provider-supplied Razorpay order embedded in the payment session data. */
export type RazorpayOrderInfo = {
  orderId: string;
  /** Paise as supplied by the provider — never multiplied or divided. */
  amount: number;
  /** ISO currency from the provider, e.g. "INR". */
  currency: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
};

/**
 * Safely extract the Razorpay order from a payment session's `data`. The SDK
 * types `data` as Record<string, unknown>, so the order shape is parsed here —
 * once (single guarded cast at the boundary) — instead of trusted downstream.
 */
function parseRazorpayOrder(
  data: Record<string, unknown> | undefined,
): { id: string; amount: number; currency: string } | null {
  const rawOrder = data?.razorpayOrder;
  const order =
    typeof rawOrder === "object" && rawOrder !== null
      ? (rawOrder as Record<string, unknown>)
      : null;
  if (!order) return null;
  const { id, amount, currency } = order;
  if (typeof id !== "string" || typeof amount !== "number" || typeof currency !== "string") {
    return null;
  }
  return { id, amount, currency };
}

/**
 * Initiate a Razorpay payment session for the cart and return the Razorpay
 * order needed by Checkout.js. Retries keep the LAST session for the provider,
 * so a re-initiated order (never a stale one) is used.
 */
export async function initiateRazorpaySession(cart: StoreCart): Promise<RazorpayOrderInfo> {
  const { payment_collection } = await sdk.store.payment.initiatePaymentSession(cart, {
    provider_id: RAZORPAY_PROVIDER_ID,
  });

  let session: RazorpayPaymentSession | undefined;
  for (const candidate of payment_collection.payment_sessions ?? []) {
    if (candidate.provider_id === RAZORPAY_PROVIDER_ID) {
      session = candidate;
    }
  }

  const order = parseRazorpayOrder(session?.data);
  if (!order) {
    throw new RazorpayCheckoutError(
      "Razorpay couldn't prepare a payment for this order. Please try again.",
    );
  }

  const address = cart.shipping_address;
  const customerName = [address?.first_name, address?.last_name].filter(Boolean).join(" ") || undefined;

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    customerEmail: cart.email || undefined,
    customerName,
    customerPhone: address?.phone || undefined,
  };
}
