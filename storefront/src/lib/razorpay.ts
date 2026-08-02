// Razorpay Checkout.js integration helper for the storefront.
//
// Responsibilities:
//   1. Load https://checkout.razorpay.com/v1/checkout.js lazily and ONLY in the
//      browser. The loader guards `typeof window` so importing this module never
//      blocks SSR, and a failed script load rejects with a typed error so the
//      Pay button can re-enable.
//   2. Type the global `window.Razorpay` constructor injected by the script
//      (the official checkout.js ships no bundled types) with strict local
//      types — no `any`.
//   3. `openRazorpayCheckout` wires the modal and returns a promise that
//      resolves with the placed order. Client-side Razorpay `handler` success is
//      NOT trusted as backend truth: the handler completes the Medusa cart via
//      `onPaymentSuccess` and the discriminated-union result
//      ({ type: "order" } | { type: "cart" }) decides resolve vs reject. Cancel
//      (dismiss) and payment.failed reject without touching the cart, so the
//      cart stays intact and the button re-enables.
//
// Amounts: the Razorpay order amount arrives in paise from the payment session
// (₹749 -> 74900). It is passed to Checkout.js as-is — never multiplied or
// divided here.

import type { CompleteCartResult, PlacedOrder } from "./medusa-checkout";

/** Public Razorpay key id (client-side config, NEVER the secret). */
export const RAZORPAY_KEY_ID: string | undefined = import.meta.env.VITE_RAZORPAY_KEY_ID;

const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";

// ── Typed errors ─────────────────────────────────────────────────────────────

/** The checkout.js script could not be loaded (offline, blocked, unavailable). */
export class RazorpayLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayLoadError";
  }
}

/** A checkout step failed or was cancelled by the customer. */
export class RazorpayCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayCheckoutError";
  }
}

// ── Typed window.Razorpay global ─────────────────────────────────────────────

/** Payment success payload passed to the modal `handler`. */
export type RazorpaySuccessResponse = {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

/** Payment failure payload emitted by the `payment.failed` event. */
export type RazorpayFailureResponse = {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
  };
};

export type RazorpayCheckoutOptions = {
  key: string;
  order_id: string;
  /** Paise as supplied by the payment provider — never multiplied or divided. */
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: {
    email?: string;
    name?: string;
    contact?: string;
  };
  handler?: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

export interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: (response?: RazorpayFailureResponse) => void): void;
}

export interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayCheckout;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

// ── Script loader (browser only, never blocks SSR) ───────────────────────────

let loadPromise: Promise<RazorpayConstructor> | null = null;

/** Resolve the injected `window.Razorpay` constructor, loading checkout.js once. */
export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new RazorpayLoadError("Razorpay checkout can only run in the browser."),
    );
  }
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }
  if (!loadPromise) {
    loadPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_CHECKOUT_URL;
      script.async = true;
      script.onload = () => {
        if (window.Razorpay) {
          resolve(window.Razorpay);
        } else {
          loadPromise = null;
          reject(
            new RazorpayLoadError(
              "The Razorpay checkout script loaded but Razorpay is unavailable.",
            ),
          );
        }
      };
      script.onerror = () => {
        loadPromise = null;
        reject(
          new RazorpayLoadError(
            "Couldn't load the Razorpay checkout. Please check your connection and try again.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

/** True when a public key id is configured for this build. */
export function isRazorpayConfigured(): boolean {
  return typeof RAZORPAY_KEY_ID === "string" && RAZORPAY_KEY_ID.trim().length > 0;
}

// ── Modal orchestration ──────────────────────────────────────────────────────

export type RazorpayCheckoutRequest = {
  keyId: string | undefined;
  orderId: string;
  /** Paise as supplied by the payment provider — never multiplied or divided. */
  amount: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  /** Called by the success handler; completes the Medusa cart (backend truth). */
  onPaymentSuccess: () => Promise<CompleteCartResult>;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "We couldn't complete your payment. Your cart is saved.";
}

/**
 * Open the Razorpay checkout modal and settle when the flow finishes.
 *
 * Resolves with the placed order only when the backend cart.complete confirms
 * it ({ type: "order" }). Rejects on cancellation, payment failure, a
 * `{ type: "cart" }` completion result, or any SDK/script error — the cart is
 * never modified by a rejection, so it stays intact for a retry.
 */
export async function openRazorpayCheckout(request: RazorpayCheckoutRequest): Promise<PlacedOrder> {
  const keyId = request.keyId?.trim();
  if (!keyId) {
    throw new RazorpayCheckoutError(
      "Razorpay isn't configured on this environment yet, so no payment can be captured right now.",
    );
  }

  const Razorpay = await loadRazorpayCheckout();

  return new Promise<PlacedOrder>((resolve, reject) => {
    let settled = false;
    const settle = (settleWith: () => void) => {
      if (!settled) {
        settled = true;
        settleWith();
      }
    };

    const modal = new Razorpay({
      key: keyId,
      order_id: request.orderId,
      amount: request.amount,
      currency: request.currency,
      name: "Daily Drip",
      description: "Daily Drip order",
      prefill: {
        email: request.customerEmail,
        name: request.customerName,
        contact: request.customerPhone,
      },
      handler: () => {
        // Client-side payment success is NOT final truth — the order/payment
        // state is owned by cart.complete and the Razorpay webhook. Surface the
        // backend's answer instead of trusting the modal callback.
        void request
          .onPaymentSuccess()
          .then((result) =>
            settle(() => {
              if (result.type === "order") {
                resolve(result);
              } else {
                reject(
                  new RazorpayCheckoutError(
                    result.error?.message ??
                      "We couldn't confirm your order yet. Your cart is saved — please try again.",
                  ),
                );
              }
            }),
          )
          .catch((error: unknown) => settle(() => reject(new RazorpayCheckoutError(toErrorMessage(error)))));
      },
      // modal.ondismiss is the documented Checkout.js dismissal hook (there is
      // no instance "dismiss" event), so closing the modal rejects here.
      modal: {
        ondismiss: () => {
          settle(() =>
            reject(new RazorpayCheckoutError("Payment was cancelled — your cart is saved.")),
          );
        },
      },
    });

    modal.on("payment.failed", (response) => {
      settle(() =>
        reject(
          new RazorpayCheckoutError(
            response?.error?.description ??
              "Your payment didn't go through. Your cart is saved — please try again.",
          ),
        ),
      );
    });

    modal.open();
  });
}
