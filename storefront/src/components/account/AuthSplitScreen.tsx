import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Droplets, FlaskConical, Leaf, Sparkles } from "lucide-react";

import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FEATURES = [
  { Icon: Leaf, label: "Clinically Researched Actives" },
  { Icon: Droplets, label: "Non-Sticky & Fast Absorbing" },
  { Icon: Sparkles, label: "For All Hair Types" },
  { Icon: FlaskConical, label: "Clean & Safe Formula" },
] as const;

const AVATARS = [
  { initials: "AR", from: "#8FA87F", to: "#4A6350" },
  { initials: "PK", from: "#C5A464", to: "#6B5730" },
  { initials: "SM", from: "#7E9B88", to: "#31403A" },
] as const;

export function AuthSplitScreen({
  onSignIn,
  onSignUp,
  loginPending,
  registerPending,
}: {
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  onSignUp: (event: FormEvent<HTMLFormElement>) => void;
  loginPending: boolean;
  registerPending: boolean;
}) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  return (
    <section className="bg-background">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl lg:grid-cols-2">
        {/* Form column */}
        <div className="flex items-center justify-center px-4 py-14 sm:px-8 lg:py-20">
          <div className="w-full max-w-md">
            <p className="text-[11px] uppercase tracking-[0.25em] text-gold">Member Access</p>
            <h1 className="mt-3 font-display text-3xl leading-[1.08] tracking-[-0.02em] text-charcoal md:text-4xl">
              {tab === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-forest/70">
              {tab === "signin"
                ? "Sign in to track orders, save your wishlist and reorder faster."
                : "Join Daily Drip to save your wishlist, track orders and reorder your routine in two taps."}
            </p>

            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as "signin" | "signup")}
              className="mt-8 w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6">
                <form className="space-y-4" onSubmit={onSignIn}>
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" name="email" type="email" required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-pass">Password</Label>
                    <Input id="si-pass" name="password" type="password" required placeholder="••••••••" />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={loginPending}>
                    {loginPending ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form className="space-y-4" onSubmit={onSignUp}>
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
                  <Button type="submit" size="lg" className="w-full" disabled={registerPending}>
                    {registerPending ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              By continuing you agree to our{" "}
              <Link to="/privacy" className="text-forest/80 underline underline-offset-2 hover:text-primary">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="text-forest/80 underline underline-offset-2 hover:text-primary">
                Terms
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Visual panel */}
        <div className="relative order-first overflow-hidden bg-forest lg:order-last">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 50% at 78% 42%, rgba(183,201,166,0.14), transparent 70%), radial-gradient(45% 40% at 12% 85%, rgba(197,164,100,0.1), transparent 70%)",
            }}
          />
          <div className="relative flex min-h-full flex-col justify-center px-4 py-12 sm:px-8 lg:px-14 lg:py-20">
            <div className="text-center lg:text-left">
              <p className="font-display text-xl tracking-[0.2em] text-cream">DAILY DRIP</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-sage">Science. Nature. Daily.</p>
            </div>

            <div className="relative mx-auto mt-10 w-full max-w-md lg:max-w-sm">
              <div
                aria-hidden
                className="absolute -inset-8 rounded-full blur-3xl"
                style={{
                  background:
                    "radial-gradient(50% 50% at 50% 50%, rgba(183,201,166,0.22), transparent 70%)",
                }}
              />
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative rounded-[2.4rem] border border-gold/20 bg-white/5 p-2.5"
              >
                <div className="relative overflow-hidden rounded-[2rem]">
                  <img
                    src={hero}
                    alt="Advanced Hair Density Serum — amber glass bottle resting on fresh green botanicals"
                    width={1600}
                    height={1200}
                    className="h-auto w-full object-cover"
                  />
                  <div className="absolute right-4 top-4 flex h-20 w-20 flex-col items-center justify-center rounded-full border border-gold/40 bg-forest/50 px-2 text-center backdrop-blur-sm">
                    <span className="text-[8px] uppercase leading-relaxed tracking-[0.16em] text-gold">
                      Clean
                    </span>
                    <span className="text-[8px] uppercase leading-relaxed tracking-[0.16em] text-gold">
                      Beauty
                    </span>
                    <span className="mt-1 text-[8px] uppercase leading-relaxed tracking-[0.16em] text-cream/85">
                      Made in India
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 rounded-xl border border-white/10 bg-forest/70 px-4 py-3 backdrop-blur-md">
                    <span className="block text-[9px] uppercase tracking-[0.3em] text-sage">
                      Daily Drip
                    </span>
                    <span className="mt-1 block font-display text-sm text-cream">
                      Advanced Hair Density Serum
                    </span>
                    <span className="mt-0.5 block text-[10px] text-cream/60">30 ml</span>
                  </div>
                </div>
              </motion.div>
            </div>

            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5">
              {FEATURES.map(({ Icon, label }) => (
                <li key={label} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-sage" strokeWidth={1.5} />
                  <span className="text-[11px] leading-[1.45] text-cream/80">{label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center justify-center gap-3.5 lg:justify-start">
              <div className="flex -space-x-2.5">
                {AVATARS.map(({ initials, from, to }) => (
                  <span
                    key={initials}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-forest text-[10px] font-semibold text-forest"
                    style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <p className="text-sm text-cream/70">Trusted by 5000+ early believers</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
