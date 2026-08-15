<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md - Daily Drip Storefront

## Overview

TanStack Start (React 19.2 + Vite 8) storefront for Daily Drip, deployed to Cloudflare Workers (Nitro `cloudflare-module`). Talks to the Medusa v2 backend at `https://api.yourdailydrip.com` **exclusively** through the Medusa JS SDK client (`src/lib/medusa.ts`) - never raw `fetch`. Package manager is **bun** (lockfile `bun.lock`) - never npm/pnpm here.

## Stack

- **Framework**: `@tanstack/react-start` (SSR on Workers), configured via `@lovable.dev/vite-tanstack-config` - do NOT re-add those Vite plugins manually (`vite.config.ts` comment).
- **Router**: `@tanstack/react-router` file-based routes in `src/routes/`; `routeTree.gen.ts` is GENERATED - never edit by hand.
- **Data fetching**: `@tanstack/react-query` (per-request `QueryClient` in `src/router.tsx`), key factories per hook module.
- **Styling**: **Tailwind CSS v4, CSS-first** - tokens live in `src/styles.css` (`@theme inline`). No `tailwind.config` file; do not add one. shadcn/ui-style components in `src/components/ui/`.
- **Env (public only)**: `VITE_MEDUSA_BACKEND_URL`, `VITE_MEDUSA_PUBLISHABLE_KEY`, `VITE_RAZORPAY_KEY_ID` - baked into the client bundle at build time. Worker secrets (`MEDUSA_BACKEND_URL`, `MEDUSA_PUBLISHABLE_KEY`, `RAZORPAY_KEY_ID`) set via `wrangler secret put`; SSR bridge in `src/server.ts` copies only those two into `process.env` (allow-list - backend secrets never touch the Worker).

## Commands

```bash
cd storefront
bun run dev            # http://localhost:5173
bun run build          # client + SSR + Nitro (cloudflare-module)
bun run deploy:workers # build + wrangler deploy
bun run test:run       # vitest run
bun run lint / format
```

## Routes (`src/routes/`)

| Route | URL | Purpose |
| --- | --- | --- |
| `__root.tsx` | (shell) | QueryClientProvider + ShopProvider; global `AnnouncementBar` + `Header` (hidden on `/`), `Footer`, `Chatbot`, `Toaster`; SEO head, 404, error boundary |
| `index.tsx` | `/` | Pre-launch landing for Advanced Hair Density Serum (countdown to `PRELAUNCH_ENDS_AT` in `lib/prelaunch.ts`); own transparent navbar |
| `shop.tsx` / `skin-care.tsx` / `hair-care.tsx` | `/shop`, `/skin-care`, `/hair-care` | Catalog grids via `<Collection>` (optional category filter) |
| `product.$slug.tsx` | `/product/:slug` | PDP: gallery, info panel (price/MRP/benefits/ingredients/how-to-use/stock), add-to-cart, Buy Now, wishlist, reviews, related |
| `cart.tsx` | `/cart` | Cart lines from `useShop()`, qty steppers, checkout gated behind auth (`CheckoutAuthModal`) |
| `checkout.tsx` | `/checkout` | 2-step: address → payment. Auto-attaches CHEAPEST shipping option (no picker). Razorpay modal → `cart.complete` → `/order-confirmation?order=<id>` |
| `order-confirmation.tsx` | `/order-confirmation` | Guest order lookup by `?order=`; items/totals/status/tracking section |
| `track-order.tsx` | `/track-order` | AWB lookup via `useTrackShipment`; scan timeline, pending/not-found/error states |
| `wishlist.tsx` | `/wishlist` | Wishlist grid (slugs resolved against live Medusa products via `useMappedProducts`) |
| `account.tsx` | `/account` | Sign in/up (emailpass) + Profile/Orders/Addresses tabs |
| `about.tsx`, `our-story.tsx`, `privacy.tsx`, `terms.tsx`, `returns.tsx`, `shipping-policy.tsx`, `how-to-use.tsx`, `blogs.tsx` | static | Content pages via `PageShell` + `Section` |

## Data Layer (`src/lib/`)

- `medusa.ts` - single configured SDK client (browser `VITE_*` / SSR `process.env`).
- `medusa-hooks.ts` - catalog + search hooks (`useProducts`, `useProduct`, `useCategories`, `useSearchProducts`/`useMappedSearchProducts` for free-text `q` search, `useFeaturedProducts`/`useMappedFeaturedProducts` for default sets), `mapMedusaProductToProduct` (reads `metadata.mrp/benefits/ingredients/howToUse/suitableFor/rating/reviews`), `REGION_ID = "reg_01KZ1FDN3K5N681SNXFQNA5NM5"` (live region - keep in sync with backend seed).
- `medusa-cart.ts` - server cart is source of truth; localStorage holds only `dd-cart-id`.
- `medusa-checkout.ts` - pure helpers: `validateAddress` (India: phone `^[6-9]\d{9}$`, pincode `^\d{6}$`), iThink option detection (`ITHINK_PROVIDER_ID = "ithink"`), `fetchShippingRateHints` → `GET /store/ithink/rates` via `sdk.client.fetch` (the ONE sanctioned raw-ish call; 502/network → null, non-blocking).
- `medusa-orders.ts` - `useOrder` (guest lookup), `useCustomerOrders` (JWT-scoped), `orderTrackingInfo`/`orderAwb` (reads `fulfillment.data.awb` / `refnum`).
- `medusa-tracking.ts` - `useTrackShipment(awb)` → backend `/store/ithink/track`; 404 → null.
- `medusa-auth.ts` - emailpass auth; JWT in localStorage under `medusa_auth_token`.
- `medusa-payment.ts` - `initiateRazorpaySession` (provider `pp_razorpay_razorpay`), amount in paise from `session.data.razorpayOrder` - never convert.
- `medusa-addresses.ts` - customer address book CRUD.
- `razorpay.ts` - lazy `checkout.razorpay.com/v1/checkout.js` loader; only `{ type: "order" }` resolves; cancel/fail leave cart intact.
- `products.ts` - shared product types + `formatPrice`/`discountPct` helpers ONLY. No catalog data lives here anymore - all product content (catalog, search, wishlist, PDP) is fetched live from Medusa via `medusa-hooks`.
- `store.tsx` - `ShopProvider`/`useShop` context: cart + wishlist (`dd-wishlist` localStorage, debounced 400ms sync to `customer.metadata.wishlist` for signed-in users).

**Invariants**: prices are INR integers end-to-end (749 = Rs 749), never divide/multiply; explicit `fields` on every Store API call; SDK bodies are plain objects, never `JSON.stringify`.

## Components (`src/components/`)

- **Chrome**: `Header.tsx` (sticky, dropdown nav, live Medusa search dialog, wishlist/cart badges, logo), `AnnouncementBar.tsx` (promo marquee), `Footer.tsx` (dark forest green, socials, Shop/Company/Help columns, local-only newsletter), `Chatbot.tsx` (rule-based "Drippy"; **launcher hidden** via `.chat-toggle-hidden` in `styles.css` - remove that rule to re-enable).
- **landing/**: transparent `Navbar.tsx`, countdown `AnnouncementBar.tsx`, Hero/Benefits/Ingredients/Promotion/Trust/FAQ sections, `Reveal.tsx` scroll-reveal.
- **product/**: `Collection.tsx`, `ProductCard.tsx`, `ProductImageGallery.tsx`, `ProductInfoPanel.tsx`, `ProductReviewsSection.tsx`, `RelatedProductsSection.tsx`, skeletons.
- **checkout/**: `StepIndicator.tsx`, `CheckoutAddressForm.tsx`, `CheckoutAuthModal.tsx`, `CheckoutSummary.tsx`, `PaymentStep.tsx`.
- **account/**: `OrdersTab.tsx`, `AddressesTab.tsx`.
- **ui/**: ~50 shadcn-style wrappers (Radix + cva + `cn` from `lib/utils.ts`).

## Design System (`src/styles.css`)

- Fonts: `--font-display: Montserrat`, `--font-body: Roboto` (loaded via Google Fonts `<link>` in `__root.tsx` head).
- Brand palette (oklch CSS vars): `--leaf`, `--deep`, `--sand`, `--forest: #0B1710`, `--olive`, `--sage`, `--cream`, `--gold`, `--charcoal` + full shadcn semantic set.
- `@theme inline` maps vars to Tailwind utilities (`bg-primary`, etc.); `@custom-variant dark` for dark mode; `@utility marquee-track` for the announcement bar.
- Tailwind v4 CSS-first: tokens ONLY in this file. Do not add `tailwind.config.js` or duplicate Vite plugins.

## Tests

Vitest 4 (`vitest.config.ts`, jsdom, globals). Run: `bun run test:run`. Existing suites (all pure helpers, SDK mocked):
- `medusa-checkout.test.ts` - `vi.mock("./medusa", () => ({ sdk: { client: { fetch: vi.fn() } } }))`; rate hints null-mapping, `shippingOptionDetail`.
- `medusa-orders.test.ts` - `orderTrackingInfo`/`orderAwb` over fixtures.
- `medusa-tracking.test.ts` - `parseTrackResponse`.

Convention: colocate `*.test.ts` next to source; mock the SDK module, keep pure helpers DOM/network-free. `@testing-library/react` + `msw` are installed but unused - component tests are a gap. CI does NOT run tests (deploy-only workflows).

## Common Mistakes

- Raw `fetch` to Medusa instead of the SDK client in `medusa.ts`.
- Converting/formatting prices (INR integers; format only at render via `formatPrice`).
- Editing `routeTree.gen.ts` or adding a duplicate Vite plugin / tailwind.config.
- Hardcoding product data in components instead of reading live from `medusa-hooks` (`products.ts` holds only types/helpers).
- Hand-editing the `LOVABLE:BEGIN/END` block above or rewriting published git history (Lovable sync).
