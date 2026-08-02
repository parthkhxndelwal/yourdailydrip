# Razorpay module-container resolution patch (todo: medusa 2.18 upgrade)

## What

A local patch to the installed `medusa-plugin-razorpay-v2@0.1.4` provider. It fixes
the provider constructor's DI lookup so payment sessions can be created.

## Why

The provider's `RazorpayBase` constructor resolves the payment module service as
`container[Modules.PAYMENT]` (`container["payment"]`). Medusa 2.18.0 constructs
payment providers with the payment **module's internal container** (modules-sdk
`loadInternalModule`'s `localContainer`), where the module service is registered
under `paymentModuleService` (derived from the `PaymentModuleService` class name by
`moduleContainerLoaderFactory`). The key `"payment"` only exists in the main app
container. The lookup therefore throws at the first request that constructs the
provider:

```
AwilixResolutionError: Could not resolve 'payment'.
Resolution path: pp_razorpay_razorpay -> payment
```

This surfaces as a 500 on
`POST /store/payment-collections/{id}/payment-sessions`.

The plugin's peer dependencies pin Medusa `2.12.3`; the backend runs `2.18.0`
(`@medusajs/medusa@2.18.0`). The fix is compatible with any Medusa v2.x because
the module-container key (`paymentModuleService`) is generated the same way across
v2.

## How to reapply

The patch lives in `node_modules`, so `npm install` / `npm ci` wipes it. Reapply
after any install of this package:

### 1. Edit the installed file

File: `backend/node_modules/medusa-plugin-razorpay-v2/.medusa/server/src/providers/payment-razorpay/src/core/razorpay-base.js`

In the `RazorpayBase` constructor, replace

```js
this.paymentService = container[utils_1.Modules.PAYMENT];
```

with

```js
// Module container key; Modules.PAYMENT ("payment") only exists in the app container.
this.paymentService = container["paymentModuleService"];
```

### 2. Verify the patch

```bash
rg -n "paymentModuleService" backend/node_modules/medusa-plugin-razorpay-v2/.medusa/server/src/providers/payment-razorpay/src/core/razorpay-base.js
```

Expect the `paymentModuleService` reference in the constructor (and no remaining
`container\[utils_1.Modules.PAYMENT\]`).

### 3. Restart the backend

`medusa develop` does not watch `node_modules`; restart the server so the patched
file is loaded (same as the webhook-notes patch).

### 4. Optional: automate

If `patch-package` is ever added, export both this patch and the webhook-notes
patch with `npx patch-package medusa-plugin-razorpay-v2` and restore them via a
`postinstall` hook (see `razorpay-webhook-notes.md`).

## Scope notes

- The provider's remaining container usage is safe on 2.18.0: `LOGGER` and
  `paymentModuleService` are registered in the module container, and the customer
  metadata workflow resolves `Modules.CUSTOMER` from the workflow (app) container.
- The official `@medusajs/payment-stripe@2.18.0` provider avoids resolving the
  module service from the provider container entirely; consider replacing this
  community plugin with an official or in-repo provider if more drift appears.
