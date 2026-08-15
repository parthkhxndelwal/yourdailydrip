import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { useMappedFeaturedProducts } from "@/lib/medusa-hooks";
import { BenefitCards } from "./BenefitCards";
import { Reveal } from "./Reveal";

type Ingredient = { name: string; note: string };

const LEFT_INGREDIENTS: Ingredient[] = [
  { name: "Procapil®", note: "Strengthens roots." },
  { name: "Redensyl®", note: "Boosts hair density." },
  { name: "Anagain™", note: "Activates growth." },
  { name: "Caffeine", note: "Stimulates follicles." },
  { name: "Apple Stem Cells", note: "Revives & regenerates." },
];

const RIGHT_INGREDIENTS: Ingredient[] = [
  { name: "Follicusan®", note: "Nourishes follicles." },
  { name: "Capilia Longa®", note: "Improves hair anchoring." },
  { name: "Biotin", note: "Supports keratin." },
  { name: "Rosemary Extract", note: "Improves scalp health." },
];

/** Vertical positions (%) of the left-side labels along the droplet. */
const LEFT_TOPS = [4, 25, 46, 67, 88];
const RIGHT_TOPS = [13, 34, 55, 76];

function DropletSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      role="img"
      aria-label="A serum droplet containing hair-growth actives and a hair follicle"
    >
      <defs>
        <linearGradient id="dd-drop" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#B7C9A6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#18251A" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path
        d="M100 10 C 54 52 32 88 32 122 a 68 68 0 0 0 136 0 C 168 88 146 52 100 10 Z"
        fill="url(#dd-drop)"
        stroke="#B7C9A6"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {/* Inner highlight */}
      <ellipse cx="78" cy="72" rx="24" ry="36" fill="#F7F4EC" opacity="0.05" />
      {/* Hair follicle — bulb + rising shafts */}
      <ellipse
        cx="100"
        cy="152"
        rx="15"
        ry="21"
        fill="#B7C9A6"
        fillOpacity="0.22"
        stroke="#B7C9A6"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <g fill="none" stroke="#F7F4EC" strokeLinecap="round" strokeWidth="2" strokeOpacity="0.55">
        <path d="M100 132 C 100 110 108 94 116 82" />
        <path d="M92 134 C 88 114 84 102 78 90" strokeOpacity="0.35" />
        <path d="M108 134 C 112 114 118 102 124 90" strokeOpacity="0.35" />
      </g>
    </svg>
  );
}

function LabelLine({ side }: { side: "left" | "right" }) {
  return (
    <span
      className={
        side === "left" ? "flex items-center gap-2" : "flex flex-row-reverse items-center gap-2"
      }
    >
      <span className="h-px w-6 bg-sage/60" />
      <span className="h-1.5 w-1.5 rounded-full bg-sage" />
    </span>
  );
}

function IngredientText({ ingredient }: { ingredient: Ingredient }) {
  return (
    <span className="block max-w-[170px]">
      <span className="block text-[13px] font-medium leading-snug text-charcoal">
        {ingredient.name}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-forest/60">
        {ingredient.note}
      </span>
    </span>
  );
}

export function IngredientSection() {
  const { data } = useMappedFeaturedProducts(1, true);
  const product = data?.[0];
  return (
    <section id="ingredients" className="scroll-mt-28 bg-cream-soft py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10">
          {/* Left — copy */}
          <div>
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.35em] text-gold">The Formula</p>
              <h2 className="mt-4 font-display text-3xl leading-[1.08] text-charcoal md:text-4xl">
                14 Advanced Actives for Visible Results
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-forest/70">
                A perfect blend of science and nature to strengthen roots, boost density and support
                healthy hair growth.
              </p>
              {product && (
                <Link
                  to="/product/$slug"
                  params={{ slug: product.slug }}
                  className="group mt-8 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.25em] text-charcoal"
                >
                  Discover Ingredients
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1.5"
                    strokeWidth={1.5}
                  />
                </Link>
              )}
            </Reveal>
          </div>

          {/* Center — droplet diagram (desktop) */}
          <div className="hidden lg:block">
            <div className="relative lg:h-[560px]">
              <DropletSvg className="absolute left-1/2 top-1/2 h-[440px] w-auto -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_24px_48px_rgba(11,23,16,0.18)]" />

              {LEFT_INGREDIENTS.map((ingredient, i) => (
                <motion.div
                  key={ingredient.name}
                  initial={{ opacity: 0, x: -28 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 + i * 0.1 }}
                  className="absolute right-[50%] flex justify-end"
                  style={{ top: `${LEFT_TOPS[i]}%` }}
                >
                  <div className="flex items-center gap-2.5">
                    <IngredientText ingredient={ingredient} />
                    <LabelLine side="left" />
                  </div>
                </motion.div>
              ))}

              {RIGHT_INGREDIENTS.map((ingredient, i) => (
                <motion.div
                  key={ingredient.name}
                  initial={{ opacity: 0, x: 28 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 + i * 0.1 }}
                  className="absolute left-[50%]"
                  style={{ top: `${RIGHT_TOPS[i]}%` }}
                >
                  <div className="flex items-center gap-2.5">
                    <LabelLine side="right" />
                    <IngredientText ingredient={ingredient} />
                  </div>
                </motion.div>
              ))}

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
                className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-sage/40 bg-white px-5 py-2 text-[11px] font-medium tracking-[0.08em] text-forest/80"
              >
                + 5 More Powerful Actives
              </motion.p>
            </div>
          </div>

          {/* Center — compact diagram + list (mobile) */}
          <div className="lg:hidden">
            <Reveal>
              <DropletSvg className="mx-auto h-40 w-auto opacity-90" />
              <div className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {[...LEFT_INGREDIENTS, ...RIGHT_INGREDIENTS].map((ingredient) => (
                  <div key={ingredient.name} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                    <IngredientText ingredient={ingredient} />
                  </div>
                ))}
              </div>
              <p className="mt-8 w-fit rounded-full border border-sage/40 bg-white px-5 py-2 text-[11px] font-medium tracking-[0.08em] text-forest/80">
                + 5 More Powerful Actives
              </p>
            </Reveal>
          </div>

          {/* Right — benefit cards */}
          <BenefitCards />
        </div>
      </div>
    </section>
  );
}
