/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Medusa backend base URL (SSR + client). Falls back to http://localhost:9000. */
  readonly VITE_MEDUSA_BACKEND_URL?: string;
  /** Storefront publishable API key scoped to the India sales channel. */
  readonly VITE_MEDUSA_PUBLISHABLE_KEY?: string;
  /** Razorpay public key id (client-side, NEVER the secret). Enables the checkout modal. */
  readonly VITE_RAZORPAY_KEY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
