import { createFileRoute } from "@tanstack/react-router";

import { PageShell, Section } from "@/components/PageShell";

export const Route = createFileRoute("/shipping-policy")({
  head: () => ({
    meta: [
      { title: "Shipping Policy — Daily Drip" },
      { name: "description", content: "Dispatch timelines, delivery estimates, shipping charges and what to do if your Daily Drip parcel is delayed or damaged." },
      { property: "og:title", content: "Shipping Policy — Daily Drip" },
      { property: "og:description", content: "Dispatch timelines, charges and delivery estimates." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="Policies" title="Shipping Policy" intro="Everything about how and when your order reaches you.">
      <Section heading="Dispatch">
        <p>Orders placed before 4 PM IST on a working day are dispatched the same day from our Bengaluru warehouse. Orders after that go out the next working day.</p>
      </Section>
      <Section heading="Delivery estimates">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Metro cities: 2–3 working days</li>
          <li>Rest of India: 4–6 working days</li>
          <li>North-east, J&amp;K and island territories: 6–9 working days</li>
        </ul>
      </Section>
      <Section heading="Charges">
        <p>
          Shipping charges are calculated at checkout based on your delivery pincode and shown
          before you pay — the rate is confirmed by our courier partners for your address. All
          orders are prepaid (online payment only); cash on delivery is not offered.
        </p>
      </Section>
      <Section heading="Tracking, delays and damage">
        <p>
          A tracking link is sent by email and SMS at dispatch, and you can check status on
          the Track Order page. If a parcel arrives damaged or tampered with, refuse delivery
          where possible and email care@dailydrip.in within 48 hours with photos — we ship a
          free replacement.
        </p>
      </Section>
    </PageShell>
  ),
});