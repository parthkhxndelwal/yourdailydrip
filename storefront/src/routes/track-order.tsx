import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, parse } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/PageShell";
import {
  useTrackShipment,
  type TrackLookupResult,
  type TrackPending,
  type TrackShipment,
} from "@/lib/medusa-tracking";

export const Route = createFileRoute("/track-order")({
  // Accept an optional `?awb=` search param (e.g. from /order-confirmation's
  // "Track your order" link) to prefill and immediately look up the shipment.
  validateSearch: (search: Record<string, unknown>): { awb?: string } => ({
    awb: typeof search.awb === "string" ? search.awb : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Track Your Order — Daily Drip" },
      {
        name: "description",
        content:
          "Enter your Daily Drip tracking number (AWB) to see live shipping status and expected delivery date.",
      },
      { property: "og:title", content: "Track Your Order — Daily Drip" },
      { property: "og:description", content: "Live shipping status for your Daily Drip order." },
    ],
  }),
  component: TrackOrder,
});

function formatScanAt(value: string): string {
  const parsed = parse(value, "yyyy-MM-dd HH:mm:ss", new Date());
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "d MMM, h:mm a");
}

function formatDateOnly(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "d MMM yyyy");
}

function isTrackPending(shipment: TrackLookupResult): shipment is TrackPending {
  return shipment !== null && "state" in shipment && shipment.state === "pending";
}

function ScanLine({ shipment }: { shipment: TrackShipment }) {
  const expected = formatDateOnly(shipment.expectedDeliveryDate);
  return (
    <ol className="mt-6 space-y-5">
      {shipment.scans.map((scan, i) => (
        <li key={`${scan.at}-${i}`} className="flex gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-leaf" size={18} />
          <div>
            <p className="font-medium">{scan.status || "Update"}</p>
            <p className="text-sm text-muted-foreground">
              {[formatScanAt(scan.at), scan.location].filter(Boolean).join(" · ")}
            </p>
            {scan.remark && <p className="text-sm text-muted-foreground">{scan.remark}</p>}
          </div>
        </li>
      ))}
      {!shipment.terminal && (
        <li className="flex gap-3">
          <Circle className="mt-0.5 shrink-0 text-border" size={18} />
          <div>
            <p className="text-muted-foreground">Delivered</p>
            <p className="text-sm text-muted-foreground">
              {expected ? `Expected ${expected}` : "Awaiting delivery"}
            </p>
          </div>
        </li>
      )}
    </ol>
  );
}

function TrackOrder() {
  const { awb: awbParam } = Route.useSearch();
  const [awbInput, setAwbInput] = useState(awbParam ?? "");
  const [submittedAwb, setSubmittedAwb] = useState(awbParam?.trim() ?? "");
  const query = useTrackShipment(submittedAwb);
  const shipment = query.data;

  return (
    <PageShell
      eyebrow="Support"
      title="Track your order"
      intro="Enter the tracking number (AWB) from your confirmation email to see live shipping status."
    >
      <form
        className="grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedAwb(awbInput);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="awb">Tracking number (AWB)</Label>
          <Input
            id="awb"
            required
            value={awbInput}
            onChange={(e) => setAwbInput(e.target.value)}
            placeholder="e.g. 5330000310052"
          />
        </div>
        <Button type="submit" className="sm:col-span-2 sm:w-fit" disabled={query.isPending}>
          {query.isPending ? "Checking…" : "Track order"}
        </Button>
      </form>

      {submittedAwb && query.isPending && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Looking up tracking for AWB {submittedAwb}…
          </p>
        </div>
      )}

      {submittedAwb && !query.isPending && query.error && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="font-medium text-foreground">We couldn't check your shipment</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong on our side. Please try again in a few minutes.
          </p>
        </div>
      )}

      {submittedAwb && !query.isPending && !query.error && shipment === null && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="font-medium text-foreground">No shipment found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Double-check the tracking number and try again. If you just ordered, tracking may take a
            little while to appear.
          </p>
        </div>
      )}

      {shipment && isTrackPending(shipment) && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="font-medium text-foreground">Awaiting dispatch</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Order synced with logistics provider. Tracking AWB will appear once the courier
            dispatches it.
          </p>
          {shipment.refnum && (
            <p className="mt-2 text-sm text-muted-foreground">
              Reference number{" "}
              <span className="font-medium text-foreground">{shipment.refnum}</span>
            </p>
          )}
        </div>
      )}

      {shipment && !isTrackPending(shipment) && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Tracking number <span className="font-medium text-foreground">{shipment.awb}</span>
            {shipment.status && <> · {shipment.status}</>}
            {formatDateOnly(shipment.expectedDeliveryDate) && (
              <> · Expected {formatDateOnly(shipment.expectedDeliveryDate)}</>
            )}
          </p>
          <ScanLine shipment={shipment} />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Tracking not updating? Write to care@dailydrip.in with your tracking number and we'll
        respond within one working day.
      </p>
    </PageShell>
  );
}
