import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "./Reveal";

const FAQS = [
  {
    q: "What is Daily Drip Hair Growth Actives?",
    a: "A leave-on scalp roll-on powered by 18% Hair Growth Actives and our 360° Follicle Science Technology, formulated to support scalp health, stronger roots and fuller-looking, healthier hair.",
  },
  {
    q: "What makes the formula different?",
    a: "It combines 7 globally patented actives with a targeted blend of advanced hair-care ingredients, including Procapil®, Redensyl®, Anagain™, Capilia Longa®, Baicapil® and more.",
  },
  {
    q: "How do I use it?",
    a: "Part your hair to expose the scalp, roll the applicator directly onto the target areas for 2 minutes, use twice daily, and leave it on to absorb naturally.",
  },
  {
    q: "Is it suitable for all scalp types?",
    a: "The product is labelled as suitable for all scalp types. If you have a sensitive scalp or existing scalp condition, consider a patch test before use.",
  },
  {
    q: "When can I expect to see results?",
    a: "Hair and scalp routines require consistency. Results can vary from person to person, so regular use as directed is important.",
  },
  {
    q: "Is it non-comedogenic and cruelty-free?",
    a: "Yes — these are claims displayed on the product packaging.",
  },
  {
    q: "Is Daily Drip dermatologist recommended?",
    a: "Yes, the product packaging carries the Dermatologist Recommended claim.",
  },
  {
    q: "When will my pre-order ship?",
    a: "Pre-orders will be dispatched after launch. Delivery timelines vary by pincode and courier serviceability. You’ll receive tracking details once your order is shipped.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faqs" className="scroll-mt-28 bg-cream-soft py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <Reveal>
          <h2 className="text-center font-display text-3xl text-charcoal md:text-4xl">
            Everything You Need to Know.
          </h2>
          <p className="mt-3 text-center text-forest/60">
            Your Daily Drip questions, answered.
          </p>

          <Accordion type="single" collapsible className="mt-10">
            {FAQS.map(({ q, a }) => (
              <AccordionItem key={q} value={q} className="border-forest/10">
                <AccordionTrigger className="py-5 text-[15px] font-medium text-charcoal hover:no-underline">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-forest/70">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
