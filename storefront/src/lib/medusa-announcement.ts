// Medusa-backed announcement bar data layer for the storefront.
//
// The top strip's text + countdown target are configured in the admin and
// served by GET /store/announcement (200 { text, ends_at }, nulls when
// unconfigured). The storefront only ever reads the route through the shared
// SDK client (never raw fetch) and never writes it back.
//
// TanStack Query owns the server state, keyed by ["announcement"]. The query
// is enabled only in the browser (no fetch during SSR), so server markup and
// the first client render both show the static defaults — no hydration
// mismatch — and the bar updates after the fetch resolves. Any failure —
// 502, network, malformed payload, unconfigured nulls — falls back to the
// pre-launch defaults, so the strip never goes blank.

import { useQuery } from "@tanstack/react-query";

import { sdk } from "./medusa";
import { PRELAUNCH_ENDS_AT } from "./prelaunch";

// Mirror of the 200 shape of GET /store/announcement. `text` and `ends_at`
// are null when the announcement is unconfigured.
export type AnnouncementPayload = {
  text: string | null;
  ends_at: string | null;
};

export type Announcement = {
  text: string;
  endsAt: Date;
};

/** Static pre-launch text, shown whenever the backend is unavailable. */
export const DEFAULT_ANNOUNCEMENT_TEXT = "Pre-Launch Sale — Flat 20% Off";

/**
 * Normalize the /store/announcement response. Returns null for anything
 * unusable — non-object payload, missing/empty/non-string text, or an invalid
 * ends_at — so the caller falls back to the static defaults.
 */
export function parseAnnouncementPayload(data: unknown): Announcement | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.text !== "string" || record.text.length === 0) return null;
  const endsAt = parseEndsAt(record.ends_at);
  if (endsAt === null) return null;
  return { text: record.text, endsAt };
}

function parseEndsAt(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const announcementKeys = {
  all: ["announcement"] as const,
} as const;

/**
 * Announcement bar content merged with the static pre-launch defaults: always
 * returns `{ text, endsAt }` — the configured values when the route answers
 * 200 with a valid payload, the defaults otherwise. Never throws. Fetches
 * only in the browser so SSR renders the defaults and the bar updates
 * client-side once the fetch resolves.
 */
export function useAnnouncement(): Announcement {
  const { data } = useQuery<Announcement | null, Error>({
    queryKey: announcementKeys.all,
    queryFn: async () => {
      try {
        const payload = await sdk.client.fetch<unknown>("/store/announcement");
        return parseAnnouncementPayload(payload);
      } catch {
        return null;
      }
    },
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return data ?? { text: DEFAULT_ANNOUNCEMENT_TEXT, endsAt: PRELAUNCH_ENDS_AT };
}
