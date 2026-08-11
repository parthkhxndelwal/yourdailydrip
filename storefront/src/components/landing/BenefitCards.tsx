import { motion } from "framer-motion";

import pSerum from "@/assets/p-serum.jpg";
import pScalp from "@/assets/p-scalp.jpg";
import pHairOil from "@/assets/p-hairoil.jpg";
import { Reveal } from "./Reveal";

const CARDS = [
  {
    img: pSerum,
    alt: "Frosted glass serum bottle with a dropper",
    title: "Lightweight Non-Sticky",
    body: "Quick absorbent formula.",
  },
  {
    img: pHairOil,
    alt: "Amber glass hair oil bottle with a wooden cap",
    title: "Daily Use Leave-On",
    body: "No rinse required.",
  },
  {
    img: pScalp,
    alt: "Green scalp tonic bottle with a spray pump",
    title: "Precision Roll-On",
    body: "Mess-free application right where it matters.",
  },
] as const;

export function BenefitCards() {
  return (
    <div className="space-y-6">
      {CARDS.map((card, i) => (
        <Reveal key={card.title} delay={0.1 + i * 0.12}>
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center gap-5 rounded-2xl border border-forest/5 bg-white p-5"
            style={{ boxShadow: "0 18px 44px -32px rgba(11,23,16,0.3)" }}
          >
            <img
              src={card.img}
              alt={card.alt}
              className="h-20 w-20 shrink-0 rounded-xl object-cover"
              loading="lazy"
            />
            <div>
              <h3 className="font-medium text-charcoal">{card.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-forest/60">{card.body}</p>
            </div>
          </motion.div>
        </Reveal>
      ))}
    </div>
  );
}
