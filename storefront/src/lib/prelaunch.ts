/**
 * Pre-launch campaign constants for the Advanced Hair Density Serum landing page.
 *
 * Configurable: update PRELAUNCH_ENDS_AT to extend or end the pre-launch sale
 * window. The countdown on the announcement bar derives from this single value.
 */

/** Local timezone-aware target (IST). Change here to reschedule the campaign. */
export const PRELAUNCH_ENDS_AT = new Date("2026-08-24T23:59:59+05:30");

/** Launch offer price (INR). */
export const PRICE = 559;

/** Striking price the offer is compared against (INR). */
export const MRP = 699;

/** Product slug — must match the catalog entry in src/lib/products.ts. */
export const PRODUCT_SLUG = "advanced-hair-density-serum";
