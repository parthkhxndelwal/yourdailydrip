import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/blogs")({
  head: () => ({
    meta: [
      { title: "Blogs — Skin & Hair Care Guides | Daily Drip" },
      { name: "description", content: "Plain-language articles on vitamin C, scalp health, barrier repair and building a routine that you'll actually stick to." },
      { property: "og:title", content: "Blogs — Daily Drip" },
      { property: "og:description", content: "Plain-language skin and hair care guides from Daily Drip." },
    ],
  }),
  component: Blogs,
});

const posts = [
  { title: "Vitamin C: what the percentage on the label actually means", date: "18 July 2026", read: "6 min", excerpt: "Not all vitamin C is the same molecule. Here's how ethyl ascorbic acid compares to L-ascorbic acid, and why stability matters more than strength." },
  { title: "Your scalp is skin — treat it like it", date: "2 July 2026", read: "5 min", excerpt: "Flaking, itch and oiliness usually trace back to a disturbed scalp barrier, not to your shampoo brand." },
  { title: "How to know your moisture barrier is damaged", date: "21 June 2026", read: "4 min", excerpt: "Stinging toner, sudden sensitivity and midday tightness are the three signals worth acting on early." },
  { title: "The three-step routine that beats a ten-step one", date: "6 June 2026", read: "5 min", excerpt: "Consistency outperforms complexity. Here's the minimum effective routine for oily, dry and combination skin." },
];

function Blogs() {
  return (
    <PageShell eyebrow="Journal" title="Blogs" intro="Straightforward guides from our formulators and consulting dermatologist.">
      <div className="grid gap-6 sm:grid-cols-2">
        {posts.map((p) => (
          <article key={p.title} className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              {p.date} · {p.read} read
            </p>
            <h2 className="mt-2 text-xl leading-snug">{p.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{p.excerpt}</p>
          </article>
        ))}
      </div>
    </PageShell>
  );
}