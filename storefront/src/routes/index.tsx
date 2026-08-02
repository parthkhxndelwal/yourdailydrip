import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplets, Leaf, ShieldCheck, Truck } from "lucide-react";

import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { Testimonials } from "@/components/Testimonials";
import { useMappedProducts } from "@/lib/medusa-hooks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Daily Drip — Clean Skin & Hair Care, Made in India" },
      {
        name: "description",
        content:
          "Dermatologist-tested serums, cleansers, hair oils and masks with honest ingredient lists. Shipping rates calculated at checkout.",
      },
      { property: "og:title", content: "Daily Drip — Clean Skin & Hair Care, Made in India" },
      {
        property: "og:description",
        content: "Dermatologist-tested serums, cleansers, hair oils and masks with honest ingredient lists. Shipping rates calculated at checkout.",
      },
    ],
  }),
  component: Index,
});

const promises = [
  { Icon: Leaf, title: "Clean formulas", body: "No sulphates, parabens or hidden fragrance." },
  { Icon: ShieldCheck, title: "Derm tested", body: "Every batch tested and safety assessed." },
  { Icon: Droplets, title: "Full disclosure", body: "Actives listed with exact percentages." },
  { Icon: Truck, title: "Fast delivery", body: "Same-day dispatch before 4 PM, pan-India." },
];

function Index() {
  // Category-filtered hooks exclude Medusa demo products; each returns only the
  // seeded Daily Drip products for that category.
  const skinQuery = useMappedProducts("skin-care");
  const hairQuery = useMappedProducts("hair-care");
  const skin = (skinQuery.data ?? []).slice(0, 3);
  const hair = (hairQuery.data ?? []).slice(0, 3);
  const loading = skinQuery.isPending || hairQuery.isPending;
  const error = skinQuery.isError || hairQuery.isError;

  return (
    <>
      <section className="border-b border-border bg-sand">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">
              Skin &amp; hair care · Made in India
            </p>
            <h1 className="mt-4 text-4xl leading-[1.05] md:text-6xl">
              A routine that
              <br />
              actually holds up.
            </h1>
            <p className="mt-5 max-w-md text-muted-foreground">
              Daily Drip makes dermatologist-tested skin and hair care with short,
              honest ingredient lists — and tells you exactly how much of each active
              is inside.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/shop">Shop the range</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/how-to-use">Build my routine</Link>
              </Button>
            </div>
          </div>
          <img
            src={hero}
            alt="Amber serum bottle resting on fresh green botanical leaves"
            width={1600}
            height={1200}
            className="rounded-2xl object-cover shadow-[var(--shadow-soft)]"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map(({ Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 shrink-0 text-leaf" size={20} />
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl md:text-4xl">Skin Care</h2>
          <Link to="/skin-care" className="text-sm underline underline-offset-4">
            View all
          </Link>
        </div>
        <div className="mt-8">
          {skin.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {error ? "We couldn't load products right now. Please refresh." : loading ? "Loading products…" : "New skin care arriving soon."}
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {skin.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl md:text-4xl">Hair Care</h2>
          <Link to="/hair-care" className="text-sm underline underline-offset-4">
            View all
          </Link>
        </div>
        <div className="mt-8">
          {hair.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {error ? "We couldn't load products right now. Please refresh." : loading ? "Loading products…" : "New hair care arriving soon."}
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {hair.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Testimonials />

      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-3xl">Not sure where to start?</h2>
        <p className="mt-3 text-muted-foreground">
          Tell our chatbot assistant your skin or hair type and we'll suggest a
          three-step routine in under a minute — no sign-up needed.
        </p>
        <Button className="mt-6" size="lg" asChild>
          <Link to="/how-to-use">See routine guides</Link>
        </Button>
      </section>
    </>
  );
}
