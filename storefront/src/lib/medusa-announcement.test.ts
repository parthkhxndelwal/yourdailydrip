// Unit tests for the announcement data layer: the pure payload parser and the
// useAnnouncement hook's fallback behavior. The SDK client is mocked; the
// hook must merge the route's 200 payload with the static pre-launch defaults
// and never throw, whatever the backend answers.

import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./medusa", () => ({
  sdk: { client: { fetch: vi.fn() } },
}));

import { sdk } from "./medusa";
import { PRELAUNCH_ENDS_AT } from "./prelaunch";
import {
  DEFAULT_ANNOUNCEMENT_TEXT,
  parseAnnouncementPayload,
  useAnnouncement,
} from "./medusa-announcement";

const fetchMock = vi.mocked(sdk.client.fetch);

// Mirror of the 200 shape of GET /store/announcement.
const VALID_PAYLOAD = {
  text: "Pre-Launch Sale — Flat 20% Off",
  ends_at: "2026-08-24T23:59:59+05:30",
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("parseAnnouncementPayload", () => {
  it("parses a full payload", () => {
    const parsed = parseAnnouncementPayload(VALID_PAYLOAD);

    expect(parsed).toEqual({
      text: VALID_PAYLOAD.text,
      endsAt: new Date(VALID_PAYLOAD.ends_at),
    });
  });

  it("returns null for a non-object payload", () => {
    expect(parseAnnouncementPayload(null)).toBeNull();
    expect(parseAnnouncementPayload("nope")).toBeNull();
    expect(parseAnnouncementPayload(42)).toBeNull();
  });

  it("returns null when text is missing, empty, or not a string", () => {
    expect(parseAnnouncementPayload({ ends_at: VALID_PAYLOAD.ends_at })).toBeNull();
    expect(parseAnnouncementPayload({ text: "", ends_at: VALID_PAYLOAD.ends_at })).toBeNull();
    expect(parseAnnouncementPayload({ text: 42, ends_at: VALID_PAYLOAD.ends_at })).toBeNull();
  });

  it("returns null when ends_at is missing or not a valid date string", () => {
    expect(parseAnnouncementPayload({ text: "Sale" })).toBeNull();
    expect(parseAnnouncementPayload({ text: "Sale", ends_at: null })).toBeNull();
    expect(parseAnnouncementPayload({ text: "Sale", ends_at: "" })).toBeNull();
    expect(parseAnnouncementPayload({ text: "Sale", ends_at: "not-a-date" })).toBeNull();
  });
});

describe("useAnnouncement", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("falls back to the defaults when the fetch errors", async () => {
    fetchMock.mockRejectedValue(new Error("backend down"));

    const { result } = renderHook(() => useAnnouncement(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/store/announcement"));
    await waitFor(() => {
      expect(result.current).toEqual({
        text: DEFAULT_ANNOUNCEMENT_TEXT,
        endsAt: PRELAUNCH_ENDS_AT,
      });
    });
  });

  it("falls back to the defaults when the route returns nulls", async () => {
    fetchMock.mockResolvedValue({ text: null, ends_at: null });

    const { result } = renderHook(() => useAnnouncement(), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({
        text: DEFAULT_ANNOUNCEMENT_TEXT,
        endsAt: PRELAUNCH_ENDS_AT,
      });
    });
  });

  it("returns configured values on a 200 response", async () => {
    const configured = { text: "Flash Sale — Extra 10% Off", ends_at: "2026-09-01T18:30:00Z" };
    fetchMock.mockResolvedValue(configured);

    const { result } = renderHook(() => useAnnouncement(), { wrapper });

    await waitFor(() => expect(result.current.text).toBe(configured.text));
    expect(result.current.endsAt.getTime()).toBe(new Date(configured.ends_at).getTime());
  });
});
