import { createFileRoute } from "@tanstack/react-router";

import { Collection } from "@/components/Collection";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop All Products — Daily Drip" },
      { name: "description", content: "Browse every Daily Drip skin care and hair care product, with honest ingredient lists and clear pricing." },
      { property: "og:title", content: "Shop All Products — Daily Drip" },
      { property: "og:description", content: "Every Daily Drip skin and hair care product in one place." },
    ],
  }),
  component: () => (
    <Collection
      title="Shop everything"
      intro="Seven products, each doing one job well. Shipping is calculated at checkout from your delivery address."
    />
  ),
});