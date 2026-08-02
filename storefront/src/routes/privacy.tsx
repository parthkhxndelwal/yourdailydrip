import { createFileRoute } from "@tanstack/react-router";

import { PageShell, Section } from "@/components/PageShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — Daily Drip" },
      { name: "description", content: "How Daily Drip collects, uses, stores and deletes your personal information, and how to raise a privacy request." },
      { property: "og:title", content: "Privacy Notice — Daily Drip" },
      { property: "og:description", content: "How Daily Drip handles your personal information." },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Policies"
      title="Privacy Notice"
      intro="This page is maintained by Daily Drip Wellness Pvt. Ltd. and describes our current practices. Last updated 30 July 2026."
    >
      <Section heading="What we collect">
        <p>
          Contact and delivery details you enter (name, email, phone, address), your order
          history, and basic analytics such as pages viewed and device type. We do not
          collect health records or sensitive identity documents.
        </p>
      </Section>
      <Section heading="How we use it">
        <p>
          To process and deliver orders, respond to support requests, and — only if you opt
          in — send offers by email or WhatsApp. You can unsubscribe from any message.
        </p>
      </Section>
      <Section heading="Who we share it with">
        <p>
          Delivery partners and payment processors receive only the information needed to
          complete your order. We do not sell personal data to anyone.
        </p>
      </Section>
      <Section heading="Cookies">
        <p>
          We use essential cookies to keep your cart and session working, plus analytics
          cookies to understand how the store is used. You can block non-essential cookies
          in your browser without breaking checkout.
        </p>
      </Section>
      <Section heading="Retention and your rights">
        <p>
          Order records are retained as long as tax law requires. You can request access,
          correction or deletion of your data by writing to care@dailydrip.in; we respond
          within 30 days.
        </p>
      </Section>
    </PageShell>
  ),
});