import { createFileRoute } from "@tanstack/react-router";

import { PageShell, Section } from "@/components/PageShell";

export const Route = createFileRoute("/our-story")({
  head: () => ({
    meta: [
      { title: "Our Story & Values — Daily Drip" },
      { name: "description", content: "Why Daily Drip started and the four values that decide what we make, what we charge and what we refuse to claim." },
      { property: "og:title", content: "Our Story & Values — Daily Drip" },
      { property: "og:description", content: "The story and values behind Daily Drip." },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Our story"
      title="Started because labels lie"
      intro="Two friends, one dermatologist and a lot of frustration with '10% vitamin C' claims that meant nothing."
    >
      <Section heading="2021 — the first batch">
        <p>
          Our founders spent a year trying to find a vitamin C serum that listed its actual
          concentration. They couldn't. So they worked with a contract manufacturer near
          Hosur, made 500 bottles of what became Clarity, and sold them to friends.
        </p>
      </Section>
      <Section heading="2023 — hair care, scalp first">
        <p>
          Customers kept asking for hair products that didn't need three washes to come
          out. Rooted Hair Growth Oil took eleven formulation rounds to get right.
        </p>
      </Section>
      <Section heading="Our values">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground">Disclose everything.</strong> Full INCI lists and active percentages, always.</li>
          <li><strong className="text-foreground">Promise less.</strong> No miracle claims, no before-and-afters we can't back with data.</li>
          <li><strong className="text-foreground">Fewer, better products.</strong> We'd rather kill a formula than launch a filler.</li>
          <li><strong className="text-foreground">Fair pricing.</strong> No inflated MRPs designed to be discounted.</li>
        </ul>
      </Section>
    </PageShell>
  ),
});