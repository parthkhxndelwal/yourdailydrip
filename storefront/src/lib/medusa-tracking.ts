// Medusa-backed tracking data layer for the storefront.
//
// Tracking data is produced server-side: the `ithink-tracking-poll` job polls
// iThink on a 30-minute window and persists a normalized snapshot on each
// fulfillment's metadata; `GET /store/ithink/track?awb=...` returns that
// snapshot. The storefront only ever calls the Medusa route through the shared
// SDK client (never raw fetch), so iThink credentials stay on the backend.
//
// TanStack Query owns server state: useQuery for the snapshot lookup, keyed by
// the AWB. A 404 (unknown AWB or not-yet-polled shipment) surfaces as a
// friendly message in the UI instead of an unhandled error.

import { useQuery } from "@tanstack/react-query";

import { sdk } from "./medusa";

// Mirror of the backend's `NormalizedTrackShipment` (src/modules/ithink/
// services/tracking.ts). Keep in sync with that shape.
export type TrackScan = {
  status: string;
  statusCode: string;
  location: string;
  remark: string;
  at: string;
};

export type TrackShipment = {
  awb: string;
  status: string;
  statusCode: string;
  expectedDeliveryDate?: string;
  promiseDeliveryDate?: string;
  terminal: boolean;
  scans: TrackScan[];
};

export const trackingKeys = {
  all: ["medusa", "tracking"] as const,
  detail: (awb: string) => ["medusa", "tracking", awb] as const,
} as const;

/**
 * Look up the latest tracking snapshot for a shipment by its AWB (waybill).
 * Disabled while the input is blank; a 404 from the route means "no shipment
 * or no snapshot yet" and is surfaced as a null result for the caller to
 * render as a friendly message.
 */
export function useTrackShipment(awb: string) {
  const normalized = awb.trim();
  return useQuery<TrackShipment | null, Error>({
    queryKey: trackingKeys.detail(normalized),
    queryFn: async () => {
      try {
        return await sdk.client.fetch<TrackShipment>("/store/ithink/track", {
          query: { awb: normalized },
        });
      } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
    },
    enabled: normalized.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status === 404;
}
