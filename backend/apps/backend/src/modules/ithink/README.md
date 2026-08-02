# iThink fulfillment provider

Custom Medusa v2 fulfillment provider (`@medusajs/fulfillment` module provider) that
ships orders through the iThink Logistics V3 API.

## Files

- `clients/types.ts` - shared request/response types and endpoint paths.
- `clients/ithink-client.ts` - `IthinkClient` HTTP client plus pure payload builders
  (`buildRateBody`, `buildOrderBody`, `withAuth`, `toOrderDate`, `toNumber`).
- `services/ithink-fulfillment.ts` - `IthinkFulfillmentService` provider
  (`static identifier = "ithink"`).
- `services/mappers.ts` - Medusa DTO to iThink payload mapping helpers.
- `index.ts` - module provider registration (`ModuleProvider(Modules.FULFILLMENT)`).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ITHINK_BASE_URL` | API base, must include the `/api_v3` segment, e.g. `https://pre-alpha.ithinklogistics.com/api_v3` for staging. |
| `ITHINK_ACCESS_TOKEN` | iThink access token. Sent inside the request body JSON (never a header). |
| `ITHINK_SECRET_KEY` | iThink secret key. Sent inside the request body JSON (never a header). |
| `ITHINK_PICKUP_ADDRESS_ID` | Pickup address registered in the iThink dashboard. |

Optional provider options (not env-backed): `default_weight_kg` (0.5), `default_length_cm`
(20), `default_width_cm` (15), `default_height_cm` (10) - used when the cart variant has no
weight/dimensions.

## Provider method to endpoint map

| Provider method | iThink endpoint | Notes |
| --- | --- | --- |
| `getFulfillmentOptions` | (static) | Returns the carrier list (delhivery, xpressbees, bluedart, ecom, ekart) with `logistic_name` stored in the option data. The plan text maps this method to `rate/check.json`, but the method has no pincode context, so the rate call happens in `calculatePrice` (this also satisfies the plan's Must-NOT: options are never priced before the address pincode is set). |
| `calculatePrice` | POST `rate/check.json` | Body: `from_pincode` (stock location postal code), `to_pincode`, `shipping_weight_kg`, `payment_method: "prepaid"`, `product_mrp` (cart item total). Filtered by `logistic_name`; no match = readable error = option hidden. |
| `validateFulfillmentData` | POST `pincode/check.json` | Unserviceable pincode throws a readable MedusaError, so no shipping option is created. Stores `to_pincode`, `weight_kg`, `shipment_*_cm` in the shipping method data. |
| `createFulfillment` | POST `order/add.json` | Recipient from the shipping address, products from fulfillment items (price joined from the order line item), pickup from options. AWB captured from the response and stored in fulfillment data + labels. |
| `cancelFulfillment` | POST `order/cancel.json` | `awb_numbers` from the fulfillment's stored AWB. |
| `getFulfillmentDocuments` | POST `shipping/label.json` | Returns the `file_name` URL. The framework never invokes this method (opaque interface), so the type is our own. |

Auth is injected by `withAuth` into the request body JSON for every call:
`access_token` and `secret_key` are never sent as headers.

## Boundaries

- COD is out of scope: `payment_method` is always `prepaid`.
- International shipping is out of scope.
- `return_address_id` is sent empty (returns MVP is out of scope).
- Amounts are passed as-is (INR 749 = 749); no multiplication or division.
- Live rate/label/cancel QA is deferred until real staging credentials are configured
  (see evidence for todo 11). The client surfaces readable errors for HTTP failures,
  non-JSON responses, `status != success`, and unserviceable pincodes.
- `getFulfillmentOptions` is static; the plan's `rate/check.json` mapping is implemented
  in `calculatePrice` (see table above).

## Order registration

A subscriber (`src/subscribers/order-placed.ts`) listens to `order.placed` and runs
`createOrderFulfillmentWorkflow`, which invokes this provider's `createFulfillment`
(POST `order/add.json`) automatically. Guards:

- The order's payment collection must be `captured` (prepaid only).
- Orders that already have a fulfillment are skipped (idempotency).
- Orders without items are skipped.

Skipped orders are logged with `Skipping iThink registration for order ...`.

To register an order that predates the subscriber (or any skipped order), create a
fulfillment for it in the admin (Order > Create fulfillment) - the same workflow runs.

## Region / shipping option setup (admin)

1. Enable the India region; set the fulfillment set's stock location address postal code
   (this becomes `from_pincode`).
2. Create a calculated shipping option per carrier option the store wants to offer
   (delhivery, xpressbees, bluedart, ecom, ekart), provider `ithink`.
3. Rates are fetched live at checkout from `rate/check.json`.
