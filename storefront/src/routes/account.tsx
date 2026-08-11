import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "@/components/PageShell";
import { AddressesTab } from "@/components/account/AddressesTab";
import { AuthSplitScreen } from "@/components/account/AuthSplitScreen";
import { OrdersTab } from "@/components/account/OrdersTab";
import {
  authErrorMessage,
  useCustomer,
  useLogin,
  useLogout,
  useRegister,
  type StoreCustomer,
} from "@/lib/medusa-auth";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account & Sign Up — Daily Drip" },
      { name: "description", content: "Sign in or create a Daily Drip account to track orders, save your wishlist and reorder faster." },
      { property: "og:title", content: "Account & Sign Up — Daily Drip" },
      { property: "og:description", content: "Sign in or create your Daily Drip account." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const customerQuery = useCustomer();
  const login = useLogin();
  const register = useRegister();
  const logout = useLogout();
  const { clearWishlist } = useShop();

  // Hydration-safe data gate (mirrors checkout.tsx): first client render must
  // match SSR (no JWT on server), so only show the pending state once mounted;
  // a disabled query (no JWT on server) falls through to the sign-in tabs.
  const loading = mounted && customerQuery.isPending && customerQuery.fetchStatus !== "idle";
  const customer = customerQuery.data;

  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return;

    login.mutate(
      { email, password },
      {
        onSuccess: () => toast.success("Signed in — welcome back!"),
        onError: (error) => toast.error(authErrorMessage(error)),
      },
    );
  };

  const handleSignUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!fullName || !email || !password) return;

    const [firstName, ...rest] = fullName.split(/\s+/);
    register.mutate(
      { email, password, firstName: firstName ?? "", lastName: rest.join(" ") },
      {
        onSuccess: () => toast.success("Account created — you're signed in!"),
        onError: (error) => toast.error(authErrorMessage(error)),
      },
    );
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        clearWishlist();
        toast.success("Signed out");
      },
      onError: (error) => toast.error(authErrorMessage(error)),
    });
  };

  const shell = (children: ReactNode) => (
    <PageShell
      eyebrow="Account"
      title="Sign in or create an account"
      intro="Save your wishlist, track orders and reorder your routine in two taps."
    >
      {children}
    </PageShell>
  );

  return (
    <>
      {loading ? (
        shell(
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-muted-foreground">Loading your account…</p>
          </div>,
        )
      ) : customer ? (
        shell(<SignedInPanel customer={customer} onLogout={handleLogout} pending={logout.isPending} />)
      ) : (
        <AuthSplitScreen
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          loginPending={login.isPending}
          registerPending={register.isPending}
        />
      )}
    </>
  );
}

function SignedInPanel({
  customer,
  onLogout,
  pending,
}: {
  customer: StoreCustomer;
  onLogout: () => void;
  pending: boolean;
}) {
  const displayName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <h2 className="text-xl">{displayName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{customer.email}</p>
          <p className="mt-4 text-muted-foreground">
            Your wishlist is cleared from this device when you sign out.
          </p>
          <Button variant="outline" className="mt-5" onClick={onLogout} disabled={pending}>
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </TabsContent>
        <TabsContent value="orders" className="mt-6">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="addresses" className="mt-6">
          <AddressesTab email={customer.email} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
