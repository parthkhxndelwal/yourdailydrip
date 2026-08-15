import { Link } from "@tanstack/react-router";
import { Heart, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { StarRating } from "./StarRating";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { discountPct, formatPrice, type Product } from "@/lib/products";
import { useShop } from "@/lib/store";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, inWishlist } = useShop();
  const off = discountPct(product);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-[var(--shadow-soft)]">
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="relative block overflow-hidden bg-sand"
      >
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          width={900}
          height={900}
          className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {off > 0 && (
          <span className="absolute top-3 left-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
            {off}% OFF
          </span>
        )}
        {product.stock === 0 && (
          <span className="absolute top-3 right-3 rounded-full bg-deep px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
            Out of stock
          </span>
        )}
      </Link>

      <button
        type="button"
        aria-label="Add to wishlist"
        onClick={() => {
          const saving = !inWishlist(product.slug)
          toggleWishlist(product.slug)
          toast(saving ? "Saved to wishlist" : "Removed from wishlist")
        }}
        className="absolute right-3 bottom-[8.5rem] grid size-9 place-items-center rounded-full bg-card/90 backdrop-blur transition-colors hover:bg-card"
      >
        <Heart
          size={16}
          className={cn(inWishlist(product.slug) ? "fill-accent text-accent" : "text-foreground")}
        />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] tracking-widest text-muted-foreground uppercase">
          {product.category === "skin-care" ? "Skin Care" : "Hair Care"} · {product.size}
        </p>
        <h3 className="font-display text-lg leading-tight">
          <Link to="/product/$slug" params={{ slug: product.slug }}>
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StarRating value={product.rating} />
          {product.rating} ({product.reviews.length})
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-lg">{formatPrice(product.price)}</span>
            {product.mrp && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.mrp)}
              </span>
            )}
          </p>
          <Button
            size="sm"
            disabled={product.stock === 0}
            onClick={() => {
              addToCart(product);
            }}
          >
            <ShoppingBag size={15} /> Add
          </Button>
        </div>
      </div>
    </article>
  );
}