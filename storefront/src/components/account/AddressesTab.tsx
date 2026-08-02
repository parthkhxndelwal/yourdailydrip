// Signed-in address book tab for the account page.
//
// Lists the customer's saved addresses with inline add / edit / delete. Uses
// the customer-scoped address hooks from lib/medusa-addresses and reuses the
// checkout's ShippingAddressForm fields + validateAddress so the validation
// rules and the India-only country field match the checkout exactly.

import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  toAddressForm,
  toCreateAddressBody,
  useCreateAddress,
  useCustomerAddresses,
  useDeleteAddress,
  useUpdateAddress,
  type StoreCustomerAddress,
} from "@/lib/medusa-addresses";
import { authErrorMessage } from "@/lib/medusa-auth";
import {
  validateAddress,
  type ShippingAddressForm,
} from "@/lib/medusa-checkout";

const EMPTY_FORM: ShippingAddressForm = {
  first_name: "",
  last_name: "",
  phone: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "",
  postal_code: "",
};

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

export function AddressesTab({ email }: { email: string }) {
  const addressesQuery = useCustomerAddresses();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();

  // null = list view; "new" = blank add form; an address = edit form.
  const [editing, setEditing] = useState<StoreCustomerAddress | "new" | null>(null);
  const [form, setForm] = useState<ShippingAddressForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingAddressForm, string>>>({});
  // Two-step delete: the first click arms the confirm state, the second deletes.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const addresses = addressesQuery.data;
  const loading = addressesQuery.isPending && addressesQuery.fetchStatus !== "idle";
  const busy = createAddress.isPending || updateAddress.isPending || deleteAddress.isPending;

  const setField = (field: keyof ShippingAddressForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const input = (field: keyof ShippingAddressForm, props: Record<string, string>) => ({
    id: `addr-${field}`,
    value: form[field],
    "aria-invalid": errors[field] ? true : undefined,
    onChange: (e: { target: { value: string } }) => setField(field, e.target.value),
    disabled: busy,
    ...props,
  });

  const startEdit = (address: StoreCustomerAddress) => {
    setEditing(address);
    setForm(toAddressForm(address));
    setErrors({});
    setConfirmId(null);
  };

  const startAdd = () => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setErrors({});
    setConfirmId(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setErrors({});
    setConfirmId(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateAddress(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    const body = toCreateAddressBody(form, email);
    if (editing && editing !== "new") {
      updateAddress.mutate(
        { addressId: editing.id, body },
        {
          onSuccess: () => {
            toast.success("Address updated");
            setEditing(null);
          },
          onError: (error) => toast.error(authErrorMessage(error)),
        },
      );
    } else {
      createAddress.mutate(body, {
        onSuccess: () => {
          toast.success("Address saved");
          setEditing(null);
        },
        onError: (error) => toast.error(authErrorMessage(error)),
      });
    }
  };

  const handleDelete = (addressId: string) => {
    if (confirmId !== addressId) {
      setConfirmId(addressId);
      return;
    }
    setConfirmId(null);
    deleteAddress.mutate(addressId, {
      onSuccess: () => toast.success("Address removed"),
      onError: (error) => toast.error(authErrorMessage(error)),
    });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading your addresses…</p>;
  }

  if (addressesQuery.isError) {
    return (
      <div>
        <p className="font-medium">We couldn't load your addresses</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong on our side. Please try again in a few minutes.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Saved addresses</h2>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startAdd} disabled={busy}>
            <Plus className="size-4" />
            Add address
          </Button>
        )}
      </div>

      {editing ? (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-4 rounded-lg border border-border p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="addr-first_name" label="First name" error={errors.first_name}>
              <Input {...input("first_name", { autoComplete: "given-name", placeholder: "Ananya" })} />
            </Field>
            <Field id="addr-last_name" label="Last name" error={errors.last_name}>
              <Input {...input("last_name", { autoComplete: "family-name", placeholder: "Rao" })} />
            </Field>
            <Field id="addr-phone" label="Phone" error={errors.phone}>
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
              <Label htmlFor="addr-country">Country</Label>
              <Input id="addr-country" value="India" disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="sm:col-span-2">
              <Field id="addr-address_1" label="Street address" error={errors.address_1}>
                <Input
                  {...input("address_1", {
                    autoComplete: "address-line1",
                    placeholder: "House no, building, street",
                  })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="addr-address_2" label="Area / landmark (optional)" error={errors.address_2}>
                <Input
                  {...input("address_2", {
                    autoComplete: "address-line2",
                    placeholder: "Locality, landmark",
                  })}
                />
              </Field>
            </div>
            <Field id="addr-city" label="City" error={errors.city}>
              <Input {...input("city", { autoComplete: "address-level2", placeholder: "Bengaluru" })} />
            </Field>
            <Field id="addr-province" label="State" error={errors.province}>
              <Input {...input("province", { autoComplete: "address-level1", placeholder: "Karnataka" })} />
            </Field>
            <Field id="addr-postal_code" label="Pincode" error={errors.postal_code}>
              <Input
                {...input("postal_code", {
                  inputMode: "numeric",
                  autoComplete: "postal-code",
                  placeholder: "6-digit pincode",
                })}
              />
            </Field>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editing === "new" ? "Save address" : "Update address"}
            </Button>
          </div>
        </form>
      ) : !addresses || addresses.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No saved addresses yet — add one and it'll be one tap away at checkout.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {addresses.map((address) => {
            const name = [address.first_name, address.last_name].filter(Boolean).join(" ");
            const lines = [
              name,
              address.address_1,
              address.address_2,
              [address.city, address.province].filter(Boolean).join(", "),
              address.postal_code,
            ].filter(Boolean);
            const armed = confirmId === address.id;
            return (
              <li
                key={address.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="text-sm">
                  {lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  {address.phone && <p className="mt-1 text-muted-foreground">{address.phone}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(address)}
                    disabled={busy}
                    aria-label={`Edit address for ${name || "this address"}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant={armed ? "destructive" : "ghost"}
                    size="sm"
                    onClick={() => handleDelete(address.id)}
                    disabled={busy}
                    aria-label={armed ? "Confirm delete address" : `Delete address for ${name || "this address"}`}
                  >
                    <Trash2 className="size-4" />
                    {armed && <span className="ml-1">Confirm</span>}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
