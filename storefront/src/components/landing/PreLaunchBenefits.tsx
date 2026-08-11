import { BadgePercent, Rocket, Truck } from "lucide-react";

import { Reveal } from "./Reveal";

const BENEFITS = [
  {
    Icon: BadgePercent,
    title: "20% OFF",
    body: "Flat discount on your first pre-order",
  },
  {
    Icon: Rocket,
    title: "Early Access",
    body: "Be the first to try it — before launch",
  },
  {
    Icon: Truck,
    title: "Priority Shipping",
    body: "Ships before launch, straight to your door",
  },
] as const;

export function PreLaunchBenefits() {
  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <Reveal>
          <div
            className="rounded-3xl border border-forest/10 bg-white px-6 py-12 text-center md:px-14 md:py-16"
            style={{ boxShadow: "0 28px 80px -48px rgba(11,23,16,0.35)" }}
          >
            <p className="text-[11px] uppercase tracking-[0.35em] text-gold">
              Pre-Launch Exclusive
            </p>
            <h2 className="mt-4 font-display text-3xl leading-tight text-charcoal md:text-4xl">
              Be the first. Get exclusive benefits.
            </h2>

            <div className="mt-12 grid gap-10 md:grid-cols-3 md:divide-x md:divide-forest/10">
              {BENEFITS.map(({ Icon, title, body }) => (
                <div key={title} className="px-2 text-center md:px-8">
                  <Icon className="mx-auto h-6 w-6 text-forest/80" strokeWidth={1.5} />
                  <p className="mt-4 font-medium text-charcoal">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-forest/60">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
