# iThink Logistics fulfillment provider for Medusa v2

A standalone Medusa v2 fulfillment provider (`@medusajs/fulfillment` module
provider, static identifier `ithink`) for Indian domestic shipments through
the iThink Logistics V3 API. COD and international shipping are out of scope:
`payment_method` is always `Prepaid`.

## Modes: dashboard vs book

The `mode` provider option selects how the provider treats a fulfillment:

- `dashboard` (default): Medusa never books a shipment. Creating a
  fulfillment in the Medusa admin syncs the order into the iThink Store Order
  tab, unbooked, with no AWB. Your ops team does everything in the iThink
  dashboard: courier selection (Ship Now), AWB generation, dispatch, NDR,
  reattempts, address correction, RTO, cancellation. Medusa learns the AWB and
  tracking status afterwards through a polling job, so the storefront
  tracking page and order status keep working. iThink has no public
  webhooks, so polling is the official reconciliation pattern.
- `book`: legacy behavior. `createFulfillment` books the shipment
  immediately through `order/add.json` and captures the returned AWB in the
  fulfillment data and labels.

```
Medusa admin (create fulfillment)
        |
        |  order/sync.json (no logistics, no waybill)
        v
iThink dashboard (Store Order tab: order listed, unbooked)
        |
        |  Ship Now: courier chosen, AWB generated, dispatch
        |
        |  (Medusa polls every 30 minutes)
        v
Medusa backend (reconciliation job)
        |
        |  get_details by order_no -> learns AWB + carrier + status
        |  get_awb window + track.json -> snapshots + timestamps
        v
fulfillment.data / metadata updated; storefront tracking stays current
```

## Install into a Medusa v2 project

Prerequisites: Medusa v2 (Node 20+; the client uses global `fetch` and
`AbortController` with a 15 second request timeout).

1. Copy this directory into your project as `src/modules/ithink/`. The module
   is self-contained: it reads no `process.env` values and imports nothing
   from outside the directory. All configuration comes from the provider
   options you pass in `medusa-config.ts`.
2. Register the provider in the fulfillment module of `medusa-config.ts`:

```ts
modules: [
  {
    resolve: "@medusajs/medusa/fulfillment",
    options: {
      providers: [
        {
          resolve: "./src/modules/ithink",
          id: "ithink",
          options: {
            base_url: process.env.ITHINK_BASE_URL,
            access_token: process.env.ITHINK_ACCESS_TOKEN,
            secret_key: process.env.ITHINK_SECRET_KEY,
            pickup_address_id: process.env.ITHINK_PICKUP_ADDRESS_ID,
            gst_number: process.env.ITHINK_GST_NUMBER,
            mode: process.env.ITHINK_MODE ?? "dashboard",
            return_address_id: process.env.ITHINK_RETURN_ADDRESS_ID,
            order_no_prefix: process.env.ITHINK_ORDER_NO_PREFIX ?? "",
            poll_enabled: process.env.ITHINK_POLL_ENABLED !== "false",
          },
        },
      ],
    },
  },
]
```

3. Copy the app-level files that the module needs:

   - `src/subscribers/order-placed.ts`: the gated auto-submit subscriber
     (required in dashboard mode; see below).
   - `src/jobs/ithink-tracking.ts`: the reconciliation poll that learns AWBs
     and tracking status (required for dashboard mode).
   - `src/api/store/ithink/track/route.ts`: optional storefront tracking
     endpoint. `GET /store/ithink/track?awb=...` or `?order_no=...` returns
     the latest polled snapshot, or a `pending` state for synced-but-unbooked
     fulfillments. Credentials never reach the storefront.

4. Restart the backend, create a fulfillment for an order in the admin
   (Order > Create fulfillment), and check the iThink Store Order tab. The
   order appears there unbooked.

### Provider options

| Key | Type | Default | Required | Example |
| --- | --- | --- | --- | --- |
| `base_url` | string | (none) | yes | `"https://my.ithinklogistics.com/api_v3"` |
| `access_token` | string | (none) | yes | `"your-access-token"` |
| `secret_key` | string | (none) | yes | `"your-secret-key"` |
| `pickup_address_id` | string | (none) | yes | `"12345"` |
| `return_address_id` | string | (none) | dashboard mode only | `"67890"` |
| `mode` | `"dashboard"` \| `"book"` | `"dashboard"` | no | `"dashboard"` |
| `order_no_prefix` | string | `""` | no | `"YDD-"` |
| `poll_enabled` | boolean | `true` | no | `true` |
| `gst_number` | string | (none) | no | `"GSTIN12345"` |
| `reseller_name` | string | `""` | yes | `"Daily Drip"` |
| `default_weight_kg` | number | `0.5` | no | `0.5` |
| `default_length_cm` | number | `20` | no | `20` |
| `default_width_cm` | number | `15` | no | `15` |
| `default_height_cm` | number | `10` | no | `10` |

Notes:

- `base_url` must include the `/api_v3` segment.
- `reseller_name` is required by iThink on every shipment (order/sync.json and
  order/add.json reject the payload when the field is absent); the field is
  always sent, defaulting to an empty string when the option is unset.
- `return_address_id` is required in dashboard mode: `createFulfillment`
  throws without it, so never configure it as an empty string.
- `default_weight_kg` and the dimension defaults are used when the cart
  variant declares no weight or dimensions.
- `poll_enabled: false` disables the reconciliation job (multi-replica
  setups must run it on exactly one replica; see below).

## iThink API endpoints used

Every call is `POST` with the payload wrapped as `{ data: { ...fields,
access_token, secret_key } }`. Credentials live in the body JSON, never in
headers.

| Endpoint | Used by | Request cap | Notes |
| --- | --- | --- | --- |
| `order/sync.json` | `createFulfillment` (dashboard mode) | 25 shipments/request | Syncs an order into the Store Order tab without booking: no `logistics` field, no waybill. Returns `status` + `refnum`. |
| `order/add.json` | `createFulfillment` (book mode) | 10 shipments/request | Books immediately. Returns the AWB (`waybill`), `refnum`, `logistic_name`, `tracking_url`. |
| `order/get_details.json` | reconciliation job (AWB discovery) | 500 lookups/request | Lookup by comma-separated `order_no` (the API also accepts `awb_number_list`). Returns `awb_no`, `logistic`, `latest_courier_status`, `expected_delivery_date`. |
| `order/get_awb.json` | reconciliation job (delta poll) | rolling 30-minute window | Returns AWBs with activity in the window (`Awb list`). Datetimes use `yyyy-mm-dd H:i:s`. |
| `order/track.json` | reconciliation job (enrichment) | 10 AWBs/request | AWB-only lookup; scan timeline, current status, expected delivery date. |
| `rate/check.json` | `calculatePrice`, rates route | no documented cap | Returns ALL couriers: per-courier `rate`, `delivery_tat`, `zone`, plus a top-level `expected_delivery_date`. |
| `pincode/check.json` | `validateFulfillmentData` | no documented cap | Per-courier serviceability for a pincode; `"no"` means unserviceable. |
| `order/cancel.json` | `cancelFulfillment` | 100 AWBs/request | Only called when the fulfillment has a stored AWB; unbooked shipments are cancelled in the dashboard. |
| `shipping/label.json` | `getFulfillmentDocuments` | 100 AWBs/request | Returns the label file (`file_name`); `page_size: "A4"`. |

iThink documents no rate limits; chunking above is per documented request
caps. iThink has no public webhooks.

## Dashboard handoff flow

1. Admin creates a fulfillment. In dashboard mode this calls
   `order/sync.json` (idempotent: a fulfillment that already carries a
   `refnum` is never re-synced). The response `refnum` and the generated
   `order_no` (default `${order_no_prefix}${display_id}`) are stored in
   `fulfillment.data`.
2. The order appears in the iThink Store Order tab, unbooked, no AWB.
3. Ops selects the courier in the dashboard (Ship Now). iThink generates the
   AWB and dispatches. All downstream logistics (NDR, reattempt, address
   correction, RTO, cancel) happens in the dashboard, never through this
   module.
4. The reconciliation job (every 30 minutes) discovers the AWB via
   `order/get_details.json` by `order_no`, then keeps the tracking snapshot
   current via `order/get_awb.json` + `order/track.json`. It writes
   `shipped_at` / `delivered_at` once and emits `FULFILLMENT_UPDATED` on
   changes. Tracking state flows one way: iThink to Medusa. The job is the
   only writer.

## Order-placed subscriber (gated auto-submit)

In book mode, a subscriber on `order.placed` auto-books the shipment by
running `createOrderFulfillmentWorkflow`. In dashboard mode that would book
shipments the dashboard should own, so the subscriber resolves the provider
mode and skips the workflow. Install this file as `src/subscribers/order-placed.ts`:

```ts
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Query } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import type { createOrderFulfillmentWorkflow } from "@medusajs/core-flows"

// Fulfillment providers register in the container as fp_<identifier>_<id>;
// "fp_ithink" is a fallback for installs that omit the provider id.
const ITHINK_PROVIDER_KEYS = ["fp_ithink_ithink", "fp_ithink"] as const

function resolveIthinkMode(
  container: { resolve: (key: string) => unknown },
  logger: Logger
): "dashboard" | "book" | undefined {
  for (const key of ITHINK_PROVIDER_KEYS) {
    try {
      const provider = container.resolve(key) as
        | { getMode?: () => "dashboard" | "book" }
        | undefined
      if (provider?.getMode) {
        return provider.getMode()
      }
    } catch {
      // fall through to the next candidate key
    }
  }
  logger.warn(
    `iThink fulfillment provider not resolvable via ${ITHINK_PROVIDER_KEYS.join(", ")}; keeping auto-submit`
  )
  return undefined
}

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>("logger")
  const query = container.resolve<Query>("query")
  const workflow = container.resolve<typeof createOrderFulfillmentWorkflow>(
    "createOrderFulfillmentWorkflow"
  )

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["payment_collections.status", "fulfillments.id", "items.id", "items.quantity"],
    filters: { id: data.id },
  })
  const order = orders[0] as
    | { payment_collections?: { status: string }[]; fulfillments?: { id: string }[]; items?: { id: string; quantity: number }[] }
    | undefined
  if (!order) return
  if (!(order.payment_collections ?? []).some((collection) => collection.status === "captured")) {
    return
  }
  if (order.fulfillments && order.fulfillments.length > 0) {
    return
  }
  if (!order.items || order.items.length === 0) {
    return
  }

  const mode = resolveIthinkMode(container, logger)
  if (mode === "dashboard") {
    logger.info("auto-submit disabled in dashboard mode; create fulfillment in admin to sync")
    return
  }

  await workflow(container).run({
    input: {
      order_id: data.id,
      items: order.items.map((item) => ({ id: item.id, quantity: item.quantity })),
    },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

Guards, in order: the order must exist, the payment collection must be
`captured` (prepaid only), the order must have no existing fulfillment
(idempotency), and it must have items. Skipped orders are logged with
`Skipping iThink registration for order ...`. Orders that predate the
subscriber, or any skipped order, can be registered manually via
Order > Create fulfillment in the admin.

## Reconciliation polling job

Install as `src/jobs/ithink-tracking.ts`:

```ts
export const config = {
  name: "ithink-tracking-poll",
  schedule: "*/30 * * * *",
}
```

The job reconciles every ithink fulfillment with the dashboard on the cron:

- No-AWB fulfillments (dashboard mode, synced but unbooked) are looked up by
  `order_no` via `order/get_details.json` (chunked at 500) so Medusa learns
  the AWB, carrier, and status once ops books the order.
- AWB fulfillments are delta-polled via `order/get_awb.json` with a rolling
  30-minute window and enriched via `order/track.json` (chunks of 10).
- `shipped_at` / `delivered_at` are written once. Terminal statuses
  (DL/CN/Lost/Shortage/RTO) stop active polling and never write timestamps.
- Every page, client call, and per-fulfillment update is isolated: one
  failure cannot abort the run.

The iThink `get_awb` endpoint only accepts a rolling 30-minute window, so the
schedule must not poll faster than that: `*/30 * * * *` gives each run a
non-overlapping window of its own. The job assumes a single scheduler
replica; multiple replicas poll redundantly (writes stay idempotent), but a
multi-replica setup should set `poll_enabled: false` on all but one replica.

## Troubleshooting

- Auth envelope: `access_token` and `secret_key` go inside the body JSON
  under the `data` key, never in headers. A 401-ish failure usually means
  the credentials are in the wrong place or the wrong `base_url` is set.
- Address ids: `pickup_address_id` and `return_address_id` must be created
  in the iThink dashboard and passed as provider options. Dashboard mode
  throws on `createFulfillment` when `return_address_id` is missing. Never
  send an empty string for either.
- Pincode serviceability: `pincode/check.json` answers `"no"` for
  unserviceable pincodes; `validateFulfillmentData` then throws a readable
  error so no shipping option is created. `rate/check.json` can also report
  per-carrier `Pincode Not Serviceable.` remarks.
- Empty result sets: `order/get_details.json` and `order/get_awb.json`
  report "No Data found." as a failed envelope; the client treats that as an
  empty result, not an error.
- Booking failures surface readable messages, including
  `Insufficient wallet balance.` (recharge the iThink wallet and retry) and
  per-carrier pincode remarks.
- Non-JSON responses, HTTP failures, and `status != success` all raise
  readable `MedusaError`s.
- An order appears in the Store Order tab but Ship Now fails: check the
  address ids and wallet balance before contacting iThink support.

## Sandbox / staging testing

- Staging base URL: `https://pre-alpha.ithinklogistics.com/api_v3`
- Production base URL: `https://my.ithinklogistics.com/api_v3`

Credentials and address ids come from the iThink team; warehouse approval
(~24h) is needed before live rate/shipment testing. Note: iThink docs list
the production `order/track.json` host inconsistently
(`api.ithinklogistics.com` vs `my.ithinklogistics.com`). If tracking fails
after a production cutover, set the documented override
(`ITHINK_TRACK_BASE_URL` in `.env.example`) to the working host.

## Migration notes (users of the current integration)

This integration originated in the yourdailydrip store integration; upgrade
path for existing installs:

Environment changes:

| Variable | Status | Notes |
| --- | --- | --- |
| `ITHINK_MODE` | new | `"dashboard"` (default) or `"book"`. |
| `ITHINK_RESELLER_NAME` | new | Store name sent as the shipment `reseller_name` field. iThink rejects requests without it - set it to the store name on your iThink account (e.g. `"Daily Drip"`). |
| `ITHINK_RETURN_ADDRESS_ID` | new | Required in dashboard mode; the old integration sent an empty string, which dashboard mode rejects. |
| `ITHINK_ORDER_NO_PREFIX` | new | Optional prefix for the `order_no` sent to iThink (default empty). |
| `ITHINK_POLL_ENABLED` | new | `"false"` disables the reconciliation job; default `true`. |
| `ITHINK_TRACK_BASE_URL` | new | Optional override for the `order/track.json` base URL (see staging section). |
| `ITHINK_BASE_URL`, `ITHINK_ACCESS_TOKEN`, `ITHINK_SECRET_KEY`, `ITHINK_PICKUP_ADDRESS_ID`, `ITHINK_GST_NUMBER` | unchanged | Same meaning as before. |

Behavior changes:

- No auto-booking: in dashboard mode (the default), `order.placed` no longer
  books the shipment. Create a fulfillment in the admin to sync the order;
  everything after that happens in the iThink dashboard.
- AWB learned via reconciliation: the polling job discovers the AWB from
  `order/get_details.json` after ops books the order, instead of capturing
  it synchronously at booking time. Existing book-mode fulfillments (those
  with a stored `data.awb`) continue to be reconciled.
- Unbooked shipments are managed in the dashboard: `cancelFulfillment` and
  label downloads return early for fulfillments without an AWB.
- Dashboard-mode fulfillments now carry `refnum`, `order_no`, and `mode` in
  `fulfillment.data`.

No schema changes: all state lives in `fulfillment.data` and
`fulfillment.metadata` JSON, so no migrations are required.

## License

MIT. See the [LICENSE](./LICENSE) file in this directory.
