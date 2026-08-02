// Medusa-backed data layer for the storefront.
//
// This module is the single catalog data source for the routes; it exposes a
// small, stable API surface that routes consume directly:
//   - queryKeys, useProducts(category?), useProduct(slug), useCategories()
//   - convenience selectors useMappedProducts / useMappedProduct (Product shape)
//
// All reads go through the shared Medusa JS SDK client in ./medusa.ts (never
// raw fetch). The SDK attaches the publishable API key header on every request
// and scopes results to the default India sales channel.
//
// Prices are as-is INR amounts (749 = 749). Never divide by 100 — Medusa does
// not store minor units here. MRP is not a native Medusa price field
// (calculated_price.original_amount is price-list discount semantics), so it is
// read from product.metadata.mrp, which the seed script writes per product.
//
// Products are fetched with an explicit Store API fields list because the
// Store API does not return categories/metadata/variants/calculated prices by
// default, and with region_id so calculated prices are computed for INR.

import { useQuery } from "@tanstack/react-query";
import { sdk } from "./medusa";
import type { Product, Review } from "./products";

// ── Constants ───────────────────────────────────────────────────────────────

export const REGION_ID = "reg_01KZ1FDN3K5N681SNXFQNA5NM5";

const PRODUCT_FIELDS =
  "id,title,handle,subtitle,description,thumbnail,metadata,*categories,images.*,*variants,variants.calculated_price,variants.inventory_quantity";

const CATEGORY_FIELDS = "id,name,handle,description,rank,parent_category_id";

// Store API shapes resolved from the installed SDK itself, so these always
// match the SDK's actual response types.
type StoreProduct = Awaited<ReturnType<typeof sdk.store.product.list>>["products"][number];
type StoreCategory = Awaited<
  ReturnType<typeof sdk.store.category.list>
>["product_categories"][number];

// ── Types ───────────────────────────────────────────────────────────────────

// Narrow, app-owned projection of a Store API product that the mapper reads.
// StoreProduct is structurally assignable to this, so hooks pass SDK results
// straight through with no casts. Keeping a narrow input type also keeps
// standalone mapper smoke checks cheap to fixture.
export type MedusaProductInput = {
  id: string;
  title: string;
  handle: string;
  subtitle: string | null;
  description: string | null;
  thumbnail: string | null;
  images: Array<{ url: string; rank: number }> | null;
  categories?: Array<{ handle: string }> | null;
  metadata?: Record<string, unknown> | null;
  variants: Array<{
    id: string;
    title: string | null;
    sku: string | null;
    inventory_quantity?: number | null;
    calculated_price?: { calculated_amount: number | null } | null;
  }> | null;
};

// The app Product shape plus the Medusa product id (Product itself has no id).
export type MappedMedusaProduct = Product & { id: string };

// ── Defensive parse helpers (unknown → typed) ───────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

// Accepts an array of strings OR a newline-delimited string (handles both the
// seeded shape and any future malformed/imported metadata).
function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseString(item))
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  return [];
}

function parseReviews(value: unknown): Review[] {
  if (!Array.isArray(value)) return [];
  const reviews: Review[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    reviews.push({
      name: parseString(item.name, "Verified Buyer"),
      rating: parseNumber(item.rating),
      date: parseString(item.date),
      title: parseString(item.title),
      body: parseString(item.body),
    });
  }
  return reviews;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function resolveCategory(product: MedusaProductInput): Product["category"] {
  const categories = product.categories ?? [];
  for (const category of categories) {
    const handle = category.handle.toLowerCase().replace(/-/g, "");
    if (handle === "skincare") return "skin-care";
    if (handle === "haircare") return "hair-care";
  }
  // Default category when no product category maps to an app category.
  return "hair-care";
}

// Matches a category query (handle slug, spaced label, or human title) against
// a product's categories without depending on exact casing/spacing.
function productInCategory(
  product: MedusaProductInput,
  query: string,
): boolean {
  const wanted = query.trim().toLowerCase().replace(/[\s-]/g, "");
  if (wanted.length === 0) return false;
  return (product.categories ?? []).some((category) => {
    const handle = category.handle.toLowerCase().replace(/[\s-]/g, "");
    return handle === wanted;
  });
}

// ── Pure mapper ─────────────────────────────────────────────────────────────

export function mapMedusaProductToProduct(
  product: MedusaProductInput,
): MappedMedusaProduct {
  const metadata = isRecord(product.metadata) ? product.metadata : {};
  const variant = product.variants?.[0] ?? null;

  const rawMrp = parseNumber(metadata.mrp, 0);
  const mrp = rawMrp > 0 ? rawMrp : undefined;

  const size =
    parseString(metadata.size) || (variant?.title ?? "") || "30 ml";

  const images = [...(product.images ?? [])]
    .sort((a, b) => a.rank - b.rank)
    .map((image) => image.url)
    .filter((url) => url.length > 0);
  const imageList =
    images.length > 0 ? images : product.thumbnail ? [product.thumbnail] : [];

  const tagline =
    parseString(metadata.tagline) || (product.subtitle ?? "").slice(0, 80);

  return {
    id: product.id,
    slug: product.handle,
    variantId: variant?.id ?? undefined,
    name: product.title,
    category: resolveCategory(product),
    tagline,
    price: variant?.calculated_price?.calculated_amount ?? 0,
    mrp,
    size,
    stock: variant?.inventory_quantity ?? 0,
    images: imageList,
    shortDescription: stripHtml(product.subtitle ?? ""),
    description: stripHtml(product.description ?? ""),
    benefits: parseStringList(metadata.benefits),
    ingredients: parseStringList(metadata.ingredients),
    howToUse: parseStringList(metadata.howToUse),
    suitableFor: parseString(metadata.suitableFor, "All skin types"),
    rating: parseNumber(metadata.rating, 0),
    reviews: parseReviews(metadata.reviews),
  };
}

// ── Store API access (via the shared SDK client) ────────────────────────────

async function fetchProducts(params: {
  handle?: string;
  limit?: number;
}): Promise<StoreProduct[]> {
  const response = await sdk.store.product.list({
    fields: PRODUCT_FIELDS,
    region_id: REGION_ID,
    limit: params.limit ?? 100,
    ...(params.handle ? { handle: params.handle } : {}),
  });
  return response.products ?? [];
}

// ── TanStack Query key factory ──────────────────────────────────────────────

export const queryKeys = {
  all: ["medusa"] as const,
  products: ["medusa", "products"] as const,
  product: (slug: string) => ["medusa", "products", slug] as const,
  categories: ["medusa", "categories"] as const,
} as const;

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch all products, optionally filtered by category (handle slug or label).
 * Returns raw Medusa Store API products. Use `mapMedusaProductToProduct()`, or
 * the `useMappedProducts` selector, for the app's Product shape.
 */
export function useProducts(category?: string | undefined) {
  return useQuery<StoreProduct[], Error>({
    queryKey: category
      ? [...queryKeys.products, { category }]
      : queryKeys.products,
    queryFn: async () => {
      const products = await fetchProducts({});
      if (!category) return products;
      return products.filter((product) => productInCategory(product, category));
    },
    staleTime: 60_000,
  });
}

/**
 * Fetch a single product by handle/slug. Returns a raw Medusa Store API product.
 */
export function useProduct(slug: string) {
  return useQuery<StoreProduct, Error>({
    queryKey: queryKeys.product(slug),
    queryFn: async () => {
      const products = await fetchProducts({ handle: slug, limit: 1 });
      const product = products[0];
      if (!product) {
        throw new Error(`Product not found: ${slug}`);
      }
      return product;
    },
    enabled: slug.length > 0,
    staleTime: 60_000,
  });
}

/**
 * Fetch all active store product categories.
 */
export function useCategories() {
  return useQuery<StoreCategory[], Error>({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const response = await sdk.store.category.list({
        fields: CATEGORY_FIELDS,
        limit: 100,
      });
      return response.product_categories ?? [];
    },
    staleTime: 300_000,
  });
}

// ── Convenience selectors — mapped products ─────────────────────────────────

export function useMappedProducts(category?: string | undefined) {
  const query = useProducts(category);
  const mapped = query.data?.map(mapMedusaProductToProduct) ?? undefined;
  return { ...query, data: mapped };
}

export function useMappedProduct(slug: string) {
  const query = useProduct(slug);
  const mapped = query.data ? mapMedusaProductToProduct(query.data) : undefined;
  return { ...query, data: mapped };
}
