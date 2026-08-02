import { createFileRoute } from "@tanstack/react-router";

import { PageShell, Section } from "@/components/PageShell";

export const Route = createFileRoute("/how-to-use")({
  head: () => ({
    meta: [
      { title: "How to Use — Routine Guides | Daily Drip" },
      { name: "description", content: "Step-by-step morning and night skin routines, plus a weekly hair care schedule using Daily Drip products." },
      { property: "og:title", content: "How to Use — Daily Drip Routine Guides" },
      { property: "og:description", content: "Morning, night and weekly hair routines, step by step." },
    ],
  }),
  component: () => (
    <PageShell eyebrow="Guides" title="How to use your products" intro="Order of application matters more than the number of products.">
      <Section heading="Morning skin routine">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Calm Gel Cleanser — 30 seconds, lukewarm water.</li>
          <li>Clarity Vitamin C Serum — 3–4 drops on damp skin.</li>
          <li>Barrier Repair Moisturiser — a pea-sized amount.</li>
          <li>Broad-spectrum SPF 30+ — every single morning.</li>
        </ol>
      </Section>
      <Section heading="Night skin routine">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Cleanse (twice if you wore sunscreen or makeup).</li>
          <li>Any treatment product, if you use one.</li>
          <li>Barrier Repair Moisturiser to seal everything in.</li>
        </ol>
      </Section>
      <Section heading="Weekly hair schedule">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-foreground">Twice a week:</strong> Rooted Hair Growth Oil, 1–2 hours before washing.</li>
          <li><strong className="text-foreground">Every wash:</strong> Everyday Gentle Shampoo on the scalp only.</li>
          <li><strong className="text-foreground">Once a week:</strong> Deep Repair Hair Mask on mid-lengths and ends, 10 minutes.</li>
          <li><strong className="text-foreground">Daily, optional:</strong> Balance Scalp Tonic on a dry or itchy scalp.</li>
        </ul>
      </Section>
      <Section heading="Patch testing">
        <p>Apply a small amount behind the ear or on the inner forearm for 24 hours before first full use, especially if your skin is reactive.</p>
      </Section>
    </PageShell>
  ),
});