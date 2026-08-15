// Shared product types and formatting helpers for the storefront.
//
// This module intentionally holds NO catalog data. Product data is fetched
// live from the Medusa backend through the SDK data layer in ./medusa-hooks.ts
// (useProducts / useMappedProducts / useSearchProducts / useFeaturedProducts).
// The types and helpers here are the shared contract between the data layer
// and the UI — keep their signatures stable, they are imported across the app.

export type Review = {
  name: string;
  rating: number;
  date: string;
  title: string;
  body: string;
};

export type Product = {
  slug: string;
  /** Medusa variant id (present on Medusa-mapped products) used by add-to-cart. */
  variantId?: string;
  name: string;
  category: "skin-care" | "hair-care";
  tagline: string;
  price: number;
  mrp?: number;
  size: string;
  stock: number;
  images: string[];
  shortDescription: string;
  description: string;
  benefits: string[];
  ingredients: string[];
  howToUse: string[];
  suitableFor: string;
  rating: number;
  reviews: Review[];
};

export const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export const discountPct = (p: Product) =>
  p.mrp ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;