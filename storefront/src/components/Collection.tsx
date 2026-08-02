import { ProductCard } from "@/components/ProductCard";
import { useMappedProducts } from "@/lib/medusa-hooks";
import type { Product } from "@/lib/products";

// Only the app's own catalog categories are rendered. The unfiltered Medusa
// list can include demo products (default sales channel); category-filtered
// calls already exclude them, this guard keeps the /shop page sane too.
const APP_CATEGORIES: Product["category"][] = ["skin-care", "hair-care"];

export function Collection({
  title,
  intro,
  filter,
}: {
  title: string;
  intro: string;
  filter?: Product["category"];
}) {
  const { data, isPending, isError } = useMappedProducts(filter);
  const list = (data ?? []).filter((p) => APP_CATEGORIES.includes(p.category));

  return (
    <>
      <section className="border-b border-border bg-secondary/60">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl">{title}</h1>
          <p className="mt-4 text-muted-foreground">{intro}</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-14">
        <p className="mb-6 text-sm text-muted-foreground">
          {isPending ? "Loading products…" : isError ? "Unable to load products" : `${list.length} products`}
        </p>
        {isError && (
          <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            We couldn't load products right now. Please refresh the page or try again shortly.
          </p>
        )}
        {!isPending && !isError && list.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No products in this category yet — check back soon.
          </p>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </div>
    </>
  );
}
