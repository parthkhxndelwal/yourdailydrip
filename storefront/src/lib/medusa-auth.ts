// Medusa-backed customer authentication layer for the storefront.
//
// Customer auth lives on the auth identity (emailpass), not the customer
// profile: `sdk.auth.register("customer", "emailpass", { email, password })`
// creates the identity and returns a registration JWT; the SDK stores it and
// auto-attaches `Authorization: Bearer` to subsequent calls, so
// `sdk.store.customer.create({ email, first_name, last_name })` completes the
// profile with that token. Note the SDK's StoreCreateCustomer type has NO
// `password` field — the password belongs to the auth identity only.
//
// Login stores the returned customer JWT the same way (SDK default storage =
// localStorage under the documented key `medusa_auth_token`), and
// `sdk.auth.logout()` clears it. TRADEOFF (v1, acknowledged): the JWT is kept
// in localStorage unencrypted so a refresh keeps the session; acceptable for
// v1 per plan, revisit (httpOnly cookie / session storage) in a hardening wave.
//
// All calls go through the shared Medusa JS SDK client in ./medusa.ts (never
// raw fetch, never JSON.stringify). No admin endpoints are used.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FetchError } from "@medusajs/js-sdk";

import { cartKeys, clearCartId } from "./medusa-cart";
import { sdk } from "./medusa";

// ── Auth state helpers ──────────────────────────────────────────────────────

// Documented SDK default: the JWT lives in localStorage under this key.
export const AUTH_TOKEN_KEY = "medusa_auth_token";

/** True when a customer JWT is present in the SDK's default storage. */
export function hasAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) !== null;
  } catch {
    return false;
  }
}

/** Drop the stored customer JWT (best-effort) — used to heal stale sessions. */
export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Best-effort; hasAuthToken() re-reads storage every call.
  }
}

/** True when a failed SDK call was rejected as unauthorized (401). */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof FetchError && error.status === 401;
}

/**
 * Heal a stale/expired JWT: clears the token and reports that it happened.
 * Returns true when the error was a 401 and the token was dropped.
 */
export function healIfUnauthorized(error: unknown): boolean {
  if (!isUnauthorizedError(error)) return false;
  clearAuthToken();
  return true;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type StoreCustomer = Awaited<
  ReturnType<typeof sdk.store.customer.retrieve>
>["customer"];

export type SignInInput = { email: string; password: string };

export type SignUpInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

// ── Error surfacing ─────────────────────────────────────────────────────────

/**
 * Return a readable message for a failed auth/customer call: the backend's
 * JSON error message when present, the HTTP status text, or a network fallback.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof FetchError) {
    return error.message || error.statusText || "Something went wrong.";
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

// ── TanStack Query key factory ──────────────────────────────────────────────

export const customerKeys = {
  all: ["medusa", "customer"] as const,
  me: ["medusa", "customer", "me"] as const,
} as const;

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch the logged-in customer via `sdk.store.customer.retrieve()`.
 * Disabled (never hits the network) until a JWT exists in storage. A 401 from
 * a stale/expired token heals the session: the token is dropped and the query
 * resolves null (signed out) instead of leaving the app half-signed-in.
 */
export function useCustomer() {
  return useQuery<StoreCustomer | null, Error>({
    queryKey: customerKeys.me,
    queryFn: async () => {
      try {
        const { customer } = await sdk.store.customer.retrieve();
        return customer;
      } catch (error) {
        if (healIfUnauthorized(error)) return null;
        throw error;
      }
    },
    enabled: hasAuthToken(),
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Sign in with email + password. On success the SDK stores the returned JWT
 * and auto-attaches it to subsequent requests (e.g. customer.retrieve).
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, SignInInput>({
    mutationFn: async ({ email, password }) => {
      const result = await sdk.auth.login("customer", "emailpass", {
        email,
        password,
      });
      // emailpass returns the JWT as a string; the union covers redirect/MFA
      // flows that this provider does not use.
      if (typeof result !== "string") {
        throw new Error("Sign-in requires an extra step that isn't supported yet.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

/**
 * Register a new customer: create the auth identity (email+password), then the
 * customer profile (names; the SDK's StoreCreateCustomer has no password
 * field). The registration token the SDK stored in `register` is auto-attached
 * to the `create` call, then a normal login stores the customer JWT so the
 * account page flips to the signed-in state.
 */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, SignUpInput>({
    mutationFn: async ({ email, password, firstName, lastName }) => {
      await sdk.auth.register("customer", "emailpass", { email, password });
      await sdk.store.customer.create({
        email,
        first_name: firstName,
        last_name: lastName,
      });
      const result = await sdk.auth.login("customer", "emailpass", {
        email,
        password,
      });
      if (typeof result !== "string") {
        throw new Error("Sign-up requires an extra step that isn't supported yet.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

/**
 * Log out: clears the stored JWT via the SDK and drops cached customer data.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await sdk.auth.logout();
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: customerKeys.all });
      // Wipe the persisted cart id and invalidate cart queries so the previous
      // customer's cart doesn't leak into the next session and the badge/UI
      // empties immediately. Guest carts still persist — the wipe only happens
      // on an explicit logout.
      clearCartId();
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}
