// Checkout order summary sidebar. Shipping/total use the server cart totals
// once a method is attached; no hardcoded shipping prices.

import type { CartLine } from "@/lib/medusa-cart";
import { formatPrice } from "@/lib/products";

export function CheckoutSummary({
  lines,
  shippingAmount,
  hasShipping,
}: {
  lines: CartLine[];
  shippingAmount: number;
  hasShipping: boolean;
}) {
  const subtotal = lines.reduce((n, line) => n + line.lineTotal, 0);
  return (
    <aside className="h-fit rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg">Order summary</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {line.title} × {line.quantity}
            </span>
            <span>{formatPrice(line.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd>{hasShipping ? formatPrice(shippingAmount) : "Selected at checkout"}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
          <dt>Total</dt>
          <dd>{formatPrice(subtotal + shippingAmount)}</dd>
        </div>
      </dl>
    </aside>
  );
}
