// Customer address book data layer for the storefront, on top of the shared
// Medusa SDK.
//
// Reads/mutates the signed-in customer's saved addresses via
// `sdk.store.customer.listAddress` / `createAddress` / `deleteAddress`, and
// maps between the SDK address shape and the checkout's ShippingAddressForm.
// Every hook is disabled until a customer JWT exists (`hasAuthToken`), matching
// the customer data layer in lib/medusa-auth.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { customerKeys, hasAuthToken } from "./medusa-auth";
import { sdk } from "./medusa";
import type { ShippingAddressForm } from "./medusa-checkout";

// ── TanStack Query key factory ──────────────────────────────────────────────

export const customerAddressKeys = {
  all: ["medusa", "customer", "addresses"] as const,
} as const;

// ── SDK-derived types ───────────────────────────────────────────────────────

export type StoreCustomerAddress = Awaited<
  ReturnType<typeof sdk.store.customer.listAddress>
>["addresses"][number];

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch the signed-in customer's saved addresses. Disabled (never hits the
 * network) until a JWT exists in storage.
 */
export function useCustomerAddresses() {
  return useQuery<StoreCustomerAddress[], Error>({
    queryKey: customerAddressKeys.all,
    queryFn: async () => {
      const { addresses } = await sdk.store.customer.listAddress();
      return addresses;
    },
    enabled: hasAuthToken(),
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Save a new address to the signed-in customer's profile.
 */
export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    Parameters<typeof sdk.store.customer.createAddress>[0]
  >({
    mutationFn: async (body) => {
      await sdk.store.customer.createAddress(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerAddressKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.me });
    },
  });
}

/**
 * Update an existing saved address on the signed-in customer's profile.
 */
export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { addressId: string; body: Parameters<typeof sdk.store.customer.updateAddress>[1] }
  >({
    mutationFn: async ({ addressId, body }) => {
      await sdk.store.customer.updateAddress(addressId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerAddressKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.me });
    },
  });
}

/**
 * Delete a saved address from the signed-in customer's profile.
 */
export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (addressId) => {
      await sdk.store.customer.deleteAddress(addressId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerAddressKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.me });
    },
  });
}

// ── Mappers ─────────────────────────────────────────────────────────────────

/**
 * Map a saved customer address to the checkout's ShippingAddressForm. The form
 * is India-only (its country field is a fixed disabled input), so the saved
 * address's country is ignored in the mapping.
 */
export function toAddressForm(a: StoreCustomerAddress): ShippingAddressForm {
  return {
    first_name: a.first_name ?? "",
    last_name: a.last_name ?? "",
    phone: a.phone ?? "",
    address_1: a.address_1 ?? "",
    address_2: a.address_2 ?? "",
    city: a.city ?? "",
    province: a.province ?? "",
    postal_code: a.postal_code ?? "",
  };
}

/**
 * Map the checkout's ShippingAddressForm to a `createAddress` SDK body (India).
 * The address name falls back to the customer email when no name is present.
 */
export function toCreateAddressBody(
  f: ShippingAddressForm,
  email: string,
): Parameters<typeof sdk.store.customer.createAddress>[0] {
  return {
    first_name: f.first_name.trim(),
    last_name: f.last_name.trim(),
    phone: f.phone.trim(),
    address_1: f.address_1.trim(),
    address_2: f.address_2.trim() || undefined,
    city: f.city.trim(),
    province: f.province.trim(),
    postal_code: f.postal_code.trim(),
    country_code: "in",
    address_name: `${f.first_name} ${f.last_name}`.trim() || email,
  };
}
