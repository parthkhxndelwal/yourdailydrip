# ithink-dashboard-fulfillment - Work Plan

## TL;DR (For humans)

**What you'll get:** You stop touching logistics in Medusa entirely. When you mark an order "ready to fulfill" in the Medusa admin (create a fulfillment), it appears in the iThink Logistics dashboard (Store Order tab, unbooked, no AWB). Your ops team does everything — courier selection (Ship Now), AWB generation, dispatch, NDR, reattempt, address correction, RTO, cancellation — in iThink's own dashboard. Medusa automatically learns the AWB and tracking status afterwards, so the storefront track-order page and order status keep working. The iThink module becomes a standalone, configurable, documented, unit-tested module ready to be open-sourced for other Medusa users.

**Why this approach:** iThink's dashboard is the product for logistics ops; Medusa is not. We hand orders to the dashboard via `order/sync.json` (no booking, no AWB), and reconcile back via `order/get_details.json` + `order/get_awb.json` + `order/track.json` polling (iThink has NO public webhooks — polling is the official pattern). A `mode: "dashboard" | "book"` provider option keeps the existing auto-booking behavior available for other stores while this store defaults to dashboard mode.

**What it will NOT do:** No COD, no returns/RTO via API (dashboard-native), no webhook dependency, no new DB tables (metadata only), no breaking of the storefront design system, no auto-booking on payment in dashboard mode.

**Effort:** Large
**Risk:** Medium — staging round-trip verification is blocked on iThink staging credentials and address IDs (see Decisions to sanity-check).

Your next move: review the "Decisions to sanity-check" table — the external items (iThink rate limits, staging creds, pickup/return address IDs, prod track.json URL) need your input, but nothing in Waves 1-3 is blocked by them. Approve and execution starts with Wave 1.

---

> TL;DR (machine): Large effort, Medium risk — backend iThink module gains `mode: "dashboard" | "book"` (default dashboard): createFulfillment → order/sync.json (no logistics), no auto-submit on order.placed, reconciliation job rewrite (get_details by order_no → AWB discovery; get_awb + track enrichment; shipped_at/delivered_at writes; per-call error isolation), track route pagination + pending state, rates proxy route (cheapest/fastest per pincode), storefront checkout hints + pending tracking UI, open-source hardening (options-only config, no outside-module imports, README/LICENSE/migration notes), deploy with new env vars. 17 todos, TDD via backend jest (test:unit) + storefront vitest, evidence under .omo/evidence/ithink-dashboard-fulfillment/.

## Context

- **User intent (locked):** logistics handled ONLY in the iThink dashboard (Store Order tab → Ship Now → AWB → dispatch → NDR/RTO/cancel); Medusa admin only triggers the initial sync; Medusa learns AWB + status afterwards; module must be open-source-ready (standalone, configurable via provider options, documented, tested).
- **Verified iThink API facts (ground truth, do not re-research):** `order/sync.json` syncs without booking (no `logistics` field, no waybill, max 25/req, returns `status`+`refnum`); `order/add.json` books immediately (AWB sync, max 10/req); `rate/check.json` returns ALL couriers (per-courier `rate`, `delivery_tat`, `zone` + top-level `expected_delivery_date`) — cheapest/fastest computed client-side, no "recommended" field; `pincode/check.json` per-courier serviceability; `order/get_details.json` lookup by `order_no` or `awb_number_list` (max 500 AWBs) returning `awb_no`, `logistic`, `latest_courier_status`, `expected_delivery_date` — THE AWB-discovery path; `order/track.json` AWB-only, max 10 AWBs; `order/get_awb.json` delta-poll, 30-min window, `yyyy-mm-dd H:i:s` datetimes; `order/cancel.json` + `shipping/label.json` max 100; NO public webhooks; staging `https://pre-alpha.ithinklogistics.com/api_v3/`, prod `https://my.ithinklogistics.com/api_v3/` (docs list track.json prod inconsistently as `https://api.ithinklogistics.com/api_v3/order/track.json` — open item); auth = `access_token`+`secret_key` INSIDE body `data` JSON, never headers; no documented rate limits (open item); `pickup_address_id` and `return_address_id` both required (current integration sends `return_address_id: ""` — must be configured).
- **Current integration state (ground truth, do not re-explore):** module at `backend/apps/backend/src/modules/ithink/` (index.ts, services/ithink-fulfillment.ts + tracking.ts + mappers.ts, clients/ithink-client.ts + payloads.ts + types.ts, unit tests). App-level `src/subscribers/order-placed.ts` auto-books on payment via createOrderFulfillmentWorkflow — MUST change. `src/jobs/ithink-tracking.ts` cron */30 delta-polls but: no per-call error isolation, skips terminal statuses, never writes shipped_at/delivered_at, single-replica assumption. `src/api/store/ithink/track/route.ts` hard-caps listFulfillments at take:100 (breaks >100 fulfillments) and 404s when no snapshot. medusa-config.ts wires ITHINK_BASE_URL/ACCESS_TOKEN/SECRET_KEY/PICKUP_ADDRESS_ID/GST_NUMBER; no return_address_id, no mode. Storefront: `src/lib/medusa-tracking.ts`, `src/routes/track-order.tsx` (4 states), `src/routes/order-confirmation.tsx` (reads fulfillment.data.awb), `src/lib/medusa-checkout.ts` (isIthinkShippingOption, shippingOptionDetail reads delivery_tat which is never populated), `src/routes/checkout.tsx`. No Redis. Jest via @swc/jest with 3 TEST_TYPE modes; storefront has vitest (`bun run test:run`). No emojis in code/comments/commits; no semicolons, double quotes, 2-space indent in backend.

## Scope

### Must have
- Provider option `mode: "dashboard" | "book"` (default `"dashboard"` for this store; book mode fully preserved for other stores) + new options `return_address_id`, `order_no_prefix`, `poll_enabled`.
- Dashboard-mode `createFulfillment` → `order/sync.json` (no logistics), stores `refnum` + `order_no` in `fulfillment.data`; idempotency guard (refnum already present → no re-sync).
- No auto-submit: `order.placed` subscriber skips workflow creation when mode is dashboard (book mode keeps current behavior).
- Reconciliation job rewrite: no-awb fulfillments → `get_details` by `order_no` (chunk 500) to discover AWB/carrier/status after dashboard booking; awb fulfillments → `get_awb` window + `track.json` enrichment (chunk 10); write `shipped_at`/`delivered_at`; per-call/per-fulfillment error isolation; emit FULFILLMENT_UPDATED + structured logs; `poll_enabled` option for multi-replica setups.
- Track route: paginate listFulfillments (no take:100 cap), support `awb` AND `order_no` lookup, return a pending state (200) for synced-but-unbooked fulfillments instead of 404.
- Checkout ETA: one `rate/check.json` call per pincode → cheapest (min rate) + fastest (min delivery_tat) + `expected_delivery_date` shown at checkout; persist `delivery_tat`/`expected_delivery_date` into shipping method data at `validateFulfillmentData` so the UI can show ETA.
- Storefront: track-order + order-confirmation handle "AWB pending (synced, awaiting booking)" gracefully.
- Open-source readiness: all config via provider options (no `process.env` reads inside module), no imports from outside the module directory, no yourdailydrip references inside module, comprehensive README, LICENSE, migration notes for current users, unit tests for all new dashboard-mode paths.
- Scale: chunking (25 sync / 500 details / 10 track / 100 cancel-label), idempotency, capacity note for 20K orders/month.
- Deployment: backend redeploy (VPS, `docker compose up -d --build`) with new env vars; storefront deploy to Workers; no db:migrate needed (metadata only — confirm at deploy).

### Must NOT have (guardrails, scope boundaries)
- COD — always `payment_method: "prepaid"` (unchanged from current integration).
- Returns / NDR / RTO / reattempt / address-correction via API — dashboard-native only. `cancelFulfillment` must NOT call `order/cancel.json` for unbooked (no-awb) fulfillments.
- Webhook dependency — polling only (no public webhooks exist; do not build webhook routes).
- New DB tables or schema changes — fulfillment.data + metadata JSON only.
- Breaking book-mode backward compat — all existing book-mode behavior and its tests must stay green; existing book-mode fulfillments (data.awb) continue to be reconciled.
- Breaking the storefront design system — hint cards and pending states use existing components/styles; no new design language.
- No new notification/email work — the "AWB email" promise on order-confirmation stays out of scope (no notification module).
- No iThink account provisioning (creating pickup/return addresses) — external, user does it in the iThink dashboard.
- No `getFulfillmentDocuments` rework — stays opaque (framework never calls it).
- No rate-limit engineering (retry/backoff) until iThink confirms limits (open item).
- No customer courier-preference persistence at checkout — dashboard decides the courier; rate hints are informational only.

## Decisions to sanity-check (open items)

| # | Item | Default assumption | Who resolves | Impact if wrong |
|---|------|--------------------|--------------|-----------------|
| 1 | iThink API rate limits / SLA | No documented limits; design targets 667 orders/day (20K/month) with chunking; no retry/backoff | iThink account team (external) | If strict limits exist, add retry/backoff + throttle in job (post-MVP) |
| 2 | Prod track.json URL inconsistency (docs: `https://api.ithinklogistics.com/api_v3/order/track.json` vs `https://my.ithinklogistics.com/api_v3/...`) | Single `ITHINK_BASE_URL` + optional `ITHINK_TRACK_BASE_URL` override env; verify at staging→prod cutover | iThink support (external) | Wrong URL breaks prod tracking; override env is the mitigation |
| 3 | `pickup_address_id` + `return_address_id` values | User creates both addresses in the iThink dashboard and supplies the IDs | User (external) — blocks T16 staging QA and T17 prod rollout of dashboard mode | Sync succeeds but Ship Now/booking fails without valid address ids |
| 4 | iThink staging credentials (pre-alpha) | None available yet | User/iThink (external) — blocks T16 | T16 runs later; T1-T15 unaffected |
| 5 | `order_no` arbitrary value + max length | `order_no` = `${order_no_prefix}${display_id}` (e.g. `YDD-42`); prefix avoids cross-store collisions | iThink (external, low risk) | If restricted, fall back to medusa order id in `order_no_prefix`/`order_no_mode` option |
| 6 | LICENSE choice | MIT (matches Medusa ecosystem), added in T14 | User confirm | Trivial to change |
| 7 | Module packaging | Stays an in-repo standalone module directory; npm publish deferred | User decision | No impact on this work |
| 8 | Confirm admin "Create fulfillment" in Medusa v2 admin routes through `createOrderFulfillmentWorkflow` → provider `createFulfillment` | Yes (framework behavior); verified by code inspection in T3 + staging test in T16 | Executor verifies in code during T3 | If routed differently, T3 adds a workflow/step to call the provider — contained, no design change |

## Verification strategy

> Zero human intervention except the explicitly flagged external items (creds, address ids, rate limits, track URL, LICENSE confirm). Unit tests are mandatory for all new backend paths (TDD: write the failing test first, then implement).
- **Backend unit tests:** `cd backend/apps/backend && npm run test:unit` (Jest, `**/src/**/__tests__/**/*.unit.spec.ts`, TEST_TYPE=unit). Every backend todo adds tests for its new paths BEFORE/with the implementation; existing 14 client tests + subscriber tests must stay green.
- **Backend lint:** `cd backend/apps/backend && npm run lint` (@medusajs/eslint-plugin recommended — never disable rules).
- **Build gates:** `cd backend && npm run build` (turbo); storefront `cd storefront && bun run build` + `bun run lint`.
- **Storefront tests:** `cd storefront && bun run test:run` (vitest) for new pure helpers (rate-hint parsing, cheapest/fastest computation, pending-state parsing).
- **Staging round-trip (T16, external-blocked):** executable checklist with exact expected outcomes per step; runs against staging when creds + address ids exist.
- **Evidence:** `.omo/evidence/ithink-dashboard-fulfillment/task-<N>-ithink-dashboard-fulfillment.txt` per todo (append that todo's QA scenario outputs). Committed with the todo's commit where the repo convention allows.

### Cross-cutting constraints (apply to ALL todos)
- **Auth envelope:** every iThink call wraps `{ data: { ...withAuth, ...payload } }` — access_token/secret_key in the body, NEVER headers (existing client pattern; unchanged).
- **Module self-containment:** the module directory must not read `process.env` (options only, passed from medusa-config) and must not import anything outside `src/modules/ithink/`. App-level code (subscriber, routes, config, jobs) MAY import from the module.
- **No schema changes:** all state lives in `fulfillment.data` and `fulfillment.metadata` JSON. No migrations, no db:generate.
- **No courier at checkout:** rate hints are informational; the customer never picks a courier (dashboard decides at Ship Now). Do not add courier selection to the cart/checkout.
- **Never trust dashboard state in Medusa:** AWB/status flow in ONE direction (iThink → reconciliation job → fulfillment.data/metadata). The job is the only writer of tracking state.
- **Idempotency:** `order_no` is the natural key. createFulfillment skips sync when `data.refnum` exists. Never re-sync an order that already has an AWB.
- **Backend code style:** no semicolons, double quotes, 2-space indent, kebab-case files, no emojis in code/comments/commit messages (repo AGENTS.md).
- **Package managers:** backend = npm (packageManager `npm@11.16.0`); storefront = bun. Never introduce a second lockfile.

## Execution waves + dependency matrix

> Waves 1-2 build the backend foundation in parallel. Wave 3 is backend consumers of that foundation. Wave 4 is storefront UI (depends only on the backend API shapes from Wave 3). Wave 5 converges on verification, staging, and deploy.

### Wave 1 (parallel) — Foundation
- **T1** Module options plumbing (`mode`, `return_address_id`, `order_no_prefix`, `poll_enabled`; remove `process.env` reads from module)
- **T2** Client: `syncOrders` (order/sync.json, chunk 25) + `getOrderDetails` (get_details.json, chunk 500)
- **T6** Self-containment audit (read-only grep + findings evidence)

### Wave 2 (parallel, after Wave 1) — Behavior
- **T3** Provider: dashboard-mode `createFulfillment` (sync, no logistics) + cancel guard (deps T1, T2)
- **T4** `validateFulfillmentData` rate/check persistence + pincode cache (deps T1, T2)
- **T5** Subscriber gating: no auto-submit in dashboard mode (dep T1)
- **T7** Fix audit findings from T6 (dep T6)

### Wave 3 (parallel, after Wave 2) — Backend consumers
- **T8** Reconciliation job rewrite (+ tracking.ts status mapping) (deps T3, T2)
- **T9** Track route pagination + pending state (dep T3)
- **T10** medusa-config env wiring + .env.example + DEPLOYMENT.md (deps T1, T7)
- **T11** Rates proxy route GET /store/ithink/rates (deps T2, T10)

### Wave 4 (parallel, after Wave 3) — Storefront
- **T12** Checkout rate hints UI (cheapest/fastest + ETA) (dep T11)
- **T13** Track-order + order-confirmation pending state (dep T9)
- **T14** README + LICENSE + migration notes (deps T3, T8, T9, T10)

### Wave 5 (after Wave 4) — Verify + ship
- **T15** Verification: all unit tests + lint + builds + evidence collection (deps all implementation todos)
- **T16** Staging round-trip QA (EXTERNAL-blocked: creds + address ids) (deps T3, T8, T9, T10)
- **T17** Deployment runbook execution (EXTERNAL: prod access + address ids) (dep T15, T16)

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | — | 3, 4, 5, 10 | 2, 6 |
| 2 | — | 3, 4, 8, 11 | 1, 6 |
| 3 | 1, 2 | 8, 9, 14, 16 | 4, 5, 7 |
| 4 | 1, 2 | 12 | 3, 5, 7 |
| 5 | 1 | — | 3, 4, 7 |
| 6 | — | 7 | 1, 2 |
| 7 | 6 | 10 | 3, 4, 5 |
| 8 | 3, 2 | 14, 15, 16 | 9, 10, 11 |
| 9 | 3 | 13, 14, 16 | 8, 10, 11 |
| 10 | 1, 7 | 11, 14, 16 | 8, 9 |
| 11 | 2, 10 | 12 | 8, 9 |
| 12 | 11 | 15 | 13, 14 |
| 13 | 9 | 15 | 12, 14 |
| 14 | 3, 8, 9, 10 | 15 | 12, 13 |
| 15 | 12, 13, 14 | 17 | 16 |
| 16 | 3, 8, 9, 10 (+ external creds) | 17 | 15 |
| 17 | 15, 16 (+ prod access) | — | — |

**Critical path:** T1/T2 → T3 → T8 → T15 → T17.
**Estimated speedup vs sequential:** ~45% (waves 2-4 each run 3-4 tasks in parallel).

## Todos

> Implementation + Tests = ONE todo. Never separate. Each todo: What to do / Must NOT do / Acceptance criteria / QA scenarios / Commit message / Delegation recommendation / Skills evaluation. Evidence per todo: `.omo/evidence/ithink-dashboard-fulfillment/task-<N>-ithink-dashboard-fulfillment.txt`.

### Wave 1 — Foundation (parallel: T1, T2, T6)

- [ ] 1. Module options plumbing: mode, return_address_id, order_no_prefix, poll_enabled; remove process.env reads from module
  **What to do:** In `backend/apps/backend/src/modules/ithink/`: (a) `clients/types.ts` — extend the provider options DTO with `mode?: "dashboard" | "book"` (default `"dashboard"`), `returnAddressId?: string`, `orderNoPrefix?: string` (default `""`), `pollEnabled?: boolean` (default `true`); keep existing `baseUrl`, `accessToken`, `secretKey`, `pickupAddressId`, `gstNumber`, `defaultWeightKg`; (b) `services/mappers.ts` — refactor all option/weight/carrier builders to accept options as a parameter instead of reading `process.env` (env parsing moves out of the module entirely; the provider service passes its initialized options through); (c) `services/ithink-fulfillment.ts` — store initialized options on the service and expose `getMode(): "dashboard" | "book"` and `getOptions()`; (d) update `index.ts` if it reads env. Update the existing unit tests for the new option plumbing. Write the failing test for `getMode()` default first (TDD).
  **Must NOT do:** Do NOT keep any `process.env` read inside `src/modules/ithink/`. Do NOT change the meaning of existing option keys consumed elsewhere (pickup_address_id, gst_number). Do NOT change book-mode behavior.
  **Acceptance criteria:** `grep -rn "process.env" src/modules/ithink/` returns 0 hits; `getMode()` returns `"dashboard"` when no mode passed and `"book"` when passed; `npm run test:unit` green (existing + new tests).
  **QA scenarios:** happy — construct provider with `{mode:"book"}` → `getMode()` "book"; with `{}` → "dashboard"; failure — pass `mode:"invalid"` → option resolver rejects with a typed `MedusaError` (implement rejection of invalid mode values). Evidence task-1.
  **Commit:** `feat(ithink): add dashboard/book mode and return address provider options`
  **Delegation:** Category: `unspecified-low` (multi-file but fully specified plumbing). Skills: [`programming`] — .ts edits + TDD tests.
  **Skills evaluation:** INCLUDED `programming` (.ts/.spec.ts files); OMITTED `refactor` (mechanical option threading, not restructuring), `ast-grep` (plain grep suffices).

- [ ] 2. Client: syncOrders (order/sync.json, chunk 25) + getOrderDetails (get_details.json, chunk 500)
  **What to do:** In `clients/types.ts`: add `SYNC_ORDER: "order/sync.json"` and `ORDER_DETAILS: "order/get_details.json"` to ENDPOINTS; add DTOs: `SyncOrderResponse { status: string; refnum: string; message?: string; errors?: unknown[] }`, `OrderDetails { order_no?: string; awb_no?: string; logistic?: string; latest_courier_status?: string; expected_delivery_date?: string }`, `GetDetailsResponse { orders?: OrderDetails[] }`. In `clients/payloads.ts`: add `buildSyncOrderBody(orderData, options)` — same item/address/pickup payload shape as `buildOrderBody` but WITHOUT the `logistics` field entirely (per verified API fact: sync.json has no logistics) — and `buildGetDetailsBody(orderNos: string[])` (`{ order_no_list?: string[], awb_number_list?: string[], ... }` — use `order_no_list` key per get_details docs; confirm exact key against existing client payload conventions and adapt the test). In `clients/ithink-client.ts`: add `syncOrders(orders, options)` chunking at 25/request and returning refnums; add `getOrderDetails(orderNos, options)` chunking at 500/request, normalizing to `OrderDetails[]` (tolerant of missing fields); both wrapped in the existing `withAuth` envelope + error normalization to `MedusaError INVALID_DATA`. TDD: write payload-shape and chunk-boundary tests first.
  **Must NOT do:** Do NOT add a `logistics` key to the sync payload. Do NOT exceed 25/500 chunk caps. Do NOT put auth in headers.
  **Acceptance criteria:** new unit tests green: sync payload JSON contains no `logistics` key; 26 orders → 2 requests (chunks 25+1); 500 orderNos → 1 request, 501 → 2; get_details response with missing fields normalizes without throwing; error envelope → MedusaError.
  **QA scenarios:** happy — mock fetch, assert request body `data` contains auth + payload and no logistics; failure — mock iThink error envelope, assert normalized MedusaError message. Evidence task-2.
  **Commit:** `feat(ithink): add order sync and get_details client methods with chunking`
  **Delegation:** Category: `deep` (client-layer API correctness with exact iThink envelope semantics). Skills: [`programming`] — .ts + jest TDD.
  **Skills evaluation:** INCLUDED `programming`; OMITTED `debugging` (mocked tests, no runtime), `ast-grep`.

- [ ] 6. Self-containment audit (read-only; evidence only)
  **What to do:** Grep `backend/apps/backend/src/modules/ithink/` for: (a) import statements resolving outside the module directory (relative `../` escaping `src/modules/ithink/` or app-level path aliases); (b) the string `yourdailydrip` or store-specific identifiers; (c) `process.env` reads (should be none after T1; report if T1 missed any); (d) hardcoded store values (pincodes, product ids, order ids). Record every finding with file:line into `.omo/evidence/ithink-dashboard-fulfillment/task-6-ithink-dashboard-fulfillment.txt` as a findings list. Do NOT fix anything — T7 fixes.
  **Must NOT do:** Do NOT modify any file. Do NOT include secrets in the evidence file.
  **Acceptance criteria:** findings list covers all four grep categories with file:line references; if zero findings, state so explicitly with the grep commands used.
  **QA scenarios:** run the exact greps recorded and confirm outputs match the findings list. Evidence task-6.
  **Commit:** `docs(ithink): module self-containment audit findings` (evidence only)
  **Delegation:** Category: `quick` (read-only scans). Skills: [`ast-grep`] — structural import checks.
  **Skills evaluation:** INCLUDED `ast-grep` (import-graph/structural matching); OMITTED `programming` (no code written), `refactor`.

### Wave 2 — Behavior (parallel: T3, T4, T5, T7)

- [ ] 3. Provider: dashboard-mode createFulfillment via order/sync.json + cancel guard
  **What to do:** In `services/ithink-fulfillment.ts`: (a) in `createFulfillment`, branch on `this.getMode()`: `"book"` → EXISTING `order/add.json` path untouched; `"dashboard"` → build sync payload via `buildSyncOrderBody` with `order_no = ${options.orderNoPrefix}${order.display_id ?? order.id}` (resolve order from `data.order` or `context.order`, falling back to the fulfillment's order when present), `pickup_address_id` and `return_address_id` from options (return address REQUIRED — do not send empty string), `payment_method: "prepaid"`, weight from items/options; call `client.syncOrders([payload])`; on success store fulfillment data `{ provider: "ithink", mode: "dashboard", refnum, order_no, synced_at }` — NO `awb`, `logistic`, `tracking_url` keys; return the data. (b) Idempotency: if `data.refnum` already present → log and return existing data without calling iThink. (c) `cancelFulfillment`: if `data.awb` absent (unbooked) → return `{ cancelled: false, reason: "cancel-in-dashboard" }` with a log; if `data.awb` present → existing cancel behavior (book mode). (d) Verify by code inspection that Medusa v2 admin "Create fulfillment" runs `createOrderFulfillmentWorkflow` → provider `createFulfillment` (framework behavior); record the finding (this is also sanity-check item 8). TDD: dashboard-path tests first.
  **Must NOT do:** Do NOT call `order/add.json` in dashboard mode. Do NOT send `return_address_id: ""`. Do NOT store awb/logistic keys on dashboard-synced fulfillments. Do NOT change book-mode create/cancel paths or their tests.
  **Acceptance criteria:** dashboard createFulfillment calls `syncOrders` exactly once with an order_no of `prefix + display_id`; never calls addOrder; returned data has refnum + order_no and no awb; second call with same refnum → zero API calls; cancelFulfillment without awb → no API call, returns reason string; all existing 14 client tests + provider tests green.
  **QA scenarios:** happy — mocked client: assert syncOrders body has no logistics and correct order_no; failure — syncOrders rejects → createFulfillment throws MedusaError INVALID_DATA with the normalized message (assert). Evidence task-3.
  **Commit:** `feat(ithink): dashboard-mode createFulfillment via order sync`
  **Delegation:** Category: `deep` (core behavior change with exact iThink semantics). Skills: [`programming`] — .ts + TDD.
  **Skills evaluation:** INCLUDED `programming`; OMITTED `debugging` (no runtime), `refactor`.

- [ ] 4. Checkout ETA persistence: rate/check at validateFulfillmentData + pincode cache
  **What to do:** In `services/ithink-fulfillment.ts`: in dashboard mode only, `validateFulfillmentData(data, context)`: extract pincode from `context.cart?.shipping_address?.postal_code ?? data.shipping_address?.postal_code`; if absent → return data unchanged. If present → `client.checkRate(pincode)` behind an in-memory cache: `Map<pincode, { response, fetchedAt }>` with 30-minute TTL and max 1000 entries (evict oldest on overflow). On success, merge into the returned data: `{ delivery_tat: min(delivery_tat across couriers), expected_delivery_date, cheapest_logistic, cheapest_rate, fastest_logistic, fastest_rate }` (min computed over returned couriers). On any iThink error → log + return data unchanged (NEVER fail checkout). These fields flow into the shipping method data → `fulfillment.data` (verify this flow in code during implementation and assert it in the test). TDD: cache-hit and failure-path tests first.
  **Must NOT do:** Do NOT block checkout when rate/check fails. Do NOT store the full rates blob (only the 6 scalar fields). Do NOT call rate/check when no pincode is present. Do NOT change book-mode validation.
  **Acceptance criteria:** two validateFulfillmentData calls with the same pincode within TTL → exactly 1 client.checkRate call; no pincode → 0 calls; rate/check throws → returned data is identical to input (no throw); returned data contains the 6 scalar fields with min-rate/min-TAT values.
  **QA scenarios:** happy — mocked client returns 2 couriers (A ₹40/tat 3, B ₹55/tat 1) → cheapest_logistic A, fastest_logistic B, delivery_tat 1; failure — client rejects → data unchanged, no exception. Evidence task-4.
  **Commit:** `feat(ithink): persist rate and ETA in checkout validation data`
  **Delegation:** Category: `deep` (cache semantics + Medusa data-flow verification). Skills: [`programming`].
  **Skills evaluation:** INCLUDED `programming`; OMITTED `debugging` (mocked), `frontend` (backend only).

- [ ] 5. Subscriber gating: no auto-submit in dashboard mode
  **What to do:** In `backend/apps/backend/src/subscribers/order-placed.ts`: before running `createOrderFulfillmentWorkflow`, resolve the ithink fulfillment provider service from the container (key `ff_ithink`; verify the exact registration key in `src/modules/ithink/index.ts` during implementation — use `container.resolve("ff_ithink")` with a documented fallback to the module's provider key) and call `getMode()`. If `"dashboard"` → log `info` "auto-submit disabled in dashboard mode; create fulfillment in admin to sync" and return WITHOUT running the workflow. If `"book"` or resolution fails → existing behavior unchanged. Keep the existing guards (payment captured, no existing fulfillment, has items). TDD: unit test with a mocked container — dashboard mode skips workflow; book mode runs it.
  **Must NOT do:** Do NOT delete the book-mode auto-submit path. Do NOT gate on `process.env` (mode comes from the provider options only). Do NOT hide errors when the provider cannot be resolved (log warn and fall through to existing behavior).
  **Acceptance criteria:** dashboard-mode subscriber test asserts workflow NOT executed + log emitted; book-mode test asserts workflow executed; existing subscriber tests green.
  **QA scenarios:** happy — mock getMode()="dashboard" → workflow mock not called; failure — getMode() throws → subscriber falls back to existing behavior and logs warning (assert no crash). Evidence task-5.
  **Commit:** `feat(ithink): gate auto-submit subscriber on provider mode`
  **Delegation:** Category: `quick` (single-file gating change). Skills: [`programming`].
  **Skills evaluation:** INCLUDED `programming`; OMITTED `debugging`, `refactor`.

- [ ] 7. Fix audit findings from T6
  **What to do:** Fix every finding recorded in task-6 evidence: replace outside-module imports with module-local equivalents or options-passed dependencies; remove yourdailydrip/store-specific strings (make generic); remove any remaining `process.env` reads (should be none post-T1); remove/replace hardcoded store values with options. Re-run the T6 greps and record clean results in the task-7 evidence file.
  **Must NOT do:** Do NOT change behavior while fixing — no functional rewrites, only coupling removal. Do NOT rename module ids/identifiers ("ithink" stays).
  **Acceptance criteria:** all T6 greps return clean (0 hits for each category); `npm run test:unit` green; `cd backend/apps/backend && npm run lint` green.
  **QA scenarios:** re-run each T6 grep and assert 0 hits; run lint + unit tests. Evidence task-7.
  **Commit:** `refactor(ithink): remove non-module coupling from audit findings`
  **Delegation:** Category: `quick` (mechanical fixes). Skills: [`programming`, `ast-grep`].
  **Skills evaluation:** INCLUDED `programming` (edits) + `ast-grep` (re-verification greps); OMITTED `refactor` (mechanical, not structural).

### Wave 3 — Backend consumers (parallel: T8, T9, T10, T11)

- [ ] 8. Rewrite reconciliation job: AWB discovery + enrichment + status propagation + error isolation
  **What to do:** Rewrite `backend/apps/backend/src/jobs/ithink-tracking.ts` (keep cron */30 * * * *): (a) If `options.pollEnabled === false` → log + return. (b) Paginate `listFulfillments` (take 20, offset loop — no cap) and select fulfillments where `data.provider === "ithink"` OR `typeof data.awb === "string"` (covers legacy book-mode fulfillments). (c) Path A — no `data.awb`: collect `data.order_no` values, call `client.getOrderDetails` (chunks of 500), map `order_no → OrderDetails`; for each match with `awb_no` → `updateFulfillment(id, { data: { ...existing, awb, logistic, latest_courier_status, expected_delivery_date } })`; no match → leave pending, count + log. (d) Path B — has `data.awb`: call `client.getAwbsInWindow(window)` (existing delta-poll; keep 30-min window math, format `yyyy-mm-dd H:i:s`), match returned AWBs against our fulfillment awbs, then `client.trackShipments` (chunks of 10) for matches; normalize via `services/tracking.ts`; write snapshot to `metadata.ithink_tracking = { awb_no, logistic, latest_courier_status, expected_delivery_date, tracked_at }`. (e) Status propagation: first time a non-pending status appears (Manifested/Picked Up/In Transit/Out For Delivery/Delivered) and `shipped_at` unset → `updateFulfillment(id, { shipped_at: new Date() })`; status `DL` (Delivered) and `delivered_at` unset → `delivered_at: new Date()`; CN/Lost/Shortage/RTO* → snapshot + log only (no timestamps). Idempotent: never overwrite set timestamps. (f) Error isolation: try/catch around EVERY listFulfillments page, every getOrderDetails chunk, every trackShipments chunk, and every per-fulfillment update; collect `{ failed, total }` and log a summary; NEVER throw out of the run. (g) Emit `FulfillmentEvents.FULFILLMENT_UPDATED` with the fulfillment id (no subscriber exists — log the emission). Extend `services/tracking.ts` with explicit terminal helpers (`isDelivered`, `isTerminal`) used by the job. TDD: mocked-client tests for every path first.
  **Must NOT do:** Do NOT skip terminal statuses entirely (snapshot them; only timestamps are write-once). Do NOT let one failed chunk abort the run. Do NOT call get_details for fulfillments that already have an AWB. Do NOT write `delivered_at` for non-DL statuses.
  **Acceptance criteria:** unit tests green for: AWB discovery via get_details (found + not-found), get_awb enrichment, shipped_at set once, delivered_at set once on DL, failed chunk does not abort siblings, provider filter selects dashboard + legacy book-mode fulfillments, pollEnabled=false no-ops.
  **QA scenarios:** happy — mocked sequence: no-awb fulfillment → get_details returns awb → data updated; delivered fulfillment → delivered_at set; failure — first trackShipments chunk rejects → remaining chunks still processed, run completes, summary log mentions failure count. Evidence task-8.
  **Commit:** `feat(ithink): rewrite reconciliation job with error isolation and status propagation`
  **Delegation:** Category: `ultrabrain` (highest-complexity logic: two reconciliation paths, idempotent timestamps, error isolation). Skills: [`programming`].
  **Skills evaluation:** INCLUDED `programming` (TDD .ts); OMITTED `debugging` (all mocked — no runtime), `refactor` (rewrite, not refactor of existing shape).

- [ ] 9. Track route: pagination + pending state + order_no lookup
  **What to do:** Rewrite `backend/apps/backend/src/api/store/ithink/track/route.ts` GET handler: (a) paginate `listFulfillments` (take 20, offset loop) until exhausted — REMOVE the take:100 cap; (b) support `?awb=` (match `data.awb`) AND `?order_no=` (match `data.order_no`); (c) response: snapshot present → existing payload shape unchanged (200); fulfillment exists but no `data.awb` → 200 `{ state: "pending", refnum, order_no, provider: "ithink", message: "Order synced with logistics provider. Tracking AWB will appear once the courier dispatches it." }`; no fulfillment found → 404 (unchanged). TDD: pagination + pending-shape tests first.
  **Must NOT do:** Do NOT 404 for synced-but-unbooked fulfillments. Do NOT change the existing snapshot response shape (storefront compat). Do NOT add auth to this store route.
  **Acceptance criteria:** test with 120 fulfillments (mocked) finds the target awb beyond page 1; order_no lookup returns pending shape; unknown awb → 404; snapshot shape byte-compatible with current storefront consumer.
  **QA scenarios:** happy — mock 120 fulfillments, awb at offset 105 → found; pending fulfillment → 200 pending shape; failure — no match → 404 (existing UI handles). Evidence task-9.
  **Commit:** `fix(ithink): paginate track route and return pending state`
  **Delegation:** Category: `quick` (route rework, fully specified). Skills: [`programming`].
  **Skills evaluation:** INCLUDED `programming`; OMITTED `frontend` (backend route), `debugging`.

- [ ] 10. medusa-config env wiring + env docs
  **What to do:** In `backend/apps/backend/medusa-config.ts`: pass new provider options from env — `mode: process.env.ITHINK_MODE ?? "dashboard"`, `return_address_id: process.env.ITHINK_RETURN_ADDRESS_ID` (required in dashboard mode — log a boot-time warning if missing), `order_no_prefix: process.env.ITHINK_ORDER_NO_PREFIX ?? ""`, `poll_enabled: process.env.ITHINK_POLL_ENABLED !== "false"`; keep existing ITHINK_BASE_URL/ACCESS_TOKEN/SECRET_KEY/PICKUP_ADDRESS_ID/GST_NUMBER/DEFAULT_WEIGHT_KG. Update `backend/.env.example` (add the 4 new vars with comments; mark return address id REQUIRED for dashboard mode), `backend/docker-compose.prod.yml` env list, and `backend/DEPLOYMENT.md` (new env matrix row + note that db:migrate is NOT required — metadata only). Also document the optional `ITHINK_TRACK_BASE_URL` override (sanity-check item 2 mitigation).
  **Must NOT do:** Do NOT commit real secret values. Do NOT change existing var names that other config consumes.
  **Acceptance criteria:** config file parses (boot check or config-import test); .env.example lists the new vars; DEPLOYMENT.md updated; `npm run build` green.
  **QA scenarios:** happy — assert defaults: no ITHINK_MODE → "dashboard"; ITHINK_POLL_ENABLED="false" → poll_enabled false; failure — missing ITHINK_RETURN_ADDRESS_ID → boot warning logged (assert in test if feasible, else document). Evidence task-10.
  **Commit:** `chore(ithink): wire dashboard-mode env options and docs`
  **Delegation:** Category: `quick` (config + docs). Skills: [`programming`].
  **Skills evaluation:** INCLUDED `programming` (config .ts); OMITTED `writing` (env docs are part of config task), `frontend`.

- [ ] 11. Rates proxy route: GET /store/ithink/rates?pincode=
  **What to do:** Create `backend/apps/backend/src/api/store/ithink/rates/route.ts` exporting GET: resolve the ithink provider service, call `client.checkRate(pincode)`; compute `cheapest` = min by `rate`, `fastest` = min by `delivery_tat` over ALL returned couriers; respond `{ cheapest: { logistic, rate, delivery_tat }, fastest: { logistic, rate, delivery_tat }, expected_delivery_date, currency: "INR", from_pincode, to_pincode }`. Server-side in-memory cache per pincode (TTL 15 min, max 1000 entries, evict oldest) to absorb repeated address edits. On iThink error → 502 `{ error: "rate_unavailable" }`. No secrets in the response. TDD: min-rate/min-TAT computation tests first.
  **Must NOT do:** Do NOT expose access_token/secret_key. Do NOT return the full raw iThink response (normalized shape only). Do NOT require auth (store route — rates are per-pincode public data).
  **Acceptance criteria:** unit tests: 3 couriers (rates 40/55/70, TATs 3/1/2) → cheapest = 40, fastest = TAT 1; cache hit → single client call for two requests; error → 502 payload.
  **QA scenarios:** happy — mocked checkRate returns couriers, assert normalized response; failure — client rejects → 502 with error payload. Evidence task-11.
  **Commit:** `feat(ithink): add store rates endpoint with cheapest/fastest computation`
  **Delegation:** Category: `quick` (single route + computation). Skills: [`programming`].
  **Skills evaluation:** INCLUDED `programming`; OMITTED `frontend` (backend route), `debugging`.

### Wave 4 — Storefront + docs (parallel: T12, T13, T14)

- [ ] 12. Checkout rate hints: cheapest/fastest + ETA display
  **What to do:** (a) `storefront/src/lib/medusa-checkout.ts`: add `fetchShippingRateHints(pincode)` → `sdk.client.fetch("/store/ithink/rates?pincode=" + encodeURIComponent(pincode))`, returning the normalized hints or `null` on 502/error; extend `shippingOptionDetail` to read `delivery_tat`/`expected_delivery_date` from the SELECTED shipping method's data (`cart.shipping_methods[0].data`) with fallback to option data (fixes the never-populated gap). (b) `storefront/src/routes/checkout.tsx` shipping step: when the address pincode is present, fetch hints and render a non-blocking info card (existing card/typography components) — "Cheapest: {logistic} ₹{rate} (est. {expected_delivery_date}) · Fastest: {logistic} ₹{rate}"; loading state → subtle skeleton; error → render nothing (checkout must never block). Keep the existing Standard/Express shipping option list as the selection mechanism (courier choice remains a dashboard decision — hints are informational). TDD: vitest for the parsing/fallback helpers (msw or plain mocks).
  **Must NOT do:** Do NOT add courier selection to the cart. Do NOT alter option list, pricing, or selection semantics. Do NOT block checkout on hint failure. Do NOT introduce new design-system tokens/styles.
  **Acceptance criteria:** `cd storefront && bun run test:run` green (new helper tests); `bun run build` green; manual: pincode entered → hints card renders; endpoint down → card absent, checkout proceeds.
  **QA scenarios:** happy — vitest: fetchShippingRateHints maps 502 → null; shippingOptionDetail reads method data delivery_tat; failure — pincode with no rates → null, no crash. Evidence task-12.
  **Commit:** `feat(storefront): show cheapest and fastest courier hints at checkout`
  **Delegation:** Category: `visual-engineering` (storefront UI + data layer). Skills: [`frontend`, `programming`].
  **Skills evaluation:** INCLUDED `frontend` (UI work) + `programming` (.ts/.tsx + vitest TDD); OMITTED `visual-qa` (component reuse, no visual redesign — covered by manual QA), `debugging`.

- [ ] 13. Track-order + order-confirmation pending dispatch state
  **What to do:** (a) `storefront/src/lib/medusa-tracking.ts`: parse the new pending shape → `{ state: "pending", refnum, order_no }`; 404 → `null` (unchanged); snapshot → existing shape (unchanged). (b) `storefront/src/routes/track-order.tsx`: add the pending view (5th state) — neutral notice "Order synced with logistics provider. Tracking AWB will appear once the courier dispatches it." + reference number; existing pending/error/not-found/snapshot states untouched. (c) `storefront/src/lib/medusa-orders.ts`: `orderAwb()` → also expose fulfillment `refnum` + a `pending` flag (read `fulfillment.data.refnum` when no awb). (d) `storefront/src/routes/order-confirmation.tsx`: awb present → track link (unchanged); fulfillment exists with refnum but no awb → show the pending notice instead of the track link; no fulfillment → nothing (unchanged). TDD: vitest for the parsing helpers.
  **Must NOT do:** Do NOT regress the existing snapshot timeline rendering. Do NOT change the 404 → "not found" flow. Do NOT redesign — reuse existing notice/card components.
  **Acceptance criteria:** `bun run test:run` + `bun run build` green; manual: pending order → track page shows pending notice + refnum; delivered order → timeline unchanged.
  **QA scenarios:** happy — vitest: pending payload → state "pending" with refnum; failure — malformed payload → treated as not-found (null), no crash. Evidence task-13.
  **Commit:** `feat(storefront): pending dispatch state in track and order confirmation`
  **Delegation:** Category: `visual-engineering` (storefront UI). Skills: [`frontend`, `programming`].
  **Skills evaluation:** INCLUDED `frontend` + `programming` (TSX + vitest); OMITTED `visual-qa` (component reuse, manual QA), `debugging`.

- [ ] 14. Open-source README + LICENSE + migration notes
  **What to do:** Rewrite `backend/apps/backend/src/modules/ithink/README.md` to be the standalone module doc: overview + dashboard vs book mode explanation (with a flow diagram in ASCII), install into ANY Medusa v2 project (register provider in medusa-config fulfillment module, options table — every key, type, default, required, example), endpoints used table (sync/add/get_details/get_awb/track/rate/pincode/cancel/label with caps), dashboard handoff flow (Store Order tab → Ship Now → AWB → reconciliation), the required gated auto-submit subscriber snippet (from T5) for dashboard-mode installs, polling job config (cron, poll_enabled, single-replica note), troubleshooting (auth envelope, address ids, pincode serviceability), sandbox/staging testing (pre-alpha URL), migration notes for users of the current integration (env changes: ITHINK_MODE, ITHINK_RETURN_ADDRESS_ID, ITHINK_ORDER_NO_PREFIX, ITHINK_POLL_ENABLED; behavior changes: no auto-booking, AWB learned via reconciliation; no schema changes). Add `LICENSE` (MIT, default per sanity-check item 6) + a LICENSE section in the README.
  **Must NOT do:** Do NOT reference yourdailydrip store specifics as requirements (generic Medusa instructions only; migration section may mention the store by name as the origin of the current integration). Do NOT invent API facts beyond the verified list.
  **Acceptance criteria:** README contains all listed sections; options table has every provider option with default/required markers; `grep -c yourdailydrip` in README ≤ 1 (migration section only); LICENSE file exists.
  **QA scenarios:** read-through check — an executor without repo context can install the module from the README alone (verify by following the quick-install section steps against the repo structure). Evidence task-14.
  **Commit:** `docs(ithink): open-source README, LICENSE, and migration guide`
  **Delegation:** Category: `writing` (documentation deliverable). Skills: [] (no specialized skill needed — plain docs authoring).
  **Skills evaluation:** OMITTED `programming` (no code), `remove-ai-slops` (docs, not code); INCLUDED none.

### Wave 5 — Verify + ship (T15 parallel with T16 if creds exist; T17 last)

- [ ] 15. Verification: full test suites + lint + builds + evidence collection
  **What to do:** Run and capture: (a) `cd backend/apps/backend && npm run test:unit` — full output; (b) `cd backend/apps/backend && npm run lint`; (c) `cd backend && npm run build` (turbo, both apps — storefront may be included or skipped per turbo config); (d) `cd storefront && bun run test:run`; (e) `cd storefront && bun run build`. Save all outputs to `.omo/evidence/ithink-dashboard-fulfillment/task-15-ithink-dashboard-fulfillment.txt` (with command + exit codes). Re-run the T6 greps and append results (module clean). Fix nothing here — if anything fails, report the failing todo back.
  **Must NOT do:** Do NOT modify code in this todo. Do NOT truncate failure output — capture full logs for diagnosis.
  **Acceptance criteria:** all five commands exit 0; evidence file contains command, exit code, and (for tests) pass/fail summary lines.
  **QA scenarios:** happy — 0 failures across all suites; failure — report exact failing test names + stack to the responsible todo for a fix-and-rerun. Evidence task-15.
  **Commit:** `test(ithink): unit, lint, and build verification evidence` (evidence only)
  **Delegation:** Category: `unspecified-low` (run suites + collect). Skills: [].
  **Skills evaluation:** OMITTED `programming` (no code), `debugging` (failures are reported back, not debugged here); INCLUDED none.

- [ ] 16. Staging round-trip QA (EXTERNAL-BLOCKED: staging creds + pickup/return address ids)
  **What to do:** When staging creds + address ids exist (user supplies ITHINK_BASE_URL=pre-alpha, access_token, secret_key, pickup_address_id, return_address_id), execute this checklist against the deployed dev/staging backend, recording exact outcomes per step in `.omo/evidence/ithink-dashboard-fulfillment/task-16-ithink-dashboard-fulfillment.txt`: (1) complete a paid order locally → admin "Create fulfillment" → assert iThink Store Order tab shows the order UNBOOKED with no AWB (refnum matches); (2) run the reconciliation job manually (dev trigger or wait for cron) → assert no AWB yet, fulfillment remains pending; (3) in the iThink dashboard: Ship Now → courier → AWB generated; (4) run reconciliation → assert fulfillment.data.awb + logistic populated; (5) `GET /store/ithink/track?order_no=...` → pending state BEFORE booking (step 2), snapshot AFTER (step 4); (6) mark Delivered in dashboard → next reconciliation writes delivered_at; (7) cancel-before-pickup in dashboard → assert no API cancel attempted (job/fulfillment unchanged); (8) 26-order batch sync (chunking) if feasible. Every step: expected outcome + actual + evidence (screenshot/log).
  **Must NOT do:** Do NOT run against production iThink. Do NOT skip steps — each has an assertion. Do NOT mark the plan complete until ALL steps pass.
  **Acceptance criteria:** all checklist steps pass with recorded evidence; any failure is reported with the failing step + iThink response for diagnosis.
  **QA scenarios:** the checklist IS the QA — exact expected outcomes per step as listed. Evidence task-16.
  **Commit:** `test(ithink): staging round-trip evidence` (evidence only, when executed)
  **Delegation:** Category: `unspecified-low` (checklist execution against live staging). Skills: [`debugging`] — runtime verification/interpretation of live API responses.
  **Skills evaluation:** INCLUDED `debugging` (live-system verification, interpreting unexpected responses); OMITTED `programming` (no code), `playwright` (dashboard is iThink's own UI — manual/log evidence).

- [ ] 17. Deployment runbook execution (EXTERNAL: prod access + address ids)
  **What to do:** (a) On the VPS: add to `backend/.env` (prod): `ITHINK_MODE=dashboard`, `ITHINK_RETURN_ADDRESS_ID=<user-provided>`, `ITHINK_ORDER_NO_PREFIX=YDD-` (or user choice), `ITHINK_POLL_ENABLED=true`; (b) `cd backend && docker compose -f docker-compose.prod.yml up -d --build`; (c) verify: boot logs show the ithink provider loaded with dashboard mode, no auth errors, reconciliation job cron line appears (allow up to ~35 min or trigger manually); (d) no `db:migrate` needed — confirm zero schema changes (metadata only) and note it in the log; (e) storefront: `cd storefront && bun run deploy:workers` (with VITE_* build env set per README); (f) record commands + outputs + post-deploy spot checks in `.omo/evidence/ithink-dashboard-fulfillment/task-17-ithink-dashboard-fulfillment.txt`.
  **Must NOT do:** Do NOT deploy before T15 green and T16 passed (or explicitly waived by the user with a recorded reason). Do NOT commit prod .env. Do NOT run db:migrate unless a schema change is detected (then stop and report).
  **Acceptance criteria:** container healthy (`docker compose ps` + `/health` 200); storefront live; evidence log documents env additions (names only, no secret values), deploy output, and post-deploy checks.
  **QA scenarios:** happy — a real admin-created fulfillment appears in the prod iThink dashboard unbooked; failure — roll back = revert env (ITHINK_MODE=book or restore previous .env) + redeploy, documented in evidence. Evidence task-17.
  **Commit:** none (ops task; if compose/.env.example changed in T10 already, nothing new to commit)
  **Delegation:** Category: `unspecified-low` (runbook execution). Skills: [].
  **Skills evaluation:** OMITTED `programming`, `debugging` (deploy verification via logs/health, not debugging); INCLUDED none.

## Final verification wave

> Runs in parallel after ALL todos (T15 covers the automated gates; F1-F4 are the qualitative close). ALL must pass. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — every todo's acceptance criteria met; evidence files exist for tasks 1-15 (16-17 when executed).
- [ ] F2. Code quality review — module self-containment re-verified; no slop (dead code, commented-out blocks, duplicated helpers).
- [ ] F3. Real manual QA — one end-to-end order through dashboard mode on staging (or prod after T17): admin create fulfillment → iThink dashboard unbooked → Ship Now → AWB → reconciliation → storefront track page.
- [ ] F4. Scope fidelity — guardrails respected: no COD, no returns-via-API, no webhooks, no new tables, book mode intact, storefront design system untouched.

## Commit strategy

> One atomic commit per todo, in dependency order, branch `feat/ithink-dashboard`. Conventional Commits; backend scope `ithink`, storefront scope `storefront`, docs scope `docs`. The branch must build and pass its tests at every commit. Never rewrite published history (no force-push/rebase/amend of pushed commits — repo AGENTS.md).

- 1: `feat(ithink): add dashboard/book mode and return address provider options`
- 2: `feat(ithink): add order sync and get_details client methods with chunking`
- 3: `feat(ithink): dashboard-mode createFulfillment via order sync`
- 4: `feat(ithink): persist rate and ETA in checkout validation data`
- 5: `feat(ithink): gate auto-submit subscriber on provider mode`
- 6: `docs(ithink): module self-containment audit findings` (evidence only)
- 7: `refactor(ithink): remove non-module coupling from audit findings`
- 8: `feat(ithink): rewrite reconciliation job with error isolation and status propagation`
- 9: `fix(ithink): paginate track route and return pending state`
- 10: `chore(ithink): wire dashboard-mode env options and docs`
- 11: `feat(ithink): add store rates endpoint with cheapest/fastest computation`
- 12: `feat(storefront): show cheapest and fastest courier hints at checkout`
- 13: `feat(storefront): pending dispatch state in track and order confirmation`
- 14: `docs(ithink): open-source README, LICENSE, and migration guide`
- 15: `test(ithink): unit, lint, and build verification evidence` (evidence only)
- 16: `test(ithink): staging round-trip evidence` (evidence only, when executed)
- 17: none (ops task — no code changes)

## Success criteria

> Top-level outcomes the whole plan must deliver. Each proven by the owning todos' acceptance criteria + QA scenarios (agent-executed; evidence in .omo/evidence/ithink-dashboard-fulfillment/).

1. **Dashboard-driven logistics** — admin "Create fulfillment" in Medusa pushes the order to the iThink Store Order tab UNBOOKED (no AWB); no auto-booking on payment in dashboard mode. (todos 3, 5)
2. **AWB + status learned automatically** — after ops books in the dashboard, the reconciliation job discovers the AWB via get_details, enriches status via get_awb/track, and writes shipped_at/delivered_at; one failing chunk never aborts a run. (todo 8)
3. **Storefront tracking handles both states** — track-order and order-confirmation render the pending dispatch state for synced-unbooked orders and the live timeline for booked orders, with pagination past 100 fulfillments fixed. (todos 9, 13)
4. **Checkout ETA without courier lock-in** — one rate/check call shows cheapest/fastest + expected delivery date at checkout; delivery_tat/expected_delivery_date persisted into shipping method data; checkout never blocks on iThink failures. (todos 4, 11, 12)
5. **Book mode intact** — all existing book-mode behavior and its test suite unchanged and green (backward compatibility for other Medusa users). (todos 1-5 regression gates)
6. **Open-source ready** — module has zero process.env reads, zero outside-module imports, zero store-specific references; standalone README + MIT LICENSE + migration notes; unit tests covering all new dashboard-mode paths. (todos 1, 6, 7, 14)
7. **Scale-safe** — chunking at documented caps (25/500/10/100), idempotent sync (refnum guard), 20K-order/month capacity analysis documented in the README. (todos 2, 3, 8, 14)
8. **Deployed** — backend live with dashboard-mode env (ITHINK_MODE, ITHINK_RETURN_ADDRESS_ID, ITHINK_ORDER_NO_PREFIX, ITHINK_POLL_ENABLED); storefront deployed; no schema changes / no db:migrate. (todos 10, 17)

## TODO List (ADD THESE)

> CALLER: Add these TODOs using TodoWrite/TaskCreate and execute by wave.

### Wave 1 (Start Immediately - No Dependencies)

- [ ] **1. Module options plumbing (mode/return_address_id/order_no_prefix/poll_enabled; kill process.env in module)**
  - What: Extend options DTO in clients/types.ts, refactor services/mappers.ts to take options (no env), expose getMode()/getOptions() on provider service; TDD getMode default "dashboard".
  - Depends: None | Blocks: 3, 4, 5, 10
  - Category: `unspecified-low` | Skills: [`programming`]
  - QA: `grep -rn "process.env" src/modules/ithink/` = 0; `cd backend/apps/backend && npm run test:unit` green

- [ ] **2. Client: syncOrders (chunk 25) + getOrderDetails (chunk 500)**
  - What: ENDPOINTS + DTOs in types.ts; buildSyncOrderBody (NO logistics key) + buildGetDetailsBody in payloads.ts; client methods with chunking + withAuth envelope; TDD payload/chunk tests.
  - Depends: None | Blocks: 3, 4, 8, 11
  - Category: `deep` | Skills: [`programming`]
  - QA: jest tests green (no-logistics assertion, 26→2 chunks, 501→2 chunks)

- [ ] **6. Self-containment audit (read-only)**
  - What: Grep module for outside imports, "yourdailydrip" strings, process.env, hardcoded store values; findings list → evidence file. Fix nothing.
  - Depends: None | Blocks: 7
  - Category: `quick` | Skills: [`ast-grep`]
  - QA: evidence file lists findings with file:line (or explicit zero findings + greps used)

### Wave 2 (After Wave 1)

- [ ] **3. Provider: dashboard createFulfillment (sync.json) + cancel guard**
  - What: Branch on getMode(); dashboard → buildSyncOrderBody with order_no = prefix+display_id, return_address_id from options; syncOrders; store {provider,mode,refnum,order_no}; refnum idempotency guard; cancelFulfillment no-op (reason string) when no awb; verify admin fulfillment → createOrderFulfillmentWorkflow → createFulfillment path in code.
  - Depends: 1, 2 | Blocks: 8, 9, 14, 16
  - Category: `deep` | Skills: [`programming`]
  - QA: jest — dashboard path never calls addOrder, returns no awb; double-call → zero API calls; cancel without awb → no API call

- [ ] **4. validateFulfillmentData rate/check + pincode cache (ETA persistence)**
  - What: Dashboard mode: pincode from cart/context; checkRate with in-memory cache (30min TTL, 1000 cap); merge 6 scalar fields (delivery_tat min, expected_delivery_date, cheapest/fastest logistic+rate); never fail checkout on error.
  - Depends: 1, 2 | Blocks: 12
  - Category: `deep` | Skills: [`programming`]
  - QA: jest — 2 validates same pincode = 1 client call; no pincode = 0 calls; error → data unchanged, no throw

- [ ] **5. Subscriber gating (no auto-submit in dashboard mode)**
  - What: order-placed.ts resolves provider service (ff_ithink), getMode()==="dashboard" → log + skip workflow; book mode unchanged.
  - Depends: 1 | Blocks: —
  - Category: `quick` | Skills: [`programming`]
  - QA: jest — dashboard skips workflow; book runs it; resolution failure falls back safely

- [ ] **7. Fix audit findings (T6)**
  - What: Remove outside-module imports, store-specific strings, remaining env reads per findings; re-run greps clean; no behavior change.
  - Depends: 6 | Blocks: 10
  - Category: `quick` | Skills: [`programming`, `ast-grep`]
  - QA: all T6 greps = 0 hits; lint + test:unit green

### Wave 3 (After Wave 2)

- [ ] **8. Reconciliation job rewrite (AWB discovery + enrichment + timestamps + error isolation)**
  - What: Paginate fulfillments (no cap); no-awb → getOrderDetails(chunk 500) → write awb/logistic/status; with-awb → getAwbsInWindow + trackShipments(chunk 10) → snapshot metadata.ithink_tracking; shipped_at once on first active status, delivered_at once on DL; CN/Lost/Shortage/RTO → snapshot+log; try/catch every page/chunk/update, summary log, never throw; emit FULFILLMENT_UPDATED + log; pollEnabled=false no-op; extend tracking.ts terminal helpers.
  - Depends: 3, 2 | Blocks: 14, 15, 16
  - Category: `ultrabrain` | Skills: [`programming`]
  - QA: jest — discovery found/not-found, shipped_at set once, delivered_at set once, failed chunk doesn't abort siblings

- [ ] **9. Track route: pagination + pending state + order_no lookup**
  - What: Loop listFulfillments (no take:100); ?awb= and ?order_no=; pending → 200 {state:"pending", refnum, order_no, message}; no match → 404; snapshot shape unchanged.
  - Depends: 3 | Blocks: 13, 14, 16
  - Category: `quick` | Skills: [`programming`]
  - QA: jest — 120 fulfillments, target beyond page 1 found; pending shape; 404 unchanged

- [ ] **10. medusa-config env wiring + docs**
  - What: ITHINK_MODE (default dashboard), ITHINK_RETURN_ADDRESS_ID (boot warning if missing), ITHINK_ORDER_NO_PREFIX, ITHINK_POLL_ENABLED (!== "false"), ITHINK_TRACK_BASE_URL override note; .env.example + docker-compose.prod.yml + DEPLOYMENT.md.
  - Depends: 1, 7 | Blocks: 11, 14, 16
  - Category: `quick` | Skills: [`programming`]
  - QA: build green; defaults verified (no mode → dashboard; POLL_ENABLED=false → false)

- [ ] **11. Rates route GET /store/ithink/rates?pincode=**
  - What: checkRate → compute cheapest (min rate) + fastest (min TAT) + expected_delivery_date; in-memory cache 15min/1000; 502 {error:"rate_unavailable"} on iThink failure.
  - Depends: 2, 10 | Blocks: 12
  - Category: `quick` | Skills: [`programming`]
  - QA: jest — min computations correct; cache hit = 1 call; error → 502 payload

### Wave 4 (After Wave 3)

- [ ] **12. Checkout rate hints UI (cheapest/fastest + ETA)**
  - What: medusa-checkout.ts fetchShippingRateHints + shippingOptionDetail reads method data delivery_tat/expected_delivery_date; checkout.tsx non-blocking hints card on pincode; hide on error; option list unchanged.
  - Depends: 11 | Blocks: 15
  - Category: `visual-engineering` | Skills: [`frontend`, `programming`]
  - QA: vitest helpers green; build green; manual — hints render with pincode, absent when endpoint down

- [ ] **13. Track/order-confirmation pending state**
  - What: medusa-tracking.ts parses pending shape; track-order.tsx pending view (5th state); medusa-orders.ts exposes refnum/pending; order-confirmation shows notice instead of track link when pending.
  - Depends: 9 | Blocks: 15
  - Category: `visual-engineering` | Skills: [`frontend`, `programming`]
  - QA: vitest + build green; manual — pending order shows notice, delivered shows timeline

- [ ] **14. README + LICENSE + migration notes**
  - What: Standalone module README (install, options table, mode explanation, endpoints+caps, dashboard flow, subscriber snippet, polling config, troubleshooting, staging, migration notes); LICENSE (MIT); README yourdailydrip references ≤ 1 (migration section only).
  - Depends: 3, 8, 9, 10 | Blocks: 15
  - Category: `writing` | Skills: []
  - QA: read-through — README install steps executable without repo context; LICENSE exists

### Wave 5 (After Wave 4)

- [ ] **15. Verification + evidence (unit/lint/builds)**
  - What: test:unit, medusa lint, turbo build, storefront vitest, storefront build — all outputs + exit codes to evidence; re-run T6 greps. Fix nothing — report failures.
  - Depends: 12, 13, 14 | Blocks: 17
  - Category: `unspecified-low` | Skills: []
  - QA: all 5 commands exit 0; evidence file complete

- [ ] **16. Staging round-trip QA (EXTERNAL: creds + address ids)**
  - What: 8-step checklist — create fulfillment → Store Order unbooked → Ship Now → AWB → reconciliation populates → track pending→snapshot → delivered_at → cancel-before-pickup no API call → 26-order chunking. Evidence per step.
  - Depends: 3, 8, 9, 10 (+ external creds) | Blocks: 17
  - Category: `unspecified-low` | Skills: [`debugging`]
  - QA: all checklist steps pass with recorded evidence

- [ ] **17. Deployment (EXTERNAL: prod access + address ids)**
  - What: VPS .env additions (names only in evidence), docker compose up -d --build, boot/job log verification, no db:migrate, wrangler deploy storefront, post-deploy spot checks.
  - Depends: 15, 16 | Blocks: —
  - Category: `unspecified-low` | Skills: []
  - QA: /health 200, provider loads dashboard mode, cron line appears, storefront live

## Execution Instructions

1. **Wave 1**: Fire T1, T2, T6 IN PARALLEL.
2. **Wave 2**: After Wave 1, fire T3, T4, T5, T7 IN PARALLEL.
3. **Wave 3**: Fire T8, T9, T10, T11 IN PARALLEL.
4. **Wave 4**: Fire T12, T13, T14 IN PARALLEL.
5. **Wave 5**: T15; T16 only when external creds/ids supplied; T17 after T15 (+ T16 unless explicitly waived).
6. **Final QA**: F1-F4; surface results; wait for user's explicit okay before declaring complete.
