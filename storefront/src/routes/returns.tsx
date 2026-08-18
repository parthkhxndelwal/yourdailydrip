import { createFileRoute } from "@tanstack/react-router";

import { PageShell, Section } from "@/components/PageShell";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "Return & Refund Policy — Daily Drip" },
      { name: "description", content: "Daily Drip's 14-day return window, refund timelines, replacement process and what cannot be returned." },
      { property: "og:title", content: "Return & Refund Policy — Daily Drip" },
      { property: "og:description", content: "14-day returns, clear refund timelines, easy replacements." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="Policies" title="Return &amp; Refund Policy" intro="Simple rules, no hidden conditions.">
      <Section heading="Return window">
        <p>Unopened products with intact seals can be returned within 14 days of delivery. Raise the request from your account or email contact@yourdailydrip.com with your order ID.</p>
      </Section>
      <Section heading="Damaged, wrong or missing items">
        <p>Report within 48 hours of delivery with photos. We ship a replacement at no cost, or refund in full if you prefer.</p>
      </Section>
      <Section heading="What cannot be returned">
        <p>For hygiene reasons, opened or used products cannot be returned unless they are defective. Free gifts and promotional samples are non-returnable.</p>
      </Section>
      <Section heading="Refund timeline">
        <p>Once the returned parcel reaches our warehouse and passes inspection, refunds are initiated within 48 hours and reach the original payment method in 5–7 working days. COD refunds are sent by bank transfer to the account you share.</p>
      </Section>
    </PageShell>
  ),
});