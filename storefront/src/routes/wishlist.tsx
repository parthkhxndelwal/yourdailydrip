import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { getProduct } from "@/lib/products";
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
  const items = wishlist.map((s) => getProduct(s)).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="text-4xl">Your wishlist</h1>
      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">Nothing saved yet — tap the heart on any product.</p>
          <Button className="mt-5" asChild>
            <Link to="/shop">Browse products</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p!.slug} product={p!} />
          ))}
        </div>
      )}
    </div>
  );
}