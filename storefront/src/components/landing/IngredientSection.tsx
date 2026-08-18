import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import redensyl from "@/assets/ingredients/redensyl.jpg";
import procapil from "@/assets/ingredients/procapil.jpg";
import anagain from "@/assets/ingredients/anagain.jpg";
import caffeine from "@/assets/ingredients/caffeine.jpg";
import rosemary from "@/assets/ingredients/rosemary.jpg";
import biotin from "@/assets/ingredients/biotin.jpg";
import follicusan from "@/assets/ingredients/follicusan.jpg";

import { useMappedFeaturedProducts } from "@/lib/medusa-hooks";
import { Reveal } from "./Reveal";

const CATEGORIES = [
  "Clinical Heavyweights",
  "Circulation & Energy Boosters",
  "Nutrition & Conditioning",
] as const;

type IngredientSlide = {
  name: string;
  claim: string;
  description: string;
  image: string;
  category: (typeof CATEGORIES)[number];
};

const INGREDIENTS: IngredientSlide[] = [
  {
    name: "Redensyl®",
    claim: "Promotes new growth & density",
    description:
      "One of the most clinically studied hair actives on the market. It targets stem cells in the bulge region of the hair follicle, forcing dormant (telogen) hairs back into the active growth (anagen) phase — often compared to 5% Minoxidil in efficacy, without the side effects.",
    image: redensyl,
    category: "Clinical Heavyweights",
  },
  {
    name: "Procapil®",
    claim: "Strengthens anchorage & reduces fall",
    description:
      "A patented blend of Apigenin (from parsley), Oleanolic acid and Biotin. It relaxes the scalp muscles and improves micro-circulation, anchoring the hair shaft firmly in the dermal papilla and drastically reducing the shedding of weak roots.",
    image: procapil,
    category: "Clinical Heavyweights",
  },
  {
    name: "AnaGain+ Baicapil",
    claim: "Stimulates cycle & thicker hair",
    description:
      "AnaGain (from organic pea sprouts) stimulates dermal papilla cells, while Baicapil (from Chinese Skullcap, Wheat and Soy) extends the anagen phase and stimulates keratin production. Together they increase hair diameter — each strand gets visibly thicker.",
    image: anagain,
    category: "Clinical Heavyweights",
  },
  {
    name: "Caffeine",
    claim: "Energizes scalp & supports growth",
    description:
      "Neutralizes the effects of DHT at a local level and penetrates deeply to raise ATP (cellular energy) in the roots, giving follicles the fuel they need to divide rapidly.",
    image: caffeine,
    category: "Circulation & Energy Boosters",
  },
  {
    name: "Rosemary Extract",
    claim: "Antioxidant & blood circulation",
    description:
      "Nature's Minoxidil. It dilates blood vessels so more oxygen and nutrients reach the follicle, and its anti-inflammatory power combats scalp oxidative stress — a leading cause of premature graying and shedding.",
    image: rosemary,
    category: "Circulation & Energy Boosters",
  },
  {
    name: "Biotin",
    claim: "Supports healthy hair structure",
    description:
      "Topical biotin coats the hair shaft and binds to the keratin structure, improving elasticity and reducing mid-shaft breakage — not just root shedding.",
    image: biotin,
    category: "Nutrition & Conditioning",
  },
  {
    name: "Follicusan®",
    claim: "Scalp conditioner & microbiome support",
    description:
      "A milk protein extract combined with bio-peptides that mimics the hair's natural lipid layer — moisturizing the scalp and keeping follicles free of oil and debris so they aren't suffocated.",
    image: follicusan,
    category: "Nutrition & Conditioning",
  },
];

export function IngredientSection() {
  const { data } = useMappedFeaturedProducts(1, true);
  const product = data?.[0];
  const [activeIndex, setActiveIndex] = useState(0);

  const active = INGREDIENTS[activeIndex];

  const goToCategory = (category: (typeof CATEGORIES)[number]) => {
    const index = INGREDIENTS.findIndex((slide) => slide.category === category);
    if (index !== -1) setActiveIndex(index);
  };

  const goToPrev = () =>
    setActiveIndex((i) => (i - 1 + INGREDIENTS.length) % INGREDIENTS.length);
  const goToNext = () => setActiveIndex((i) => (i + 1) % INGREDIENTS.length);

  return (
    <section id="ingredients" className="scroll-mt-28 bg-cream-soft py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
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

        <Reveal delay={0.1}>
          <div className="mt-14 grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
            {/* Right — 1:1 ingredient carousel (above content on mobile) */}
            <div className="order-1 lg:order-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-sand">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="h-full w-full"
                  >
                    <img
                      src={active.image}
                      alt={`${active.name} — Daily Drip ingredient`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </motion.div>
                </AnimatePresence>

                <button
                  type="button"
                  onClick={goToPrev}
                  aria-label="Previous ingredient"
                  className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-cream/40 bg-white/90 text-charcoal shadow-md backdrop-blur transition-colors hover:bg-white"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  aria-label="Next ingredient"
                  className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-cream/40 bg-white/90 text-charcoal shadow-md backdrop-blur transition-colors hover:bg-white"
                >
                  <ChevronRight size={18} />
                </button>

                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
                  {INGREDIENTS.map((slide, i) => (
                    <button
                      key={slide.name}
                      type="button"
                      onClick={() => setActiveIndex(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={i === activeIndex}
                      className={`size-2 rounded-full transition-all ${
                        i === activeIndex ? "w-6 bg-sage" : "bg-forest/25 hover:bg-forest/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Left — editorial content for the active slide */}
            <div className="order-2 lg:order-1">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => goToCategory(category)}
                    className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                      active.category === category
                        ? "border-forest bg-forest text-cream"
                        : "border-sage/40 bg-white text-forest/70 hover:border-sage/70"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 12, x: -8 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, y: -8, x: 8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="mt-8"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold">
                    {active.category}
                  </p>
                  <h3 className="mt-3 font-display text-3xl leading-tight text-charcoal md:text-4xl">
                    {active.name}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-forest/80">{active.claim}</p>
                  <p className="mt-4 max-w-md leading-relaxed text-forest/70">
                    {active.description}
                  </p>
                  <p className="mt-6 text-xs tracking-[0.2em] text-forest/50">
                    {String(activeIndex + 1).padStart(2, "0")} / 07
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}