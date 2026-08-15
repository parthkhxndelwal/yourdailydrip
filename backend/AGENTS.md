# AGENTS.md - Daily Drip Backend

## Overview

Medusa v2 (2.18.0) commerce backend for Daily Drip, an Indian DTC skincare/hair-care brand. Node 20+, PostgreSQL (prod: `postgres:16-alpine` in compose; dev: port 5433 because Windows owns 5432). npm workspaces + Turborepo; package manager is **npm (npm@11.16.0)** - never pnpm/yarn/bun here.

The app lives in `apps/backend/` (package `@dtc/backend`); all custom code is under `apps/backend/src/`. Deployment topology and ops: see `DEPLOYMENT.md` and the root `AGENTS.md`.

## Directory Structure

```
apps/backend/
├── medusa-config.ts        module registrations + env-derived options
├── jest.config.js          Jest + @swc/jest; TEST_TYPE-driven testMatch
├── integration-tests/      only setup.js (MetadataStorage.clear); http/*.spec.ts suites configured but absent
├── patches/*.md            manual razorpay provider patch write-ups (see Gotchas)
└── src/
    ├── admin/              admin dashboard extension: widgets/product-marketing-fields.tsx
    ├── api/                file-based routes: store/ + admin/; middlewares.ts
    ├── jobs/               scheduled jobs (cron)
    ├── links/              module links (preorder_variant<->product_variant, preorder->order)
    ├── migration-scripts/  storefront-bootstrap.ts (runs inside `medusa db:migrate`)
    ├── modules/            preorder (data), ithink (fulfillment provider), resend (notification provider)
    ├── scripts/            ithink-payload-smoke.ts (offline smoke test, `medusa exec`)
    ├── subscribers/        event subscribers (preorder lifecycle + iThink gating)
    └── workflows/          workflows + steps/ (preorder upsert/disable/fulfill-due)
```

`medusa build` copies the admin dashboard bundle to `public/admin/` (build script).

## Runtime Config (medusa-config.ts)

- **DB**: PostgreSQL via `DATABASE_URL`. No redis/meilisearch registered - empty `REDIS_URL` means in-memory cache. Do not assume redis exists.
- **File storage**: `file-s3` provider (id `s3`) → Cloudflare R2 (`acl: false` - R2 is BucketOwnerEnforced). Powers `POST /admin/uploads`. Throws at boot without `S3_*` vars.
- **Payment**: `medusa-plugin-razorpay-v2@0.1.4` (id `razorpay`). Requires `RAZORPAY_ID/SECRET/ACCOUNT/WEBHOOK_SECRET` to boot; crash-loops without them. Webhook: `/hooks/payment/razorpay_razorpay`.
- **Fulfillment**: providers `fulfillment-manual` (id `manual`) + `./src/modules/ithink` (id `ithink`). iThink options from `ITHINK_*` env; `mode` = `dashboard` (default) or `book`.
- **Preorder**: `./src/modules/preorder` (custom data module, `PREORDER_MODULE = "preorder"`).
- **Notification**: `./src/modules/resend` (id `resend`) when `RESEND_API_KEY` set, else `notification-local` (id `local`, logs only).

Authoritative env matrix: `backend/.env.example` (root of `backend/`). Required-to-boot: `RAZORPAY_*`, `S3_*`. Optional: `ITHINK_*`, `RESEND_*`, `REDIS_URL`, `STOREFRONT_BASE_URL`.

## Custom Modules

### preorder (`src/modules/preorder/`) - data module
- `PreorderVariant` (`preorder_variant`): `variant_id` (unique, partial unique index), `available_date`, `status` `enabled|disabled`.
- `Preorder` (`preorder`): `order_id` (readOnly link to order), `item_id` → preorder_variant, `status` `pending|fulfilled|cancelled`.
- Service: `MedusaService({ PreorderVariant, Preorder })` - auto CRUD only, no custom methods.
- Links: `src/links/preorder-variant.ts` (writable link to product_variant), `src/links/preorder-order.ts` (readOnly virtual link).
- Migration: `migrations/Migration20260808213903.ts`. New schema changes: `npx medusa db:generate preorder`; never rewrite an existing migration.
- Business logic lives OUTSIDE the module: workflows (upsert/disable), subscribers (`preorder-created/shipped/canceled`), `jobs/preorder-fulfillment.ts` + `workflows/fulfill-due-preorders.ts`.

### ithink (`src/modules/ithink/`) - fulfillment ModuleProvider (static id "ithink")
No data models; all state lives in `fulfillment.data`/`metadata` JSON. Authoritative contract: `src/modules/ithink/README.md` (read before touching this module).

- `services/ithink-fulfillment.ts` - provider service: `createFulfillment` (dashboard → `order/sync.json` no booking; book → `order/add.json` with carrier), `calculatePrice`, `validateFulfillmentData`, `cancelFulfillment` (no-AWB → no-op `cancel-in-dashboard`), `getFulfillmentDocuments`.
- `services/fulfillment-validation.ts` - `validateWithRates`, shared module-level rate cache (TTL 30min, max 1000 entries, FIFO), `getRateHints` (used by store route).
- `services/mappers.ts` - provider option resolution, carrier list, cart total/weight/dimension math.
- `services/fulfillment-params.ts` - Medusa order → `order/add.json` payload.
- `services/tracking.ts` - status vocabulary (`TERMINAL_STATUS_CODES` DL/CN/Lost/Shortage/RTO Shortage), `normalizeTrackShipment`.
- `services/reconciliation.ts` - Path A: AWB discovery via `get_details` for no-AWB fulfillments.
- `services/shipment-enrichment.ts` - Path B: `get_awb` 30-min window + `track.json` enrichment, writes `metadata.ithink_tracking`, dedups via `snapshotsEqual`.
- `clients/ithink-client.ts` + `payloads.ts` + `types.ts` - POST-only client, credentials INSIDE body `data` (never headers), 15s AbortController timeout, chunking (sync 25, details 500, track 10, cancel/label 100), readable `MedusaError`s, "No Data found." tolerated as empty.

Modes: **dashboard** (default) = sync to iThink Store Order tab; ops books shipments in the iThink dashboard; Medusa learns AWB/status via the 30-min poll. **book** = legacy immediate booking capturing AWB + labels.

### resend (`src/modules/resend/`) - notification ModuleProvider (id "resend")
- `layout.ts` - shared branded HTML email layout (table-based, inline CSS, Daily Drip palette) + helpers: `escapeHtml`, `formatInr`, `formatDate`, `itemsRows`, `renderLayout`.
- `service.ts` - sends via resend SDK; `templates.ts` holds five in-code templates: `order_ack`, `preorder_ack`, `order_shipped`, `preorder_refund`, `order_canceled` (`{{key}}` interpolation, HTML-escaped). Keys referenced by subscribers.
- `scripts/resend-smoke.ts` - `medusa exec resend-smoke` sends a real `order_ack` test email (recipient from `RESEND_SMOKE_TO`) to verify DNS + API key + templates end-to-end.

## Workflows, Jobs, Subscribers

**Workflows** (`src/workflows/` + `steps/`):
- `fulfill-due-preorders.ts` - queries enabled preorder_variants with `available_date <= now`, pending preorders, orders; per order: skip if fulfillment exists or payment collection not `completed` (note: "completed", not "captured"); runs `createOrderFulfillmentWorkflow`; flips preorders to `fulfilled`. Per-order failures collected, never raised; records stay `pending` for retry. No workflow-level compensation.
- `upsert-product-variant-preorder.ts` - validate variant → create-or-update preorder_variant → remote link → `allow_backorder=true`.
- `disable-preorder-variant.ts` - disable + `allow_backorder=false`.
- Steps have compensation (restore prior state).

**Jobs** (`src/jobs/`):
- `preorder-fulfillment.ts` - cron `0 */6 * * *`, runs fulfill-due-preorders.
- `ithink-tracking.ts` - cron `*/30 * * * *`, reconciliation poll. Single-replica assumption (no lock) - see root AGENTS.md. Honors `poll_enabled=false`.

**Subscribers** (`src/subscribers/`):
- `order-placed.ts` - iThink auto-submit gate: skips unless payment captured, no existing fulfillment, has items, no enabled preorder variants, and provider mode = "book".
- `preorder-created.ts` (order.placed) - creates `pending` Preorder rows, writes `order.metadata.preorder_expected_ship_date` (min available_date), sends `preorder_ack`.
- `order-ack.ts` (order.placed) - sends `order_ack` for orders with NO enabled preorder variant items (preorders get `preorder_ack` instead; variant check, not row check - the two run concurrently).
- `shipment-notification.ts` (order.fulfillment_created + fulfillment.updated) - sends `order_shipped` once per fulfillment when an AWB exists; dedupes via `metadata.shipped_email_sent`. Works in iThink dashboard mode because the poll emits `fulfillment.updated` after discovering the AWB (retries until it appears). Replaced `preorder-shipped.ts`.
- `preorder-canceled.ts` (order.canceled) - flips rows to `cancelled`, sends `preorder_refund`.
- `order-canceled.ts` (order.canceled) - sends `order_canceled` for orders with no preorder rows (preorders get `preorder_refund` instead).

## API Routes (file-based)

Store (public, no auth):
- `GET /store/ithink/rates?pincode=&mrp=` - cheapest+fastest courier rate hints, delivery TAT/ETA.
- `GET /store/ithink/track?awb=|order_no=` - tracking snapshot from `metadata.ithink_tracking`; `pending` state for synced-but-unbooked.
- `GET /store/custom` - stub.

Admin:
- `POST /admin/variants/:id/preorders` (zod-validated `available_date`) - upsert preorder variant.
- `DELETE /admin/variants/:id/preorders` - disable preorder variant.
- `POST /admin/preorders/fulfill` - manual run of fulfill-due-preorders.
- `GET /admin/ready` - DB readiness probe (`AUTHENTICATE = false`).
- `GET /admin/custom` - stub.

Middleware (`src/api/middlewares.ts`):
- `validateAndTransformBody` on POST /admin/variants/:id/preorders.
- `blockMixedPreorderCart` on `POST /store/carts/:id/line-items` - rejects mixing preorder + in-stock items in one cart (enforced at add-to-cart, not checkout).

## Tests

Jest 29 + `@swc/jest` (NOT vitest). `jest.config.js` sets testMatch from `TEST_TYPE`:
- `test:unit` → `src/**/__tests__/**/*.unit.spec.ts` (the only suite with real files)
- `test:integration:modules` / `test:integration:http` → configured but match ZERO files (integration-tests/ has only setup.js); they also need a live Postgres

```bash
cd backend && npm test                          # turbo -> all app test tasks
cd backend/apps/backend && npm run test:unit    # unit suite
cd backend/apps/backend && npm run test:unit -- src/modules/ithink/services/__tests__/ithink-options.unit.spec.ts
cd backend/apps/backend && npm run test:unit -- -t "dashboard"
```

14 unit specs exist: ithink client (804 lines), ithink-options, ithink-fulfillment-validation, ithink-dashboard-mode, order-placed subscriber, preorder-created subscriber, order-ack subscriber, shipment-notification subscriber, order-canceled subscriber, resend templates, ithink-tracking job (432 lines), rates route, track route, announcement route. Conventions: colocate `<name>.unit.spec.ts` in `__tests__/` next to source; mock via `jest.spyOn(IthinkClient.prototype, ...)`, constructor-injected `fetchImpl`, or `globalThis.fetch` swap; mock container as `{ resolve: (key) => deps[key] }`; assert `MedusaError` types; `jest.useFakeTimers()` for TTL tests; `clearRateCache()` between tests.

**Coverage gaps** (candidates for new tests): `workflows/fulfill-due-preorders.ts` step logic (highest value), preorder workflows/steps, `jobs/preorder-fulfillment.ts`, `subscribers/preorder-canceled.ts` (unit exists), `modules/resend/service.ts` (resend SDK send path), direct units for `services/tracking.ts` / `reconciliation.ts` / `shipment-enrichment.ts` / `fulfillment-params.ts`, admin routes, `api/middlewares.ts`.

## Code Style & Lint

- `@medusajs/eslint-plugin` recommended config is enforced (`eslint.config.ts`); its rules encode Medusa framework shapes. Never disable a `@medusajs/*` rule - fix the code.
- No semicolons. Double quotes, 2-space indent. Files kebab-case; types/classes PascalCase; functions/variables camelCase; DB columns snake_case. No emojis.

## Conventions

- **File-based routing**: store endpoint = `src/api/store/<path>/route.ts` exporting GET/POST/etc. No manual router registration.
- **Business logic belongs in workflows**, not route handlers. Routes resolve and run a workflow.
- New migration for a model change via `npx medusa db:generate <module>`, then `npx medusa db:migrate`.
- `db:migrate` runs `storefront-bootstrap.ts` (seed). Seeded region id `reg_01KZ1FDN3K5N681SNXFQNA5NM5` is hard-coded in the storefront as REGION_ID - don't break it.
- Medusa agentic skills (`medusa-dev:building-with-medusa`, `db-generate`, `db-migrate`, `new-user`) should be loaded before backend code work when available.

## Gotchas

- **Razorpay needs two manual node_modules patches** (`apps/backend/patches/razorpay-module-container.md`, `razorpay-webhook-notes.md`); patch-package export at `backend/patches/medusa-plugin-razorpay-v2+0.1.4.patch` re-applies on `postinstall`. Any `npm ci`/`npm install` reruns it. If razorpay behaves oddly after a fresh install, check the patches were re-applied.
- **`ITHINK_TRACK_BASE_URL` is documented (README + .env.example) but NOT implemented** in the client/config - flag before relying on it.
- `createFulfillment` is idempotent on `data.refnum` (returns early, no API call). Reconciliation poll is the ONLY writer of AWB/tracking state; `shipped_at`/`delivered_at` are write-once.
- Dashboard mode: `createFulfillment` throws at runtime without `ITHINK_RETURN_ADDRESS_ID` (boot only warns).
- `/health` is liveness (200 even with DB down); `/admin/ready` is the DB readiness probe (503 in ~3s).
- `fulfill-due-preorders` checks payment collection status `"completed"` (this Medusa build has no CAPTURED).
- The iThink tracking poll must not run on multiple replicas (`ITHINK_POLL_ENABLED=false` on all but one); get_awb window is exactly the 30-min cron interval.
- `storefront-bootstrap.ts` seeds image URLs pointing at `localhost:5173/src/assets` - they won't load from the VPS; the storefront bundles local copies so the catalog renders anyway.

## Off-Limits

- `.env`, `.env.local`, `*.pem` - never commit/print/copy secret values. Edit `.env.example`/`.env.template` when documenting a new variable.
- Build output: `.medusa/`, `dist/`, `.output/`, `.turbo/`, `**/public/admin/`.
- Existing migrations in `src/modules/*/migrations/` - add a new migration, never rewrite one that may have run.
- `node_modules` patches: reapply via patch-package, never hand-edit committed sources.
- Destructive DB commands (drops, resets) without explicit user approval.
