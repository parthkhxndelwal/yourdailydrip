import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            // Cloudflare R2 (S3-compatible) file storage for product image
            // uploads from the admin dashboard (POST /admin/uploads). R2 is
            // BucketOwnerEnforced, so acl MUST be false (no ACL headers or the
            // SDK fails). Requires real R2 API-token credentials (S3_*) in
            // backend/.env; the provider throws at boot without them - fail
            // fast here instead of surfacing upload errors later.
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.S3_FILE_URL!,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION,
              bucket: process.env.S3_BUCKET,
              prefix: process.env.S3_PREFIX,
              endpoint: process.env.S3_ENDPOINT,
              acl: false,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            // medusa-plugin-razorpay-v2 (SGFGOV) community provider, pinned to
            // 0.1.4 in apps/backend/package.json. Requires real Razorpay test
            // credentials (RAZORPAY_ID/SECRET/ACCOUNT/WEBHOOK_SECRET) to boot;
            // without them the provider init throws "razorpay not configured".
            // Webhook notes patch: see apps/backend/patches/razorpay-webhook-notes.md.
            resolve: "medusa-plugin-razorpay-v2/providers/payment-razorpay/src",
            id: "razorpay",
            options: {
              key_id: process.env.RAZORPAY_ID,
              key_secret: process.env.RAZORPAY_SECRET,
              razorpay_account: process.env.RAZORPAY_ACCOUNT,
              webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
              auto_capture: true,
              refund_speed: "normal",
              automatic_expiry_period: 30,
              manual_expiry_period: 20,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            // Built-in manual fulfillment provider. Shipping options created
            // with provider_id "manual_manual" (e.g. the Standard/Express flat
            // options seeded for India) require it to be registered here.
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            // iThink Logistics V3 fulfillment provider (todo 11). Custom module
            // under src/modules/ithink. Requires ITHINK_BASE_URL/ACCESS_TOKEN/
            // SECRET_KEY/PICKUP_ADDRESS_ID to reach the API; without them the
            // provider still boots, and checkout surfaces readable errors.
            resolve: "./src/modules/ithink",
            id: "ithink",
            options: {
              base_url: process.env.ITHINK_BASE_URL,
              access_token: process.env.ITHINK_ACCESS_TOKEN,
              secret_key: process.env.ITHINK_SECRET_KEY,
              pickup_address_id: process.env.ITHINK_PICKUP_ADDRESS_ID,
              gst_number: process.env.ITHINK_GST_NUMBER,
            },
          },
        ],
      },
    },
    {
      // Preorder module: preorder_variant / preorder data models + links to
      // product_variant and order (read-only). Migration: npx medusa
      // db:generate preorder, then npx medusa db:migrate.
      resolve: "./src/modules/preorder",
    },
    {
      // Notification module: exactly ONE email provider per boot. Medusa
      // routes sends by channel and throws if multiple providers claim the
      // same channel, so RESEND_API_KEY decides: set -> hand-rolled resend
      // provider (src/modules/resend, raw HTML templates from code - no
      // dashboard template IDs), unset -> local provider that logs instead
      // of sending (dev). options.cloud is intentionally NOT set - it would
      // auto-register Medusa Cloud Email as a third email provider.
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: process.env.RESEND_API_KEY
          ? [
              {
                resolve: "./src/modules/resend",
                id: "resend",
                options: {
                  channels: ["email"],
                  api_key: process.env.RESEND_API_KEY,
                  from: process.env.RESEND_FROM_EMAIL,
                },
              },
            ]
          : [
              {
                resolve: "@medusajs/medusa/notification-local",
                id: "local",
                options: {
                  channels: ["email"],
                },
              },
            ],
      },
    },
  ],
})
