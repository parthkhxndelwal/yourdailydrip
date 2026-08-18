import { createFileRoute, Link } from "@tanstack/react-router";

import { PageShell, Section } from "@/components/PageShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Daily Drip" },
      {
        name: "description",
        content:
          "The terms that apply when you shop with Daily Drip — orders, pre-orders, payments, shipping, returns and liability.",
      },
      { property: "og:title", content: "Terms & Conditions — Daily Drip" },
      {
        property: "og:description",
        content: "The terms that apply when you shop with Daily Drip.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Policies"
      title="Terms & Conditions"
      intro="These terms are maintained by Daily Drip Wellness Pvt. Ltd. and govern every order placed on this store. Last updated 30 July 2026."
    >
      <Section heading="Orders and payments">
        <p>
          All prices on this store are in Indian Rupees (INR) and include applicable taxes unless
          stated otherwise. Payments are processed securely through Razorpay using cards, UPI, net
          banking or wallets. Your order is confirmed only when we send you a confirmation email; we
          may cancel orders that we cannot fulfil or verify.
        </p>
      </Section>
      <Section heading="Pre-orders">
        <p>
          Pre-order items are charged at the time of ordering. They ship by the date shown on the
          product page once the batch is ready. You can cancel a pre-order before it ships and we
          will refund the full amount within 7 working days.
        </p>
      </Section>
      <Section heading="Shipping and returns">
        <p>
          We aim to dispatch in-stock orders within 24–48 hours. Delivery timelines depend on your
          pin code. For returns, exchanges and refunds, please refer to our{" "}
          <Link to="/shipping-policy" className="underline">
            Shipping Policy
          </Link>{" "}
          — products must be unopened and in original packaging to be eligible.
        </p>
      </Section>
      <Section heading="Product use">
        <p>
          Our products are cosmetics, not medicines. They are not intended to diagnose, treat or
          cure any condition. Always read the ingredient list and do a patch test before first use.
          If irritation occurs, stop use and consult a dermatologist.
        </p>
      </Section>
      <Section heading="Liability">
        <p>
          To the maximum extent permitted by law, Daily Drip Wellness Pvt. Ltd. is not liable for
          indirect or consequential loss arising from the use of our products or this website. Our
          total liability for any claim is limited to the amount you paid for the products in
          question.
        </p>
      </Section>
      <Section heading="Governing law">
        <p>
          These terms are governed by the laws of India. Any dispute will be subject to the
          exclusive jurisdiction of the courts of Mumbai, Maharashtra.
        </p>
      </Section>
    </PageShell>
  ),
});
