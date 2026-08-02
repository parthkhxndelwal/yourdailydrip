// Order confirmation page — the destination after a completed checkout.
//
// Reads the placed order id from the `order` search param, retrieves the order
// via the shared Medusa SDK (`sdk.store.order.retrieve`, the public guest
// lookup — Medusa's GET /store/orders/:id has no auth, so the id is the key)
// and renders the id, items, totals, payment status and — once the iThink
// shipment exists — the AWB with a link to /track-order. Without an order id
// the page redirects home instead of guessing or exposing another order.
//
// No hardcoded confirmation content: everything renders from the fetched
// order. Prices are as-is INR amounts (749 = 749), never divided.

import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, PackageSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import {
  formatOrderDate,
  fulfillmentStatusLabel,
  orderAwb,
  paymentStatusLabel,
  useOrder,
  type StoreOrder,
} from "@/lib/medusa-orders";
import { formatPrice } from "@/lib/products";

export const Route = createFileRoute("/order-confirmation")({
  validateSearch: (search: Record<string, unknown>): { order?: string } => ({
    order: typeof search.order === "string" ? search.order : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Order Confirmation — Daily Drip" },
      { name: "description", content: "Your Daily Drip order confirmation — items, totals and shipping tracking." },
      { property: "og:title", content: "Order Confirmation — Daily Drip" },
      { property: "og:description", content: "Review your Daily Drip order confirmation." },
    ],
  }),
  component: OrderConfirmation,
});

function OrderConfirmation() {
  const { order: orderId } = Route.useSearch();
  const navigate = useNavigate();

  // No order id in the URL: this page cannot show anything meaningful (and must
  // not guess), so send the visitor home. SSR renders null first; the redirect
  // runs once hydration completes.
  useEffect(() => {
    if (!orderId) {
      navigate({ to: "/" });
    }
  }, [orderId, navigate]);

  const query = useOrder(orderId);
  const order = query.data;
  const loading = query.isPending && query.fetchStatus !== "idle";

  if (!orderId) return null;

  if (loading) {
    return (
      <PageShell eyebrow="Order" title="Loading your order…" intro="Pulling up your confirmation details.">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Fetching your order…</p>
        </div>
      </PageShell>
    );
  }

  if (query.isError || !order) {
    return (
      <PageShell eyebrow="Order" title="We couldn't find that order" intro="Double-check the link from your confirmation email and try again.">
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <PackageSearch className="mx-auto text-muted-foreground" size={40} />
          <p className="mt-4 text-muted-foreground">
            Something went wrong loading this order. If you just placed it, give it a moment and try again.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Order placed"
      title="Thank you — your order is confirmed"
      intro={`Order ${order.display_id ? `#${order.display_id}` : order.id} · placed on ${formatOrderDate(order.created_at)}`}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-leaf" size={22} />
            <div>
              <p className="font-medium">Order {order.id}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We've received your order and will email you once it ships.
              </p>
            </div>
          </div>
        </div>

        <OrderItems order={order} />
        <OrderTotals order={order} />
        <TrackingSection order={order} />
      </div>
    </PageShell>
  );
}

function OrderItems({ order }: { order: StoreOrder }) {
  const items = order.items ?? [];
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg">Your items</h2>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.title}
                width={64}
                height={64}
                loading="lazy"
                className="size-16 rounded-lg bg-sand object-cover"
              />
            ) : (
              <div className="size-16 rounded-lg bg-sand" aria-hidden="true" />
            )}
            <div className="flex-1">
              <p className="font-medium">{item.title}</p>
              {item.variant_title && (
                <p className="text-sm text-muted-foreground">{item.variant_title}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Qty {item.quantity} × {formatPrice(item.unit_price)}
              </p>
            </div>
            <p className="font-display">{formatPrice(item.total)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrderTotals({ order }: { order: StoreOrder }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg">Summary</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatPrice(order.item_subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd>{formatPrice(order.shipping_total)}</dd>
        </div>
        {order.discount_total > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Discounts</dt>
            <dd>−{formatPrice(order.discount_total)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
          <dt>Total</dt>
          <dd>{formatPrice(order.total)}</dd>
        </div>
      </dl>
      <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Payment</dt>
          <dd>{paymentStatusLabel(order.payment_status)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Fulfillment</dt>
          <dd>{fulfillmentStatusLabel(order.fulfillment_status)}</dd>
        </div>
      </dl>
    </section>
  );
}

function TrackingSection({ order }: { order: StoreOrder }) {
  const awb = orderAwb(order);
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg">Tracking</h2>
      {awb ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Tracking number{" "}
            <span className="font-medium text-foreground">{awb}</span>
          </p>
          <Button className="mt-4" asChild>
            <Link to="/track-order" search={{ awb }}>
              Track your order
            </Link>
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Tracking will appear here once your shipment is created. We'll send
          your AWB by email as soon as it's available.
        </p>
      )}
    </section>
  );
}
