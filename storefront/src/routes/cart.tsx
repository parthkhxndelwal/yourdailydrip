import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { CheckoutAuthModal } from "@/components/checkout/CheckoutAuthModal";
import { Button } from "@/components/ui/button";
import { hasAuthToken } from "@/lib/medusa-auth";
import { formatPrice } from "@/lib/products";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Daily Drip" },
      { name: "description", content: "Review the skin and hair care products in your Daily Drip cart before checkout." },
      { property: "og:title", content: "Your Cart — Daily Drip" },
      { property: "og:description", content: "Review your Daily Drip order before checkout." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, cartError, setQty, removeFromCart } = useShop();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const subtotal = cart.reduce((n, line) => n + line.lineTotal, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-4xl">Your cart</h1>

      {cartError ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">
            We couldn't load your cart right now. Please try again shortly.
          </p>
          <Button className="mt-5" asChild>
            <Link to="/shop">Back to shop</Link>
          </Button>
        </div>
      ) : cart.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button className="mt-5" asChild>
            <Link to="/shop">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
          <ul className="space-y-4">
            {cart.map((line) => (
              <li key={line.id} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                {line.thumbnail ? (
                  <img
                    src={line.thumbnail}
                    alt={line.title}
                    width={96}
                    height={96}
                    loading="lazy"
                    className="size-24 rounded-lg bg-sand object-cover"
                  />
                ) : (
                  <div className="size-24 rounded-lg bg-sand" aria-hidden="true" />
                )}
                <div className="flex-1">
                  {line.slug ? (
                    <Link to="/product/$slug" params={{ slug: line.slug }} className="font-medium">
                      {line.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{line.title}</span>
                  )}
                  {line.size && <p className="text-sm text-muted-foreground">{line.size}</p>}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center rounded-md border border-border">
                      <button className="px-2.5 py-1" aria-label="Decrease" onClick={() => setQty(line.id, line.quantity - 1)}>−</button>
                      <span className="w-7 text-center text-sm">{line.quantity}</span>
                      <button className="px-2.5 py-1" aria-label="Increase" onClick={() => setQty(line.id, line.quantity + 1)}>+</button>
                    </div>
                    <button
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remove item"
                      onClick={() => removeFromCart(line.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="font-display text-lg">{formatPrice(line.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>Calculated at checkout</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
                <dt>Total</dt><dd>{formatPrice(subtotal)}</dd>
              </div>
            </dl>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                if (hasAuthToken()) {
                  navigate({ to: "/checkout" });
                } else {
                  setAuthOpen(true);
                }
              }}
            >
              Proceed to checkout
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Shipping is calculated at checkout from your delivery address.
            </p>
          </aside>
        </div>
      )}
      <CheckoutAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        onAuthenticated={() => navigate({ to: "/checkout" })}
      />
    </div>
  );
}
