// Checkout flow: address → payment → complete.
//
// Uses the Medusa server cart from lib/medusa-cart (same cart query + cart id
// persistence). Submitting the address updates the cart (email + shipping and
// billing address), then auto-attaches the CHEAPEST shipping option the
// fulfillment provider returns for that address and lands on payment — there is
// no manual shipping selection step. The SDK calls live here as typed
// mutations/queries:
//   cart.update (email + address), fulfillment.listCartOptions (shipping
//   options), cart.addShippingMethod (cheapest). No raw fetch, no
//   JSON.stringify, plain object bodies, INR amounts as-is.
//
// Payment (todo 10): the payment step initiates a Razorpay payment session
// (sdk.store.payment.initiatePaymentSession → pp_razorpay_razorpay), opens the
// Razorpay Checkout.js modal, and only on success calls sdk.store.cart.complete.
// Client-side payment success is NOT backend truth — the completed order comes
// from cart.complete's { type: "order" } result (webhook owns the rest), and a
// { type: "cart" } result surfaces the backend error. On success the route
// clears the completed cart id and navigates to /order-confirmation?order=<id>.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { CheckoutAddressForm } from "@/components/checkout/CheckoutAddressForm";
import { CheckoutAuthModal } from "@/components/checkout/CheckoutAuthModal";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { PaymentStep } from "@/components/checkout/PaymentStep";
import { StepIndicator, type CheckoutStep } from "@/components/checkout/StepIndicator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateAddress,
  useCustomerAddresses,
  toCreateAddressBody,
} from "@/lib/medusa-addresses";
import { cartKeys, clearCartId, toCartLines, useCart, type StoreCart } from "@/lib/medusa-cart";
import { sdk } from "@/lib/medusa";
import { hasAuthToken, healIfUnauthorized, useCustomer } from "@/lib/medusa-auth";
import { initiateRazorpaySession } from "@/lib/medusa-payment";
import {
  fetchShippingRateHints,
  toAddressPayload,
  type PlacedOrder,
  type ShippingAddressForm,
} from "@/lib/medusa-checkout";
import { loadRazorpayCheckout, openRazorpayCheckout, RAZORPAY_KEY_ID } from "@/lib/razorpay";

// Thrown by the address mutation when the fulfillment provider returns no
// shipping options for the submitted address — surfaced inline on the address
// step instead of a generic toast.
class CheckoutShippingError extends Error {}

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Daily Drip" },
      {
        name: "description",
        content: "Complete your Daily Drip order — address, shipping, payment and confirmation.",
      },
      { property: "og:title", content: "Checkout — Daily Drip" },
      { property: "og:description", content: "Complete your Daily Drip order." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const cartQuery = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cart = cartQuery.data;
  // Hydration-safe loading gate: the cart query never fetches on the server
  // (fetchStatus stays "idle"), so SSR renders the empty state. The first
  // client render must match that — only after mount (useEffect) may we show
  // the loading state, and only when a fetch is genuinely in flight. A disabled
  // query (no cart id) stays "idle" forever, so it correctly falls through to
  // the empty state instead of showing "Loading your cart…" forever.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const loading = mounted && cartQuery.isPending && cartQuery.fetchStatus !== "idle";

  // Guests can't reach the checkout steps — block them behind the sign-in
  // modal. Must depend on `mounted`: SSR and the first client render both see
  // hasAuthToken() === false (no JWT on the server), so without the flag a
  // signed-in user would hit a hydration mismatch.
  const signedOut = mounted && !hasAuthToken();

  if (signedOut) {
    return (
      <CheckoutShell>
        <CheckoutAuthModal
          open
          onOpenChange={(open) => {
            if (!open) navigate({ to: "/shop" });
          }}
          onAuthenticated={() => {}}
        />
      </CheckoutShell>
    );
  }

  // Order placed: drop the completed cart id so /checkout starts fresh, then
  // hand the order id to the confirmation page.
  const handleOrderPlaced = (order: PlacedOrder) => {
    clearCartId();
    queryClient.invalidateQueries({ queryKey: cartKeys.all });
    navigate({ to: "/order-confirmation", search: { order: order.order.id } });
  };

  if (loading) return <CheckoutShell>Loading your cart…</CheckoutShell>;
  if (cartQuery.isError || !cart || toCartLines(cart).length === 0) {
    return (
      <CheckoutShell>
        <CheckoutEmpty error={cartQuery.isError} />
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <CheckoutFlow key={cart.id} cart={cart} onOrderPlaced={handleOrderPlaced} />
    </CheckoutShell>
  );
}

function CheckoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-4xl">Checkout</h1>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function CheckoutFlow({
  cart,
  onOrderPlaced,
}: {
  cart: StoreCart;
  onOrderPlaced: (order: PlacedOrder) => void;
}) {
  const queryClient = useQueryClient();
  const customerQuery = useCustomer();
  const addressesQuery = useCustomerAddresses();
  const createAddress = useCreateAddress();
  // Hydration-safe auth flag: SSR and the first client render both see
  // hasAuthToken() === false, so signedIn must wait for mount (like the route's
  // signedOut gate above).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const signedIn = mounted && hasAuthToken();
  // Resume a mid-checkout session: shipping method present → payment step;
  // otherwise start at the address step (a shipping address only counts once a
  // method is attached — the cheapest option is auto-selected on submit).
  const [step, setStep] = useState<CheckoutStep>(() =>
    (cart.shipping_methods?.length ?? 0) > 0 ? "payment" : "address",
  );
  // Inline error for an address the fulfillment provider can't ship to.
  const [shippingError, setShippingError] = useState<string | null>(null);

  const cartId = cart.id;
  const shippingDone = (cart.shipping_methods?.length ?? 0) > 0;
  const shippingAmount = shippingDone ? (cart.shipping_total ?? 0) : 0;

  // iThink rate hints for the delivery pincode on the cart (persisted when the
  // address step submits). Purely informational — cheapest/fastest courier +
  // expected delivery date — and non-blocking: the query is disabled without a
  // valid 6-digit pincode, retries nothing, and any backend failure maps to
  // null inside fetchShippingRateHints, so checkout proceeds regardless.
  const deliveryPincode = cart.shipping_address?.postal_code?.trim() ?? "";
  const cartMrp = typeof cart.item_total === "number" && cart.item_total > 0 ? cart.item_total : undefined;
  const hintsQuery = useQuery({
    queryKey: ["medusa", "ithink", "rate-hints", deliveryPincode, cartMrp ?? "no-mrp"],
    queryFn: () => fetchShippingRateHints(deliveryPincode, cartMrp),
    enabled: /^\d{6}$/.test(deliveryPincode),
    staleTime: 60_000,
    retry: false,
  });

  const updateAddress = useMutation<void, Error, { email: string; address: ShippingAddressForm }>({
    mutationFn: async ({ email, address }) => {
      await sdk.store.cart.update(cartId, {
        email,
        shipping_address: toAddressPayload(address),
        billing_address: toAddressPayload(address),
      });
      const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
        cart_id: cartId,
      });
      if (shipping_options.length === 0) {
        throw new CheckoutShippingError(
          "We couldn't find shipping options for this address yet. Please try a different address.",
        );
      }
      const priced = shipping_options.filter((o) => typeof o.amount === "number");
      const cheapest = (priced.length ? priced : shipping_options).reduce((a, b) =>
        b.amount < a.amount ? b : a,
      );
      await sdk.store.cart.addShippingMethod(cartId, { option_id: cheapest.id });
    },
    onMutate: () => {
      setShippingError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      setStep("payment");
    },
    onError: (error) => {
      if (error instanceof CheckoutShippingError) {
        setShippingError(error.message);
      } else {
        toast.error("Couldn't save your address. Please try again.");
      }
    },
  });

  // Full payment flow: initiate the Razorpay session, load checkout.js, open
  // the modal, and only on payment success complete the Medusa cart. Resolves
  // with the placed order ({ type: "order" }) or rejects (cancel, failed
  // payment, { type: "cart" }) leaving the cart intact.
  const handlePay = async (): Promise<PlacedOrder> => {
    const info = await initiateRazorpaySession(cart);
    await loadRazorpayCheckout();
    return openRazorpayCheckout({
      keyId: RAZORPAY_KEY_ID,
      orderId: info.orderId,
      amount: info.amount,
      currency: info.currency,
      customerEmail: info.customerEmail,
      customerName: info.customerName,
      customerPhone: info.customerPhone,
      onPaymentSuccess: async () => sdk.store.cart.complete(cartId),
    });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <StepIndicator current={step} />

        {step === "address" && (
          <div className="space-y-4">
            <CheckoutAddressForm
              defaultEmail={cart.email ?? customerQuery.data?.email ?? undefined}
              defaultAddress={cart.shipping_address}
              pending={updateAddress.isPending}
              savedAddresses={addressesQuery.data}
              signedIn={signedIn}
              shippingError={shippingError}
              onSaveAddress={(address) => {
                createAddress.mutate(
                  toCreateAddressBody(address, cart.email ?? customerQuery.data?.email ?? ""),
                  {
                    onError: (error) => {
                      // A stale JWT fails the account save with 401. The order
                      // address is already saved to the cart, so heal the
                      // session silently instead of alarming the customer.
                      if (healIfUnauthorized(error)) return;
                      toast.error(
                        "Address saved for this order, but we couldn't save it to your account.",
                      );
                    },
                  },
                );
              }}
              onSubmit={(email, address) => updateAddress.mutate({ email, address })}
            />
            {mounted && hintsQuery.isPending && hintsQuery.fetchStatus !== "idle" && (
              <div className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-4 w-1/2" />
              </div>
            )}
            {mounted && hintsQuery.data && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  Cheapest: {hintsQuery.data.cheapest.logistic} INR {hintsQuery.data.cheapest.rate}
                  {hintsQuery.data.expected_delivery_date
                    ? ` (est. ${hintsQuery.data.expected_delivery_date})`
                    : ""}
                  {" · "}Fastest: {hintsQuery.data.fastest.logistic} INR{" "}
                  {hintsQuery.data.fastest.rate}
                </p>
              </div>
            )}
          </div>
        )}

        {step === "payment" && (
          <PaymentStep
            cart={cart}
            onPay={handlePay}
            onOrderPlaced={onOrderPlaced}
            onBack={() => setStep("address")}
          />
        )}
      </div>

      <CheckoutSummary
        lines={toCartLines(cart)}
        shippingAmount={shippingAmount}
        hasShipping={shippingDone}
      />
    </div>
  );
}

function CheckoutEmpty({ error }: { error: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <p className="text-muted-foreground">
        {error
          ? "We couldn't load your cart right now. Please try again."
          : "Your cart is empty — add a few Daily Drip essentials before checking out."}
      </p>
      <Button className="mt-5" asChild>
        <Link to="/shop">Back to shop</Link>
      </Button>
    </div>
  );
}
