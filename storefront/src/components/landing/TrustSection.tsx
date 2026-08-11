import { Droplets, HeartPulse, MapPin, ShieldCheck, Sparkles } from "lucide-react";

import { Reveal } from "./Reveal";

const BADGES = [
  { Icon: ShieldCheck, label: "Paraben Free" },
  { Icon: Droplets, label: "Sulfate Free" },
  { Icon: Sparkles, label: "Silicone Free" },
  { Icon: HeartPulse, label: "Cruelty Free" },
  { Icon: MapPin, label: "Made in India" },
] as const;

export function TrustSection() {
  return (
    <section className="bg-cream py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <Reveal>
          <h2 className="text-center font-display text-2xl leading-snug text-charcoal md:text-3xl">
            No Hype. Just Honest Care.
          </h2>
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {BADGES.map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5">
                <Icon className="h-[18px] w-[18px] text-forest/75" strokeWidth={1.5} />
                <span className="text-[11px] uppercase tracking-[0.22em] text-charcoal/85">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
