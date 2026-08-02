# Razorpay webhook notes patch (todo 9)

## What

A local patch to the installed `medusa-plugin-razorpay-v2@0.1.4` provider. It adds
`notes` (with `session_id` and `medusa_payment_session_id`) to the Razorpay order
**creation** payload inside `initiatePayment`.

## Why

Razorpay copies order notes into the payment entity's notes at payment creation
time. The provider's webhook handler (`getWebhookActionAndData`) reads
`paymentData.notes.session_id` to map `payment.captured` / `payment.authorized` /
`payment.failed` events back to a Medusa payment session. Medusa's webhook
subscriber (`@medusajs/medusa/dist/subscribers/payment-webhook.js`) **drops any
event without a `session_id`**:

```js
if (!processedEvent.data?.session_id) {
  return
}
```

Without the patch, the order is created with no notes, so the payment entity has
no `session_id`, every webhook event is silently dropped, and payment/order
status never updates. This is SGFGOV issue #11
(https://github.com/SGFGOV/medusa-payment-plugins). `medusa_payment_session_id`
is the key `getPaymentSessionAndOrderFromInput` uses to resolve the session from
Razorpay order data.

## How to reapply

The patch lives in `node_modules`, so `npm install` / `npm ci` wipes it. Reapply
after any install of this package:

### 1. Edit the installed file

File: `backend/node_modules/medusa-plugin-razorpay-v2/.medusa/server/src/providers/payment-razorpay/src/core/razorpay-base.js`

In `async initiatePayment(input)`, after the line

```js
const razorpayOrderCreateRequest = this.getRazorpayOrderCreateRequestBody(toPay, currency_code)
```

and before `const razorpayOrder = await this.razorpay_.orders.create(razorpayOrderCreateRequest);`,
insert:

```js
if (paymentSessionId) {
  razorpayOrderCreateRequest.notes = {
    session_id: paymentSessionId,
    medusa_payment_session_id: paymentSessionId
  }
}
```

(`paymentSessionId` is already bound at the top of `initiatePayment` as
`input.context?.idempotency_key`.)

### 2. Verify the patch

```bash
rg -n "session_id" backend/node_modules/medusa-plugin-razorpay-v2/.medusa/server/src/providers/payment-razorpay/src/core/razorpay-base.js
```

Expect the two `session_id` references inside the `initiatePayment` notes block
(and the existing `medusa_payment_session_id` reads in
`getPaymentSessionAndOrderFromInput` / `getWebhookActionAndData`).

### 3. Optional: automate

If `patch-package` is ever added, the patch can be exported with
`npx patch-package medusa-plugin-razorpay-v2` and restored via a `postinstall`
hook. Not wired up in todo 9 (kept as a documented manual reapply).

## Security notes (from the todo 9 review of this provider)

- Signature verification: present. `getWebhookActionAndData` validates
  `x-razorpay-signature` against `webhook_secret` via
  `razorpay.validateWebhookSignature(rawData, signature, secret)` and returns
  `PaymentActions.FAILED` on missing/invalid signature. Medusa's webhook
  subscriber ignores `FAILED` actions, so no state change occurs. (HTTP is
  always 200 - Medusa processes webhooks asynchronously and validates in the
  subscriber.)
- Duplicate events: no event-id dedup, but `processPaymentWorkflow` locks the
  cart and guards on existing order/payment records, so duplicate
  `payment.captured` deliveries cannot create a second order, a second payment
  record, or a double capture.
- Amount/currency validation: NOT present. The handler passes the event amount
  (paise converted to INR) without comparing it to the payment session's expected
  amount. Recorded as an explicit issue - do not enable the provider without
  real credentials and sandbox webhook testing.
