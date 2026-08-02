import { createFileRoute } from "@tanstack/react-router";

import { Collection } from "@/components/Collection";

export const Route = createFileRoute("/skin-care")({
  head: () => ({
    meta: [
      { title: "Skin Care — Serums, Cleansers & Moisturisers | Daily Drip" },
      { name: "description", content: "Dermatologist-tested cleansers, vitamin C serums and ceramide moisturisers for oily, dry and sensitive skin." },
      { property: "og:title", content: "Skin Care — Daily Drip" },
      { property: "og:description", content: "Cleansers, serums and moisturisers with disclosed active percentages." },
    ],
  }),
  component: () => (
    <Collection
      filter="skin-care"
      title="Skin Care"
      intro="A cleanser, a serum and a moisturiser. That's a complete routine — everything else is optional."
    />
  ),
});