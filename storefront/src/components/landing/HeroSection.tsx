import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Droplets, FlaskConical, Leaf, Sparkles } from "lucide-react";

import hero from "@/assets/hero.jpg";
import { MRP, PRICE, PRODUCT_SLUG } from "@/lib/prelaunch";

const DISCOUNT = Math.round(((MRP - PRICE) / MRP) * 100);

const FEATURES = [
  { Icon: Leaf, label: "Clinically Researched Actives" },
  { Icon: Droplets, label: "Non-Sticky & Fast Absorbing" },
  { Icon: Sparkles, label: "For All Hair Types" },
  { Icon: FlaskConical, label: "Clean & Safe Formula" },
] as const;

const AVATARS = [
  { initials: "AR", from: "#8FA87F", to: "#4A6350" },
  { initials: "PK", from: "#C5A464", to: "#6B5730" },
  { initials: "SM", from: "#7E9B88", to: "#31403A" },
] as const;

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" as const, delay },
});

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-forest">
      {/* Soft radial glows behind the composition */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 78% 42%, rgba(183,201,166,0.14), transparent 70%), radial-gradient(45% 40% at 12% 85%, rgba(197,164,100,0.1), transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-16 px-4 pb-20 pt-16 md:px-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-10 lg:pb-28 lg:pt-24">
        {/* Left — copy */}
        <div>
          <motion.p {...fadeUp(0)} className="text-[11px] uppercase tracking-[0.32em] text-sage">
            Science-Backed. Nature-Inspired.
          </motion.p>

          <motion.h1
            {...fadeUp(0.08)}
            className="mt-6 font-display text-[clamp(2.6rem,6.2vw,4.5rem)] leading-[0.95] tracking-[-0.02em] text-cream"
          >
            Stronger Roots.
            <br />
            Better Tomorrow.
          </motion.h1>

          <motion.div {...fadeUp(0.16)} className="mt-8 h-px w-16 bg-sage/60" />

          <motion.div {...fadeUp(0.22)} className="mt-8">
            <p className="text-lg font-medium text-cream md:text-xl">Advanced Hair Density Serum</p>
            <p className="mt-1.5 text-base text-cream/70 md:text-lg">
              Powered by science. Rooted in nature.
            </p>
          </motion.div>

          <motion.ul
            {...fadeUp(0.3)}
            className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4"
          >
            {FEATURES.map(({ Icon, label }) => (
              <li key={label} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-sage" strokeWidth={1.5} />
                <span className="text-[11px] leading-[1.45] text-cream/80">{label}</span>
              </li>
            ))}
          </motion.ul>

          <motion.div
            {...fadeUp(0.38)}
            className="mt-12 flex flex-wrap items-center gap-x-9 gap-y-7"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/product/$slug"
                params={{ slug: PRODUCT_SLUG }}
                className="inline-flex h-[60px] items-center gap-3 rounded-xl bg-cream px-10 text-[13px] font-semibold uppercase tracking-[0.22em] text-forest transition-shadow hover:shadow-[0_14px_40px_-16px_rgba(247,244,236,0.55)]"
              >
                Pre-Order Now
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </motion.div>

            <div className="flex items-baseline gap-3">
              <span className="text-[26px] font-medium text-cream">₹{PRICE}</span>
              <span className="text-base text-cream/45 line-through">₹{MRP}</span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-gold">
                {DISCOUNT}% Off
              </span>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.46)} className="mt-10 flex items-center gap-3.5">
            <div className="flex -space-x-2.5">
              {AVATARS.map(({ initials, from, to }) => (
                <span
                  key={initials}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-forest text-[10px] font-semibold text-forest"
                  style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                >
                  {initials}
                </span>
              ))}
            </div>
            <p className="text-sm text-cream/70">Trusted by 5000+ early believers</p>
          </motion.div>
        </div>

        {/* Right — product visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.25 }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div
            aria-hidden
            className="absolute -inset-10 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(183,201,166,0.22), transparent 70%)",
            }}
          />
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative rounded-[2.4rem] border border-gold/20 bg-white/5 p-2.5"
          >
            <div className="relative overflow-hidden rounded-[2rem]">
              <img
                src={hero}
                alt="Advanced Hair Density Serum — amber glass bottle resting on fresh green botanicals"
                width={1600}
                height={1200}
                className="h-auto w-full object-cover"
              />
            </div>

            {/* Certification badge */}
            <div className="absolute right-5 top-5 flex h-24 w-24 flex-col items-center justify-center rounded-full border border-gold/40 bg-forest/50 px-2 text-center backdrop-blur-sm md:h-28 md:w-28">
              <span className="text-[8px] uppercase leading-relaxed tracking-[0.16em] text-gold">
                Science Backed
              </span>
              <span className="mt-1 text-[8px] uppercase leading-relaxed tracking-[0.16em] text-cream/85">
                Results Driven
              </span>
            </div>

            {/* Label plate */}
            <div className="absolute bottom-5 left-5 rounded-xl border border-white/10 bg-forest/70 px-4 py-3 backdrop-blur-md">
              <span className="block text-[9px] uppercase tracking-[0.3em] text-sage">
                Daily Drip
              </span>
              <span className="mt-1 block font-display text-sm text-cream">
                Advanced Hair Density Serum
              </span>
              <span className="mt-0.5 block text-[10px] text-cream/60">30 ml</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
