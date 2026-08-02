// Medusa-backed order data layer for the storefront.
//
// Two Store API surfaces are used:
//   1. `sdk.store.order.retrieve(id, { fields })` — public guest lookup for the
//      /order-confirmation page. Medusa's GET /store/orders/:id carries no
//      auth middleware, so the order id is the key (the plan's guest
//      confirmation flow); the confirmation route never lists orders.
//   2. `sdk.store.order.list({ fields })` — customer-scoped history for the
//      account Orders tab. GET /store/orders requires a customer JWT and is
//      filtered server-side by `req.auth_context.actor_id`, so a signed-in
//      customer can only ever see their own orders.
//
// Types are derived from the installed SDK's own method signatures so they
// cannot drift. Explicit `fields` are passed on every call because the Store
// API only returns relations/computed totals when requested (same rule as the
// cart layer). Prices are as-is INR amounts (749 = 749) — never divide.
//
// The iThink AWB lives on fulfillment data (todo 11 stores it under
// `fulfillment.data.awb`); `orderAwb()` reads it without reaching into the
// backend, and the tracking snapshot for it is served by /track-order.

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { sdk } from "./medusa";
import { hasAuthToken } from "./medusa-auth";

// ── SDK-derived types ────────────────────────────────────────────────────────

export type StoreOrder = Awaited<ReturnType<typeof sdk.store.order.retrieve>>["order"];

export type StoreOrderListItem = Awaited<
  ReturnType<typeof sdk.store.order.list>
>["orders"][number];

// Fields requested on every single-order retrieve: all scalar fields plus the
// relations the confirmation page renders (items for lines, shipping address,
// shipping methods, payment collections + their payments for payment status,
// fulfillments for the AWB). `payment_status`/`fulfillment_status` are NOT in
// Medusa's default retrieve fields, so they are requested explicitly.
const ORDER_FIELDS =
  "id,display_id,email,currency_code,status,payment_status,fulfillment_status,created_at,metadata," +
  "*shipping_address,*billing_address," +
  "*items,*items.variant," +
  "*shipping_methods," +
  "*payment_collections,*payment_collections.payments," +
  "*fulfillments," +
  "*summary," +
  "item_total,item_subtotal,shipping_total,shipping_subtotal,tax_total,discount_total,original_total,original_subtotal,total,subtotal";

// Compact field set for the account order history list (cards need id, date,
// total, statuses, item count and the AWB presence).
const ORDER_LIST_FIELDS =
  "id,display_id,email,currency_code,status,payment_status,fulfillment_status,created_at,total,subtotal,shipping_total," +
  "*items,*shipping_address,*fulfillments,*payment_collections";

// ── TanStack Query key factory (orders only) ────────────────────────────────

export const orderKeys = {
  all: ["medusa", "orders"] as const,
  detail: (orderId: string) => ["medusa", "orders", orderId] as const,
  customer: ["medusa", "orders", "customer"] as const,
} as const;

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch a single order by its id for the confirmation page. Disabled while no
 * id is present (the route redirects home in that case). A bad/unknown id
 * surfaces as a query error for the friendly error state.
 */
export function useOrder(orderId?: string) {
  const id = orderId?.trim() ?? "";
  return useQuery<StoreOrder, Error>({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const { order } = await sdk.store.order.retrieve(id, { fields: ORDER_FIELDS });
      return order;
    },
    enabled: id.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Fetch the signed-in customer's order history via the customer-scoped list
 * API. Disabled (never hits the network) until a customer JWT exists.
 */
export function useCustomerOrders() {
  return useQuery<StoreOrderListItem[], Error>({
    queryKey: orderKeys.customer,
    queryFn: async () => {
      const { orders } = await sdk.store.order.list({
        fields: ORDER_LIST_FIELDS,
        limit: 50,
      });
      return orders;
    },
    enabled: hasAuthToken(),
    staleTime: 30_000,
    retry: false,
  });
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * The iThink AWB (waybill) for an order, read from the first fulfillment that
 * carries one. Todo 11 stores the waybill under `fulfillment.data.awb`;
 * `metadata.awb` is a fallback for future providers. Returns undefined when no
 * shipment exists yet — the UI then shows honest "tracking will appear once
 * your order ships" copy instead of fabricating one.
 */
export function orderAwb(order: StoreOrder | StoreOrderListItem): string | undefined {
  for (const fulfillment of order.fulfillments ?? []) {
    const data = fulfillment.data;
    const dataAwb = data && typeof data.awb === "string" ? data.awb : "";
    if (dataAwb.length > 0) return dataAwb;
    const metadata = fulfillment.metadata;
    const metaAwb = metadata && typeof metadata.awb === "string" ? metadata.awb : "";
    if (metaAwb.length > 0) return metaAwb;
  }
  return undefined;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  not_paid: "Not paid",
  awaiting: "Awaiting payment",
  authorized: "Payment authorized",
  partially_authorized: "Partially authorized",
  captured: "Payment captured",
  partially_captured: "Partially captured",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  canceled: "Payment canceled",
  requires_action: "Action required",
};

export function paymentStatusLabel(status?: string): string {
  return (status && PAYMENT_STATUS_LABELS[status]) || "—";
}

const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  not_fulfilled: "Not yet shipped",
  partially_fulfilled: "Partially fulfilled",
  fulfilled: "Fulfilled",
  partially_shipped: "Partially shipped",
  shipped: "Shipped",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  canceled: "Fulfillment canceled",
};

export function fulfillmentStatusLabel(status?: string): string {
  return (status && FULFILLMENT_STATUS_LABELS[status]) || "—";
}

/** Friendly date for order cards/headers (created_at is a Date or ISO string). */
export function formatOrderDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMM yyyy");
}
