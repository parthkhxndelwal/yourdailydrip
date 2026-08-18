import { createFileRoute } from "@tanstack/react-router";

import { PageShell, Section } from "@/components/PageShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Daily Drip" },
      { name: "description", content: "Who we are: a small Mumbai team making dermatologist-tested skin and hair care with fully disclosed formulas." },
      { property: "og:title", content: "About Us — Daily Drip" },
      { property: "og:description", content: "A small Mumbai team making honest skin and hair care." },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Company overview"
      title="About Daily Drip"
      intro="A small Mumbai team making skin and hair care we're happy to put on our own families."
    >
      <Section heading="What we do">
        <p>
          Daily Drip Wellness Pvt. Ltd. formulates, tests and sells a deliberately short
          range of skin and hair care products. Seven products, each solving one clear
          problem, all manufactured in a GMP-certified facility in Karnataka.
        </p>
      </Section>
      <Section heading="How we formulate">
        <p>
          Every formula is developed with a cosmetic chemist and reviewed by a consulting
          dermatologist before it goes to production. We publish the exact percentage of
          each active ingredient on the pack and the product page — if a percentage is
          missing anywhere, treat it as a mistake and tell us.
        </p>
      </Section>
      <Section heading="Safety and testing">
        <p>
          Products are patch-tested on volunteers and undergo stability and microbial
          challenge testing. We do not test on animals and never have. Batch numbers and
          expiry dates are printed on every unit.
        </p>
      </Section>
      <Section heading="Talk to us">
        <p>
          Questions, complaints or ingredient queries go to contact@yourdailydrip.com or
          +91 93240 08663, Monday to Saturday, 9 AM to 7 PM IST. A real person replies
          within one working day.
        </p>
      </Section>
    </PageShell>
  ),
});