// Medusa-backed cart data layer for the storefront.
//
// Replaces the legacy localStorage `dd-cart` line list — the Medusa server cart
// is now the source of truth and the old key is discarded (never read). The only
// localStorage this layer owns is the persisted cart id under `dd-cart-id`, so a
// refresh keeps the same Medusa cart. Wishlist stays in localStorage
// (`dd-wishlist`) untouched.
//
// All reads/mutations go through the shared Medusa JS SDK client in ./medusa.ts
// (never raw fetch, never JSON.stringify). TanStack Query owns server state:
// useQuery for cart retrieval, useMutation for create/add/update/remove, and
// mutation success only invalidates cart keys (never the product catalog).
//
// Prices are as-is INR amounts (749 = 749). Never divide by 100.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sdk } from "./medusa";
import { REGION_ID } from "./medusa-hooks";

// ── Cart id persistence (localStorage) ──────────────────────────────────────

export const CART_ID_KEY = "dd-cart-id";

export function readCartId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CART_ID_KEY);
  } catch {
    return null;
  }
}

function writeCartId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_ID_KEY, id);
  } catch {
    // Persistence is best-effort; a fresh cart is created on the next add.
  }
}

/**
 * Drop the persisted cart id after a cart has been completed into an order, so
 * revisiting /checkout does not refetch the completed cart. Best-effort: a
 * failed removal just means the next cart query errors out to the empty state.
 */
export function clearCartId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_ID_KEY);
  } catch {
    // Best-effort cleanup; the cart query treats a missing id as an empty cart.
  }
}

// Serializes concurrent first-adds so a double-click creates one cart, not two.
let creatingCart: Promise<string> | null = null;

async function ensureCartId(): Promise<string> {
  const existing = readCartId();
  if (existing) return existing;
  if (!creatingCart) {
    creatingCart = sdk.store.cart
      .create({ region_id: REGION_ID })
      .then(({ cart }) => {
        writeCartId(cart.id);
        return cart.id;
      })
      .finally(() => {
        creatingCart = null;
      });
  }
  return creatingCart;
}

// ── Types ───────────────────────────────────────────────────────────────────

// Resolved from the installed SDK's own method signature so this always matches
// the actual response type.
export type StoreCart = Awaited<ReturnType<typeof sdk.store.cart.retrieve>>["cart"];

// App-facing line representation so the cart page can render
// slug/name/size/image/unit price/qty/line total without touching the SDK.
export type CartLine = {
  id: string;
  variantId?: string;
  slug?: string;
  title: string;
  size?: string;
  thumbnail?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

// Fields requested on every cart retrieve. The Store API only returns
// relations/computed totals when explicitly requested. The checkout flow also
// reads email/shipping_address/shipping_methods + the cart totals.
const CART_FIELDS =
  "id,region_id,currency_code,email,shipping_address.*,shipping_methods.*,shipping_total,subtotal,item_subtotal,total,items.id,items.title,items.subtitle,items.thumbnail,items.quantity,items.product_id,items.product_handle,items.product_title,items.variant_id,items.variant_title,items.unit_price,items.total,items.subtotal,items.item_subtotal,items.metadata";

// ── Pure line mapper ────────────────────────────────────────────────────────

export function toCartLines(cart: StoreCart | null | undefined): CartLine[] {
  const items = cart?.items ?? [];
  return items.map((item) => {
    const unitPrice = item.unit_price ?? 0;
    const quantity = item.quantity ?? 0;
    return {
      id: item.id,
      variantId: item.variant_id,
      slug: item.product_handle || undefined,
      title: item.product_title || item.title,
      size: item.variant_title || item.subtitle || undefined,
      thumbnail: item.thumbnail ?? null,
      unitPrice,
      quantity,
      lineTotal: item.total ?? unitPrice * quantity,
    };
  });
}

// ── TanStack Query key factory (cart only) ──────────────────────────────────

export const cartKeys = {
  all: ["medusa", "cart"] as const,
  detail: (cartId: string) => ["medusa", "cart", cartId] as const,
} as const;

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch the persisted Medusa cart (or null when no cart id exists yet).
 */
export function useCart() {
  const cartId = readCartId();
  return useQuery<StoreCart | null, Error>({
    queryKey: cartKeys.detail(cartId ?? "none"),
    queryFn: async () => {
      if (!cartId) return null;
      const { cart } = await sdk.store.cart.retrieve(cartId, {
        fields: CART_FIELDS,
      });
      return cart;
    },
    enabled: typeof window !== "undefined" && !!cartId,
    staleTime: 30_000,
  });
}

/**
 * Add a product variant to the cart. The first add creates the Medusa cart
 * (India region), persists its id, then adds the line item.
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { variantId: string; quantity: number }>({
    mutationFn: async ({ variantId, quantity }) => {
      const cartId = await ensureCartId();
      await sdk.store.cart.createLineItem(cartId, {
        variant_id: variantId,
        quantity: Math.max(1, quantity),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

/**
 * Update a line item's quantity (Medusa line item id). A quantity <= 0 removes
 * the line item instead.
 */
export function useSetQty() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { cartId: string; lineItemId: string; quantity: number }
  >({
    mutationFn: async ({ cartId, lineItemId, quantity }) => {
      if (quantity <= 0) {
        await sdk.store.cart.deleteLineItem(cartId, lineItemId);
        return;
      }
      await sdk.store.cart.updateLineItem(cartId, lineItemId, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

/**
 * Remove a line item from the cart (Medusa line item id).
 */
export function useRemoveFromCart() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { cartId: string; lineItemId: string }>({
    mutationFn: async ({ cartId, lineItemId }) => {
      await sdk.store.cart.deleteLineItem(cartId, lineItemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}
