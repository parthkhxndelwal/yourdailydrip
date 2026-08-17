import { Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { CheckoutAuthModal } from "@/components/checkout/CheckoutAuthModal";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { hasAuthToken } from "@/lib/medusa-auth";
import { formatPrice } from "@/lib/products";
import { useShop } from "@/lib/store";

export function CartSheet() {
  const { cart, cartError, cartOpen, closeCart, setQty, removeFromCart } = useShop();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  const itemCount = cart.reduce((n, line) => n + line.quantity, 0);
  const subtotal = cart.reduce((n, line) => n + line.lineTotal, 0);

  return (
    <>
      <Sheet
        open={cartOpen}
        onOpenChange={(open) => {
          if (!open) closeCart();
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-4 py-4 pr-12 text-left">
            <SheetTitle className="font-display text-xl">Your Cart</SheetTitle>
            <SheetDescription>
              {itemCount === 0
                ? "Your cart is empty"
                : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {cartError ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-sm text-muted-foreground">
                  We couldn't load your cart right now. Please try again shortly.
                </p>
                <Button
                  onClick={() => {
                    closeCart();
                    navigate({ to: "/shop" });
                  }}
                >
                  Back to shop
                </Button>
              </div>
            ) : cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
                <Button
                  onClick={() => {
                    closeCart();
                    navigate({ to: "/shop" });
                  }}
                >
                  Start shopping
                </Button>
              </div>
            ) : (
              <ul className="space-y-3 px-4 py-4">
                {cart.map((line) => (
                  <li
                    key={line.id}
                    className="flex gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    {line.thumbnail ? (
                      <img
                        src={line.thumbnail}
                        alt={line.title}
                        width={80}
                        height={80}
                        loading="lazy"
                        className="size-20 rounded-lg bg-sand object-cover"
                      />
                    ) : (
                      <div className="size-20 rounded-lg bg-sand" aria-hidden="true" />
                    )}
                    <div className="flex-1">
                      {line.slug ? (
                        <Link
                          to="/product/$slug"
                          params={{ slug: line.slug }}
                          onClick={closeCart}
                          className="font-medium text-sm"
                        >
                          {line.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-sm">{line.title}</span>
                      )}
                      {line.size && <p className="text-xs text-muted-foreground">{line.size}</p>}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center rounded-md border border-border">
                          <button
                            className="px-2.5 py-1"
                            aria-label="Decrease"
                            onClick={() => setQty(line.id, line.quantity - 1)}
                          >
                            −
                          </button>
                          <span className="w-7 text-center text-sm">{line.quantity}</span>
                          <button
                            className="px-2.5 py-1"
                            aria-label="Increase"
                            onClick={() => setQty(line.id, line.quantity + 1)}
                          >
                            +
                          </button>
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
                    <p className="font-display text-base">{formatPrice(line.lineTotal)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!cartError && cart.length > 0 && (
            <div className="border-t border-border p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd>Calculated at checkout</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
                  <dt>Total</dt>
                  <dd>{formatPrice(subtotal)}</dd>
                </div>
              </dl>
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  if (hasAuthToken()) {
                    closeCart();
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
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        onAuthenticated={() => {
          closeCart();
          navigate({ to: "/checkout" });
        }}
      />
    </>
  );
}