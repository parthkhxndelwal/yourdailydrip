// Signed-in order history tab for the account page.
//
// Uses the customer-scoped list API (`sdk.store.order.list`) — the backend
// filters by the JWT's customer id, so only this customer's orders can ever
// appear here. Cards link back to /order-confirmation for the full detail.

import { Link } from "@tanstack/react-router";

import {
  formatOrderDate,
  fulfillmentStatusLabel,
  orderAwb,
  paymentStatusLabel,
  useCustomerOrders,
  type StoreOrderListItem,
} from "@/lib/medusa-orders";
import { formatPrice } from "@/lib/products";

export function OrdersTab() {
  const query = useCustomerOrders();
  const orders = query.data;
  const loading = query.isPending && query.fetchStatus !== "idle";

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading your orders…</p>;
  }

  if (query.isError) {
    return (
      <div>
        <p className="font-medium">We couldn't load your orders</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong on our side. Please try again in a few minutes.
        </p>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No orders yet — your placed orders will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} />
        </li>
      ))}
    </ul>
  );
}

function OrderCard({ order }: { order: StoreOrderListItem }) {
  const itemCount = (order.items ?? []).reduce((n, item) => n + (item.quantity ?? 0), 0);
  const awb = orderAwb(order);

  return (
    <Link
      to="/order-confirmation"
      search={{ order: order.id }}
      className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{order.display_id ? `#${order.display_id}` : order.id}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Placed {formatOrderDate(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium">{formatPrice(order.total)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {paymentStatusLabel(order.payment_status)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {itemCount} item{itemCount === 1 ? "" : "s"} · {fulfillmentStatusLabel(order.fulfillment_status)}
        {awb && " · Tracking available"}
      </p>
    </Link>
  );
}
