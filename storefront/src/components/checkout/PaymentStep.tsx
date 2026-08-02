// Checkout payment/review step — Razorpay Checkout.js integration.
//
// "Pay with Razorpay" triggers the route's payment flow: initiate the Razorpay
// payment session (sdk.store.payment.initiatePaymentSession with provider
// pp_razorpay_razorpay), load checkout.js, open the modal, and on success
// complete the Medusa cart. Client-side payment success is NOT final truth —
// the backend (cart.complete + Razorpay webhook) owns order/payment state, so
// the review copy never claims "payment captured" from the modal alone.
//
// Cancel or a failed payment rejects the flow: the cart is untouched and the
// button re-enables. When VITE_RAZORPAY_KEY_ID is missing the step shows an
// honest "not configured" state instead of faking a payment.

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { StoreCart } from "@/lib/medusa-cart";
import { formatAddressLine, type PlacedOrder } from "@/lib/medusa-checkout";
import { formatPrice } from "@/lib/products";
import { isRazorpayConfigured } from "@/lib/razorpay";

export function PaymentStep({
  cart,
  onPay,
  onOrderPlaced,
  onBack,
}: {
  cart: StoreCart;
  onPay: () => Promise<PlacedOrder>;
  onOrderPlaced: (order: PlacedOrder) => void;
  onBack: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isRazorpayConfigured();
  const method = cart.shipping_methods?.[0];
  const total = cart.total ?? 0;

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const order = await onPay();
      onOrderPlaced(order);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Payment couldn't be completed. Your cart is saved.";
      setError(message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg">Payment &amp; review</h2>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="text-right">{cart.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Ship to</dt>
          <dd className="text-right">{formatAddressLine(cart.shipping_address)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd className="text-right">{method?.name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-2">
          <dt className="font-medium">Amount to pay</dt>
          <dd className="font-medium">{formatPrice(total)}</dd>
        </div>
      </dl>

      {configured ? (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            You'll pay securely through Razorpay. Your order is confirmed by the store after payment —
            a successful payment alone isn't final until we confirm it.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={onBack} disabled={paying}>
              Back
            </Button>
            <Button onClick={handlePay} disabled={paying} className="flex-1">
              {paying && <Loader2 className="size-4 animate-spin" />}
              {paying ? "Opening Razorpay…" : `Pay ${formatPrice(total)}`}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            Razorpay isn't configured on this environment yet (VITE_RAZORPAY_KEY_ID is missing), so no
            payment can be captured right now. Nothing was charged and your cart is saved.
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button disabled className="flex-1">
              Pay with Razorpay
            </Button>
          </div>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
