// Checkout auth gate modal: sign in / sign up before a guest can check out.
//
// Rendered only by the cart and checkout routes and only when open (never
// during SSR), so it is free to use window/localStorage-backed auth hooks. On
// successful auth it links the guest Medusa cart to the customer — best-effort:
// a transferCart failure logs a warning and continues, it must never block
// checkout. The wishlist metadata merge is NOT reimplemented here;
// ShopProvider's effects already adopt the device wishlist into
// customer.metadata once the customer query resolves after login.

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sdk } from "@/lib/medusa";
import { authErrorMessage, useLogin, useRegister } from "@/lib/medusa-auth";
import { cartKeys, readCartId } from "@/lib/medusa-cart";

export function CheckoutAuthModal({
  open,
  onOpenChange,
  onAuthenticated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}) {
  const queryClient = useQueryClient();
  const login = useLogin();
  const register = useRegister();

  // Link the guest cart to the just-signed-in customer, then continue.
  // transferCart failing must not block the user — log a warning and keep going.
  const linkAndContinue = async () => {
    try {
      const cartId = readCartId();
      if (cartId) {
        try {
          await sdk.store.cart.transferCart(cartId);
        } catch (error) {
          console.warn("Couldn't link the guest cart to your account.", error);
          toast.error("Couldn't link your cart to your account — you can continue anyway.");
        }
        queryClient.invalidateQueries({ queryKey: cartKeys.all });
      }
    } finally {
      onAuthenticated();
    }
  };

  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return;

    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          void linkAndContinue();
        },
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
        onSuccess: () => {
          void linkAndContinue();
        },
        onError: (error) => toast.error(authErrorMessage(error)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to check out</DialogTitle>
          <DialogDescription>
            Sign in or create an account to continue your order. Your cart and wishlist will be saved to your account.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="signin" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="mt-6">
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <Label htmlFor="si-email">Email</Label>
                <Input id="si-email" name="email" type="email" required placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-pass">Password</Label>
                <Input id="si-pass" name="password" type="password" required placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup" className="mt-6">
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div className="space-y-2">
                <Label htmlFor="su-name">Full name</Label>
                <Input id="su-name" name="name" required placeholder="Ananya Rao" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" name="email" type="email" required placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-pass">Create password</Label>
                <Input id="su-pass" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
              </div>
              <Button type="submit" className="w-full" disabled={register.isPending}>
                {register.isPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
