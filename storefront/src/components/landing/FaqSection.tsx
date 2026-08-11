import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "./Reveal";

const FAQS = [
  {
    q: "What is the Advanced Hair Density Serum?",
    a: "A leave-on scalp serum built around 14 science-backed actives — Procapil®, Redensyl®, Anagain™ and more — formulated to strengthen roots and support visibly denser, healthier-looking hair with daily use.",
  },
  {
    q: "How do I use it?",
    a: "Apply 4–6 drops to a dry or slightly damp scalp, massage in for about a minute and leave on. No rinsing required. Use once daily — ideally at night — and stay consistent.",
  },
  {
    q: "When will my pre-order ship?",
    a: "Pre-orders ship before launch day, in the order they were placed. You'll get a tracking link by email the moment your bottle leaves our warehouse.",
  },
  {
    q: "Is it safe for daily use and all hair types?",
    a: "Yes. It's dermatologically tested, free of sulfates, parabens and silicones, and formulated for straight, wavy, curly and coily hair. If you have a sensitive scalp, do a small patch test first.",
  },
  {
    q: "What if I don't see results?",
    a: "Hair cycles take time — commit to at least 90 days of consistent use. And if you're not happy within 30 days of receiving your order, write to us and we'll refund you in full. No questions asked.",
  },
  {
    q: "Is it really free of sulfates, parabens and silicones?",
    a: "Completely. Every ingredient is listed on the pack and on this page at meaningful percentages — no hidden fillers, no fine print.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faqs" className="scroll-mt-28 bg-cream-soft py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <Reveal>
          <h2 className="text-center font-display text-3xl text-charcoal md:text-4xl">
            Questions, answered.
          </h2>
          <p className="mt-3 text-center text-forest/60">
            Everything you need to know before you pre-order.
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
