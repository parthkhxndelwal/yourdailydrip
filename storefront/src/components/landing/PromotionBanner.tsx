import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Droplets, FlaskConical, Heart, ShieldCheck } from "lucide-react";

import hero from "@/assets/hero.jpg";
import { useMappedFeaturedProducts } from "@/lib/medusa-hooks";
import { discountPct, formatPrice } from "@/lib/products";
import { Reveal } from "./Reveal";

const TRUST_POINTS = [
  { Icon: ShieldCheck, label: "Dermatologist Recommended" },
  { Icon: Heart, label: "Cruelty Free" },
  { Icon: Droplets, label: "Non-Comedogenic" },
  { Icon: FlaskConical, label: "Safe & Tested" },
] as const;

export function PromotionBanner() {
  const { data } = useMappedFeaturedProducts(1, true);
  const product = data?.[0];
  return (
    <section className="bg-cream-soft px-4 pb-20 md:px-8 md:pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-forest px-6 py-12 md:px-12 md:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(55% 60% at 85% 15%, rgba(183,201,166,0.12), transparent 70%), radial-gradient(40% 50% at 8% 90%, rgba(197,164,100,0.1), transparent 70%)",
              }}
            />

            <div className="relative grid items-center gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">
              {/* Bottle + packaging visual */}
              <img
                src={product?.images[0] ?? hero}
                alt={product ? `${product.name} — product image` : "Daily Drip product"}
                className="h-52 w-full rounded-2xl border border-white/10 object-cover md:h-64"
                loading="lazy"
              />

              {/* Offer copy */}
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-gold">
                  Exclusive Pre-Launch Access
                </p>
                <h3 className="mt-4 font-display text-3xl leading-tight text-cream md:text-4xl">
                  Pre-Launch Sale is Live!
                </h3>
                <p className="mt-3 text-cream/70">Be among the first to experience our 18% Hair Growth Actives formula.</p>

                <div className="mt-7 flex flex-wrap items-center gap-x-9 gap-y-6">
                  {product ? (
                    <>
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Link
                          to="/product/$slug"
                          params={{ slug: product.slug }}
                          className="inline-flex h-[58px] items-center gap-3 rounded-xl bg-cream px-9 text-[13px] font-semibold uppercase tracking-[0.22em] text-forest transition-shadow hover:shadow-[0_14px_40px_-16px_rgba(247,244,236,0.5)]"
                        >
                          Shop Now
                          <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                        </Link>
                      </motion.div>

                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-medium text-cream">
                          {formatPrice(product.price)}
                        </span>
                        {product.mrp && (
                          <span className="text-base text-cream/45 line-through">
                            {formatPrice(product.mrp)}
                          </span>
                        )}
                        {discountPct(product) > 0 && (
                          <span className="rounded-full bg-gold/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
                            {discountPct(product)}% Off
                          </span>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Trust points */}
              <div className="space-y-6 md:border-l md:border-white/10 md:pl-10">
                {TRUST_POINTS.map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-sage" strokeWidth={1.5} />
                    <span className="text-sm text-cream/85">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
