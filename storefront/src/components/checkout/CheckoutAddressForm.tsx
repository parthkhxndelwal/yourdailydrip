// Checkout address step: email + India shipping address form.
//
// Owns its local field state and validates client-side BEFORE any SDK call
// (the Medusa `cart.update` mutation only fires for a fully valid form).
// Field-level errors render inline under each input. Signed-in users get a
// saved-address picker (from their address book) and an opt-in "save to my
// account" checkbox; guests get the plain single-address form unchanged.

import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toAddressForm, type StoreCustomerAddress } from "@/lib/medusa-addresses";
import {
  validateAddress,
  validateEmail,
  type ShippingAddressForm,
} from "@/lib/medusa-checkout";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function CheckoutAddressForm({
  defaultEmail,
  defaultAddress,
  pending,
  savedAddresses,
  signedIn,
  shippingError,
  onSaveAddress,
  onSubmit,
}: {
  defaultEmail?: string;
  defaultAddress?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    address_1?: string | null;
    address_2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
  } | null;
  pending: boolean;
  savedAddresses?: StoreCustomerAddress[];
  signedIn: boolean;
  shippingError?: string | null;
  onSaveAddress?: (address: ShippingAddressForm) => void;
  onSubmit: (email: string, address: ShippingAddressForm) => void;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [address, setAddress] = useState<ShippingAddressForm>({
    first_name: defaultAddress?.first_name ?? "",
    last_name: defaultAddress?.last_name ?? "",
    phone: defaultAddress?.phone ?? "",
    address_1: defaultAddress?.address_1 ?? "",
    address_2: defaultAddress?.address_2 ?? "",
    city: defaultAddress?.city ?? "",
    province: defaultAddress?.province ?? "",
    postal_code: defaultAddress?.postal_code ?? "",
  });
  const [saveChecked, setSaveChecked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Adopt the signed-in customer's email once it arrives (the customer query
  // resolves after CheckoutFlow mounts) — only while the field is untouched so
  // it never clobbers what the user has typed.
  useEffect(() => {
    if (defaultEmail && !email) setEmail(defaultEmail);
  }, [defaultEmail]);

  const setField = (field: keyof ShippingAddressForm, value: string) =>
    setAddress((prev) => ({ ...prev, [field]: value }));

  const clearAddress = () =>
    setAddress({
      first_name: "",
      last_name: "",
      phone: "",
      address_1: "",
      address_2: "",
      city: "",
      province: "",
      postal_code: "",
    });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const emailError = validateEmail(email);
    const addressErrors = validateAddress(address);
    if (emailError || Object.keys(addressErrors).length > 0) {
      setErrors({ ...(emailError ? { email: emailError } : {}), ...addressErrors });
      return;
    }
    setErrors({});
    // Fire-and-forget: save to the account first, but the order submit
    // continues regardless — the parent toasts on a save failure.
    if (saveChecked && onSaveAddress) onSaveAddress(address);
    onSubmit(email.trim(), address);
  };

  const input = (field: keyof ShippingAddressForm, props: Record<string, string>) => ({
    id: field,
    value: address[field],
    "aria-invalid": errors[field] ? true : undefined,
    onChange: (e: { target: { value: string } }) => setField(field, e.target.value),
    disabled: pending,
    ...props,
  });

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-lg">Contact</h2>
      <div className="mt-4 space-y-4">
        <Field id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            aria-invalid={errors.email ? true : undefined}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </Field>
      </div>

      {signedIn && savedAddresses && savedAddresses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg">Saved addresses</h2>
          <div className="mt-4 space-y-3">
            {savedAddresses.map((addr) => (
              <button
                key={addr.id}
                type="button"
                disabled={pending}
                onClick={() => {
                  setAddress(toAddressForm(addr));
                  setSaveChecked(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-sm">
                  {[addr.first_name, addr.last_name].filter(Boolean).join(" ")} · {addr.address_1} ·{" "}
                  {[addr.city, addr.postal_code].filter(Boolean).join(" ")}
                </span>
                <span className="text-sm font-medium text-primary">Use this address</span>
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                clearAddress();
                setSaveChecked(false);
              }}
              className="w-full rounded-lg border border-dashed border-border p-4 text-left text-sm text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enter a new address
            </button>
          </div>
        </div>
      )}

      <h2 className="mt-8 text-lg">Shipping address</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id="first_name" label="First name" error={errors.first_name}>
          <Input {...input("first_name", { autoComplete: "given-name", placeholder: "Ananya" })} />
        </Field>
        <Field id="last_name" label="Last name" error={errors.last_name}>
          <Input {...input("last_name", { autoComplete: "family-name", placeholder: "Rao" })} />
        </Field>
        <Field id="phone" label="Phone" error={errors.phone}>
          <Input
            {...input("phone", {
              type: "tel",
              autoComplete: "tel",
              inputMode: "numeric",
              placeholder: "10-digit mobile number",
            })}
          />
        </Field>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" value="India" disabled className="bg-muted text-muted-foreground" />
        </div>
        <div className="sm:col-span-2">
          <Field id="address_1" label="Street address" error={errors.address_1}>
            <Input
              {...input("address_1", {
                autoComplete: "address-line1",
                placeholder: "House no, building, street",
              })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="address_2" label="Area / landmark (optional)" error={errors.address_2}>
            <Input
              {...input("address_2", {
                autoComplete: "address-line2",
                placeholder: "Locality, landmark",
              })}
            />
          </Field>
        </div>
        <Field id="city" label="City" error={errors.city}>
          <Input {...input("city", { autoComplete: "address-level2", placeholder: "Bengaluru" })} />
        </Field>
        <Field id="province" label="State" error={errors.province}>
          <Input {...input("province", { autoComplete: "address-level1", placeholder: "Karnataka" })} />
        </Field>
        <Field id="postal_code" label="Pincode" error={errors.postal_code}>
          <Input
            {...input("postal_code", {
              inputMode: "numeric",
              autoComplete: "postal-code",
              placeholder: "6-digit pincode",
            })}
          />
        </Field>
      </div>

      {signedIn && (
        <div className="mt-8">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={saveChecked}
              onCheckedChange={(value) => setSaveChecked(value === true)}
              disabled={pending}
            />
            Save this address to my account
          </label>
        </div>
      )}

      {shippingError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {shippingError}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Link to="/shop" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Back to shop
        </Link>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Continue to payment
        </Button>
      </div>
    </form>
  );
}
