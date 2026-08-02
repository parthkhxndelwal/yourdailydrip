// Medusa JS SDK client — single configured instance for all Store API traffic.
//
// All Store API calls in the storefront go through `sdk` (never raw fetch);
// the SDK attaches the publishable API key header on every request and keeps
// prices/query shapes aligned with the backend. Custom (non-Store) routes use
// `sdk.client.fetch` so the header/token handling stays consistent.
//
// Configuration resolution — the SDK must init identically on both runtimes:
//   Browser (client build): Vite bakes the public VITE_* values in at BUILD
//     time — VITE_MEDUSA_BACKEND_URL / VITE_MEDUSA_PUBLISHABLE_KEY. They come
//     from storefront/.env (local dev) or the build environment (CI/prod).
//   SSR (Cloudflare Worker): src/server.ts bridges the Worker runtime env vars
//     MEDUSA_BACKEND_URL / MEDUSA_PUBLISHABLE_KEY into process.env before the
//     server entry is imported, so those win at runtime; the build-time VITE_*
//     values remain the fallback so local dev SSR matches the browser.
// Both values are PUBLIC client-side config (NOT backend secrets) — the Worker
// receives them as vars/secrets because SSR needs them at runtime, and the
// browser receives them via VITE_* at build time. Backend-only secrets
// (RAZORPAY_SECRET, DATABASE_URL, JWT_SECRET, ...) never appear here or in the
// Worker env.
//
// This module performs no `window`/`localStorage` access at module scope and
// the SDK constructor is config-only (no network), so importing it is safe in
// SSR bundles and never touches storage during server rendering.

import Medusa from "@medusajs/js-sdk";

// Client values are read once; Vite statically replaces import.meta.env in the
// browser bundle and leaves it as runtime access in SSR bundles.
const clientBaseUrl = import.meta.env.VITE_MEDUSA_BACKEND_URL;
const clientPublishableKey = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY;

// SSR (no `window`): prefer the Worker runtime env bridged into process.env by
// src/server.ts, falling back to the build-time VITE_* value (local dev).
function resolveBackendUrl(): string {
  if (typeof window === "undefined") {
    const ssrUrl =
      typeof process !== "undefined" ? process.env.MEDUSA_BACKEND_URL : undefined;
    return ssrUrl ?? clientBaseUrl ?? "http://localhost:9000";
  }
  return clientBaseUrl ?? "http://localhost:9000";
}

function resolvePublishableKey(): string | undefined {
  if (typeof window === "undefined") {
    const ssrKey =
      typeof process !== "undefined" ? process.env.MEDUSA_PUBLISHABLE_KEY : undefined;
    return ssrKey ?? clientPublishableKey;
  }
  return clientPublishableKey;
}

export const sdk = new Medusa({
  baseUrl: resolveBackendUrl(),
  publishableKey: resolvePublishableKey(),
  debug: import.meta.env.DEV,
});
