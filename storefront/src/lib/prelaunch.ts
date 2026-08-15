/**
 * Pre-launch campaign constant for the landing page countdown.
 *
 * Configurable: update PRELAUNCH_ENDS_AT to extend or end the pre-launch sale
 * window. The countdown on the announcement bar derives from this single value.
 * Product content (name/price/slug/images) is NOT here anymore - the landing
 * sections read the live catalog via `useMappedFeaturedProducts`.
 */

/** Local timezone-aware target (IST). Change here to reschedule the campaign. */
export const PRELAUNCH_ENDS_AT = new Date("2026-08-24T23:59:59+05:30");
