import { Link } from "@tanstack/react-router";
import { Heart, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { StarRating } from "@/components/StarRating";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { discountPct, formatPrice, type Product } from "@/lib/products";

export function ProductInfoPanel({
  product,
  qty,
  onQtyChange,
  isWishlisted,
  onAddToCart,
  onBuyNow,
  onToggleWishlist,
}: {
  product: Product;
  qty: number;
  onQtyChange: Dispatch<SetStateAction<number>>;
  isWishlisted: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onToggleWishlist: () => void;
}) {
  const off = discountPct(product);

  return (
    <div>
      <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">
        {product.tagline}
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl">{product.name}</h1>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <StarRating value={product.rating} />
        <span className="font-medium">{product.rating}</span>
        <a href="#reviews" className="text-muted-foreground underline underline-offset-4">
          {product.reviews.length} reviews
        </a>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-3">
        <span className="font-display text-3xl">{formatPrice(product.price)}</span>
        {product.mrp && (
          <>
            <span className="text-lg text-muted-foreground line-through">
              {formatPrice(product.mrp)}
            </span>
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
              Save {off}%
            </span>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Inclusive of all taxes · {product.size}
      </p>

      <p className="mt-5 text-[15px] leading-relaxed text-foreground/90">
        {product.shortDescription}
      </p>

      <p className="mt-5 text-sm">
        <span className="text-muted-foreground">Suitable for: </span>
        {product.suitableFor}
      </p>
      <p className="mt-1 text-sm">
        <span className="text-muted-foreground">Availability: </span>
        {product.stock === 0 ? (
          <span className="font-medium text-destructive">Out of stock</span>
        ) : product.stock < 15 ? (
          <span className="font-medium text-accent-foreground">
            Only {product.stock} left in stock
          </span>
        ) : (
          <span className="font-medium text-leaf">In stock — ships today</span>
        )}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-border">
          <button
            className="px-3 py-2 text-lg"
            aria-label="Decrease quantity"
            onClick={() => onQtyChange((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="w-8 text-center text-sm">{qty}</span>
          <button
            className="px-3 py-2 text-lg"
            aria-label="Increase quantity"
            onClick={() => onQtyChange((q) => q + 1)}
          >
            +
          </button>
        </div>
        <Button
          variant="outline"
          disabled={product.stock === 0}
          onClick={onAddToCart}
        >
          Add to Cart
        </Button>
        <Button disabled={product.stock === 0} onClick={onBuyNow}>
          Buy Now
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add to wishlist"
          onClick={onToggleWishlist}
        >
          <Heart className={isWishlisted ? "fill-accent text-accent" : ""} />
        </Button>
      </div>

      <div className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-5 text-sm sm:grid-cols-2">
        <p className="flex gap-2"><Truck size={17} className="shrink-0 text-leaf" /> Shipping calculated at checkout from your address</p>
        <p className="flex gap-2"><RotateCcw size={17} className="shrink-0 text-leaf" /> 14-day easy returns on unopened items</p>
        <p className="flex gap-2"><PackageCheck size={17} className="shrink-0 text-leaf" /> Same-day dispatch before 4 PM IST</p>
        <p className="flex gap-2"><ShieldCheck size={17} className="shrink-0 text-leaf" /> Refunds credited in 5–7 working days</p>
      </div>

      <Accordion type="multiple" defaultValue={["desc"]} className="mt-8">
        <AccordionItem value="desc">
          <AccordionTrigger>Detailed description</AccordionTrigger>
          <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">
            {product.description}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="benefits">
          <AccordionTrigger>Key benefits</AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              {product.benefits.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="ingredients">
          <AccordionTrigger>Ingredients &amp; contents</AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              {product.ingredients.map((b) => <li key={b}>{b}</li>)}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">Net quantity: {product.size}</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="how">
          <AccordionTrigger>How to use</AccordionTrigger>
          <AccordionContent>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              {product.howToUse.map((b) => <li key={b}>{b}</li>)}
            </ol>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="shipping">
          <AccordionTrigger>Shipping, returns &amp; refunds</AccordionTrigger>
          <AccordionContent className="space-y-2 text-muted-foreground">
            <p>
              Dispatched from Mumbai within 24 hours. Metro cities receive orders in
              2–3 working days, rest of India in 4–6.
            </p>
            <p>
              Unopened products can be returned within 14 days of delivery. Damaged or
              incorrect items are replaced free of cost. Read the full{" "}
              <Link to="/returns" className="underline underline-offset-4">
                Return &amp; Refund Policy
              </Link>.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
