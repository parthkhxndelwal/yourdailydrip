import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useMappedProducts } from "@/lib/medusa-hooks";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Your Wishlist — Daily Drip" },
      { name: "description", content: "Products you've saved for later at Daily Drip." },
      { property: "og:title", content: "Your Wishlist — Daily Drip" },
      { property: "og:description", content: "Products you've saved for later at Daily Drip." },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist } = useShop();
  const { data, isPending, isError } = useMappedProducts();
  const items = (data ?? []).filter((p) => wishlist.includes(p.slug));

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="text-4xl">Your wishlist</h1>
      {wishlist.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">Nothing saved yet — tap the heart on any product.</p>
          <Button className="mt-5" asChild>
            <Link to="/shop">Browse products</Link>
          </Button>
        </div>
      ) : isPending ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">
            We couldn't load your wishlist right now. Please try again shortly.
          </p>
          <Button className="mt-5" asChild>
            <Link to="/shop">Browse products</Link>
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">Nothing saved yet — tap the heart on any product.</p>
          <Button className="mt-5" asChild>
            <Link to="/shop">Browse products</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}