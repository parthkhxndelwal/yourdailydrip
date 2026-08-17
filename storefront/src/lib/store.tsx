import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { customerKeys, useCustomer } from "./medusa-auth";
import {
  readCartId,
  toCartLines,
  useAddToCart,
  useCart,
  useRemoveFromCart,
  useSetQty,
  type CartLine,
} from "./medusa-cart";
import { sdk } from "./medusa";

// A product the UI can add to the Medusa cart. Medusa-mapped products carry
// variantId; the static catalog products do not (their Add buttons error).
export type CartAddable = { slug: string; name: string; variantId?: string };

const WISHLIST_KEY = "dd-wishlist";

type ShopState = {
  cart: CartLine[];
  /** True when the persisted cart could not be fetched (backend unavailable / stale id). */
  cartError: boolean;
  wishlist: string[];
  addToCart: (product: CartAddable, qty?: number, options?: { showSuccessToast?: boolean }) => void;
  setQty: (lineItemId: string, qty: number) => void;
  removeFromCart: (lineItemId: string) => void;
  toggleWishlist: (slug: string) => void;
  clearWishlist: () => void;
  inWishlist: (slug: string) => boolean;
  cartCount: number;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const ShopContext = createContext<ShopState | null>(null);

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function ShopProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const queryClient = useQueryClient();
  const customerQuery = useCustomer();
  const customer = customerQuery.data;

  const cartQuery = useCart();
  const addMutation = useAddToCart();
  const setQtyMutation = useSetQty();
  const removeMutation = useRemoveFromCart();

  useEffect(() => {
    // Legacy local cart lines are discarded — the Medusa cart is the truth.
    window.localStorage.removeItem("dd-cart");
    setWishlist(read<string[]>(WISHLIST_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // After clearWishlist() the key is gone; don't resurrect it with "[]".
    if (wishlist.length === 0 && window.localStorage.getItem(WISHLIST_KEY) === null) return;
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  // Server truth for a signed-in customer: the wishlist stored in their
  // metadata (a string[] of product slugs, when present).
  const serverWishlist = useMemo(() => {
    const raw = customer?.metadata?.wishlist;
    return Array.isArray(raw)
      ? raw.filter((s): s is string => typeof s === "string")
      : [];
  }, [customer?.metadata?.wishlist]);

  // When a signed-in customer loads, adopt the union of the device wishlist
  // and the account wishlist (device items win by being kept; account items
  // the device hasn't seen are restored).
  useEffect(() => {
    if (!hydrated || !customer) return;
    setWishlist((prev) => Array.from(new Set([...prev, ...serverWishlist])));
  }, [hydrated, customer, serverWishlist]);

  // Push local wishlist changes to the account metadata (debounced) when it
  // differs from the server copy. read-modify-write keeps other metadata keys;
  // the equality guard stops the update loop (the refetch after a push then
  // matches). Best-effort: a failed push keeps the device copy as truth.
  useEffect(() => {
    if (!hydrated || !customer) return;
    if (serverWishlist.length === 0 && wishlist.length === 0) return;
    const same =
      serverWishlist.length === wishlist.length &&
      serverWishlist.every((slug) => wishlist.includes(slug));
    if (same) return;
    const timer = window.setTimeout(() => {
      void sdk.store.customer
        .update({ metadata: { ...(customer.metadata ?? {}), wishlist } })
        .then(() => queryClient.invalidateQueries({ queryKey: customerKeys.me }))
        .catch(() => {});
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, customer, wishlist, serverWishlist, queryClient]);

  const cart = useMemo(() => toCartLines(cartQuery.data), [cartQuery.data]);

  const addToCart = useCallback(
    (product: CartAddable, qty = 1, options?: { showSuccessToast?: boolean }) => {
      if (!product.variantId) {
        toast.error("This product isn't available to add to cart yet.");
        return;
      }
      void addMutation
        .mutateAsync({ variantId: product.variantId, quantity: qty })
        .then(() => {
          if (options?.showSuccessToast !== false) {
            setCartOpen(true);
          }
        })
        .catch(() => toast.error("Couldn't add to cart. Please try again."));
    },
    [addMutation, setCartOpen],
  );

  const setQty = useCallback(
    (lineItemId: string, qty: number) => {
      const cartId = readCartId();
      if (!cartId || !lineItemId) return;
      void setQtyMutation
        .mutateAsync({ cartId, lineItemId, quantity: qty })
        .catch(() => toast.error("Couldn't update the quantity. Please try again."));
    },
    [setQtyMutation],
  );

  const removeFromCart = useCallback(
    (lineItemId: string) => {
      const cartId = readCartId();
      if (!cartId || !lineItemId) return;
      void removeMutation
        .mutateAsync({ cartId, lineItemId })
        .catch(() => toast.error("Couldn't remove the item. Please try again."));
    },
    [removeMutation],
  );

  const toggleWishlist = useCallback((slug: string) => {
    setWishlist((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  const clearWishlist = useCallback(() => {
    setWishlist([]);
    try {
      window.localStorage.removeItem(WISHLIST_KEY);
    } catch {
      // Best-effort cleanup; the in-memory state is the source of truth.
    }
  }, []);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const value = useMemo<ShopState>(
    () => ({
      cart,
      cartError: cartQuery.isError,
      wishlist,
      addToCart,
      setQty,
      removeFromCart,
      toggleWishlist,
      clearWishlist,
      inWishlist: (slug: string) => wishlist.includes(slug),
      cartCount: cart.reduce((n, l) => n + l.quantity, 0),
      cartOpen,
      openCart,
      closeCart,
    }),
    [cart, cartQuery.isError, wishlist, addToCart, setQty, removeFromCart, toggleWishlist, clearWishlist, cartOpen, openCart, closeCart],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}
