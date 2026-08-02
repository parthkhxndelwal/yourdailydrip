# Daily Drip Essentials

I want you to build a website for a healthcare brand called Daily Drip. These are the requirements shared by client. Get started. 

1.	Please include a top navigation bar with the following options:

•	Shop: Asking what you want to shop

o	Skin Care

o	Hair Care

•	Hair Care

•	Skin Care

•	Track Order

•	Search (Icon)

•	Cart (Icon)

•	Wishlist (Icon)

•	Account / Sign Up (text or icon)

2.	Please include a sliding top bar/announcement bar that can display multiple daily offers, schemes, or promotional messages.

It should rotate smoothly and remain easy to read without looking too crowded. The design should feel attractive and noticeable, while still matching the overall website look.

3.	Please add a testimonial section with the heading: “What Our Customers Say”

This section should include a rotating/sliding testimonial slider to showcase customer reviews in an attractive and clean way. The slider should be easy to read and visually appealing, so it builds trust and highlights customer satisfaction.

4.	Please include a company information section and important footer/support pages for the website.

Example:

 

The website should include:

Company Overview

•	About Us

•	Our Story / Our Values

•	Privacy Notice

•	Shipping Policy

•	Return & Refund Policy

•	How to Use

•	Blogs

•	Chatbot Assistant

•	Social Media Redirect Icons/Links

These sections should be well-organized and easy for users to access. Important policy pages and company details can be placed in the footer or another clearly visible section. The social media icons should redirect users to all official social media pages.

When a customer clicks on a product to proceed with buying, the product detail page should be clear, informative, and easy to use.

Please include the following on each product page:

•	Product name

•	Product images

•	Product price

•	Discount/offer price, if applicable

•	Short product description

•	Detailed product description

•	Key benefits

•	Ingredients / product contents

•	How to use

•	Suitable for which skin type / hair type

•	Product size or quantity

•	Stock availability

•	Add to Cart button

•	Buy Now button

•	Wishlist option

•	Ratings and customer reviews

•	Delivery or shipping information

•	Return/refund information

•	Related or recommended products

The product page should look clean and trustworthy, and it should help the customer make a buying decision easily.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://yourdailydrip.lovable.app

---

## Architecture

The storefront is a TanStack Start app (Vite + React) that runs on
[Cloudflare Workers](https://workers.cloudflare.com) (Nitro `cloudflare-module`
preset). Commerce data comes from the Medusa backend at
`https://api.yourdailydrip.com` (self-hosted VPS — see
`backend/docker-compose.prod.yml` and `backend/DEPLOYMENT.md`).

```
Browser  ──(SDK, VITE_* config baked at build time)──▶  https://api.yourdailydrip.com (Medusa)
Worker SSR ──(SDK, MEDUSA_BACKEND_URL / MEDUSA_PUBLISHABLE_KEY from Worker env)──▶  Medusa
```

- **Data layer** (`src/lib/`): `medusa.ts` is the single configured Medusa JS
  SDK client; `medusa-hooks.ts` (catalog), `medusa-cart.ts` (cart),
  `medusa-checkout.ts` (address/shipping/payment steps), `medusa-auth.ts`
  (register/login), `medusa-orders.ts` (orders), `medusa-tracking.ts`
  (iThink tracking) hang off it. All Store API traffic goes through the SDK —
  never raw `fetch`.
- **SSR env bridge** (`src/server.ts`): the Worker handler copies only the
  public keys `MEDUSA_BACKEND_URL` / `MEDUSA_PUBLISHABLE_KEY` into
  `process.env` before the server entry is imported; `medusa.ts` prefers them
  on the server and the build-time `VITE_*` values in the browser.
- **Payments**: Razorpay Checkout.js is opened with the public key id; order
  state is settled server-side by the Medusa webhook, never the modal callback.
- **Backend-unavailable behavior**: catalog (`Collection`), product,
  cart, checkout, order-confirmation, and tracking routes render friendly
  loading/error/empty states instead of blank pages when Medusa is unreachable.

## Environment

Copy `.env.example` to `.env` for local dev (`VITE_MEDUSA_BACKEND_URL`,
`VITE_MEDUSA_PUBLISHABLE_KEY`, `VITE_RAZORPAY_KEY_ID`). These `VITE_*` values
are baked into the browser bundle at build time.

**Production secrets** (public config, set once on the Worker — never
committed):

```sh
npx wrangler secret put MEDUSA_BACKEND_URL        # https://api.yourdailydrip.com
npx wrangler secret put MEDUSA_PUBLISHABLE_KEY    # pk_...
npx wrangler secret put RAZORPAY_KEY_ID           # rzp_live_...
```

or run `./scripts/setup-secrets.sh` / `.\scripts\setup-secrets.ps1`. The
production **client build** additionally needs the `VITE_*` trio above set in
the build environment (the browser can't read Worker secrets).

Backend-only secrets — `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `ITHINK_*` — live on the Medusa
VPS and never appear here, in Worker env, or in any client bundle.

## Deploy

```sh
bun run build            # Vite client + SSR + Nitro (cloudflare-module)
npx wrangler deploy      # uploads from .wrangler/deploy/config.json
```

`bun run deploy:workers` runs both. Deploying to the live domain
`https://yourdailydrip.com` is **deferred / manual** (requires real Medusa
publishable key + Razorpay live key id, plus the VPS backend from todo 16
being live); see `.omo/plans/medusa-storefront-integration.md` todo 17.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e61f20dd-3617-42c5-981f-ac74f39248cc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
