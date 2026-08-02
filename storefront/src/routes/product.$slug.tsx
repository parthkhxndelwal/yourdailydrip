import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { ProductImageGallery } from "@/components/ProductImageGallery";
import { ProductInfoPanel } from "@/components/ProductInfoPanel";
import { ProductPageSkeleton } from "@/components/ProductPageSkeleton";
import { ProductReviewsSection } from "@/components/ProductReviewsSection";
import { ProductUnavailable } from "@/components/ProductUnavailable";
import { RelatedProductsSection } from "@/components/RelatedProductsSection";
import { useMappedProduct, useMappedProducts } from "@/lib/medusa-hooks";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/product/$slug")({
  head: () => ({
    meta: [
      { title: "Product unavailable — Daily Drip" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { addToCart, toggleWishlist, inWishlist } = useShop();
  const productQuery = useMappedProduct(slug);
  const relatedQuery = useMappedProducts(productQuery.data?.category);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);

  const product = productQuery.data;
  const related = (relatedQuery.data ?? []).filter((p) => p.slug !== slug);

  // Clamp the active image index when the image list changes (e.g. after the
  // query resolves) so product.images[active] is never undefined.
  useEffect(() => {
    if (product && product.images.length > 0 && active >= product.images.length) {
      setActive(product.images.length - 1);
    }
  }, [product, active]);

  if (productQuery.isPending) {
    return <ProductPageSkeleton />;
  }
  if (productQuery.isError || !product) {
    return <ProductUnavailable />;
  }

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link>
        {" / "}
        <Link
          to={product.category === "skin-care" ? "/skin-care" : "/hair-care"}
          className="hover:text-primary"
        >
          {product.category === "skin-care" ? "Skin Care" : "Hair Care"}
        </Link>
        {" / "}
        <span className="text-foreground">{product.name}</span>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 lg:grid-cols-2">
        <ProductImageGallery
          name={product.name}
          images={product.images}
          active={active}
          onSelect={setActive}
        />
        <ProductInfoPanel
          product={product}
          qty={qty}
          onQtyChange={setQty}
          isWishlisted={inWishlist(product.slug)}
          onAddToCart={() => {
            addToCart(product, qty);
          }}
          onBuyNow={() => addToCart(product, qty, { showSuccessToast: false })}
          onToggleWishlist={() => {
            toggleWishlist(product.slug);
            toast(inWishlist(product.slug) ? "Removed from wishlist" : "Saved to wishlist");
          }}
        />
      </div>

      <ProductReviewsSection product={product} />
      <RelatedProductsSection related={related} isPending={relatedQuery.isPending} />
    </>
  );
}
