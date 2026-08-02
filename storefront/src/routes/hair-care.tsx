import { createFileRoute } from "@tanstack/react-router";

import { Collection } from "@/components/Collection";

export const Route = createFileRoute("/hair-care")({
  head: () => ({
    meta: [
      { title: "Hair Care — Oils, Shampoo & Masks | Daily Drip" },
      { name: "description", content: "Rosemary hair growth oil, sulphate-free shampoo, keratin repair mask and scalp tonic for every hair type." },
      { property: "og:title", content: "Hair Care — Daily Drip" },
      { property: "og:description", content: "Scalp-first hair care: oils, sulphate-free shampoo and repair masks." },
    ],
  }),
  component: () => (
    <Collection
      filter="hair-care"
      title="Hair Care"
      intro="Healthy hair starts at the scalp. Oil, cleanse, repair — in that order."
    />
  ),
});