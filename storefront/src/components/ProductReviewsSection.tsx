import { StarRating } from "@/components/StarRating";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/lib/products";

export function ProductReviewsSection({ product }: { product: Product }) {
  return (
    <section id="reviews" className="mx-auto max-w-6xl px-4 py-12">
      <Separator className="mb-12" />
      <h2 className="text-2xl">Ratings &amp; customer reviews</h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="font-display text-4xl">{product.rating}</span>
        <div>
          <StarRating value={product.rating} size={16} />
          <p className="text-sm text-muted-foreground">
            Based on {product.reviews.length} verified purchases
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {product.reviews.map((r) => (
          <article key={r.name + r.title} className="rounded-xl border border-border bg-card p-5">
            <StarRating value={r.rating} />
            <h3 className="mt-2 text-base font-semibold">{r.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {r.name} · Verified buyer · {r.date}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
