import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/products";

export function RelatedProductsSection({
  related,
  isPending,
}: {
  related: Product[];
  isPending: boolean;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <h2 className="text-2xl">You may also like</h2>
      <div className="mt-8">
        {related.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isPending ? "Loading related products…" : "More products arriving soon."}
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
