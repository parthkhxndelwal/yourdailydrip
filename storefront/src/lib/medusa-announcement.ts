// Medusa-backed announcement bar data layer for the storefront.
//
// The top strip's text, countdown target, countdown toggle, and optional link
// are configured in the admin and served by GET /store/announcement (200
// { text, ends_at, show_countdown, link }, nulls when unconfigured). The
// storefront only ever reads the route through the shared SDK client (never
// raw fetch) and never writes it back.
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
// are null when the announcement is unconfigured; `show_countdown` controls
// whether the countdown pill renders; `link` is present only when the admin
// enabled a link with both fields.
export type AnnouncementPayload = {
  text: string | null;
  ends_at: string | null;
  show_countdown: boolean;
  link: { label: string; url: string } | null;
};

export type Announcement = {
  text: string;
  endsAt: Date | null;
  showCountdown: boolean;
  link: { label: string; url: string } | null;
};

/** Static pre-launch text, shown whenever the backend is unavailable. */
export const DEFAULT_ANNOUNCEMENT_TEXT = "Pre-Launch Sale — Flat 20% Off";

/**
 * Normalize the /store/announcement response. Returns null for anything
 * unusable — non-object payload or missing/empty/non-string text — so the
 * caller falls back to the static defaults. An invalid or missing ends_at
 * yields endsAt: null (no countdown target) rather than a parse failure;
 * show_countdown defaults to true when not a boolean, and a link with
 * missing/empty fields is dropped.
 */
export function parseAnnouncementPayload(data: unknown): Announcement | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.text !== "string" || record.text.length === 0) return null;
  return {
    text: record.text,
    endsAt: parseEndsAt(record.ends_at),
    showCountdown:
      typeof record.show_countdown === "boolean" ? record.show_countdown : true,
    link: parseLink(record.link),
  };
}

function parseEndsAt(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLink(value: unknown): { label: string; url: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.label !== "string" || record.label.length === 0 ||
    typeof record.url !== "string" || record.url.length === 0
  ) {
    return null;
  }
  return { label: record.label, url: record.url };
}

export const announcementKeys = {
  all: ["announcement"] as const,
} as const;

/**
 * Announcement bar content merged with the static pre-launch defaults: always
 * returns `{ text, endsAt, showCountdown, link }` — the configured values when
 * the route answers 200 with a valid payload, the defaults otherwise. Never
 * throws. Fetches only in the browser so SSR renders the defaults and the bar
 * updates client-side once the fetch resolves.
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

  return data ?? {
    text: DEFAULT_ANNOUNCEMENT_TEXT,
    endsAt: PRELAUNCH_ENDS_AT,
    showCountdown: true,
    link: null,
  };
}
