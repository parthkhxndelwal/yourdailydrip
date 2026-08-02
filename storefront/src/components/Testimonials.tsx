import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

import { StarRating } from "./StarRating";

const testimonials = [
  {
    name: "Ishita Verma",
    city: "Bengaluru",
    rating: 5,
    quote:
      "I've tried a dozen vitamin C serums and Daily Drip is the first that didn't sting. Six weeks in, my acne marks have properly faded.",
  },
  {
    name: "Karan Mehta",
    city: "Pune",
    rating: 5,
    quote:
      "The Rooted hair oil washes out in one shampoo — that alone sold me. My hairline has visibly filled in since March.",
  },
  {
    name: "Sneha Iyer",
    city: "Chennai",
    rating: 4,
    quote:
      "Honest ingredient lists, no fake promises. Their support team walked me through a routine for rosacea over chat within minutes.",
  },
  {
    name: "Farhan Qureshi",
    city: "Hyderabad",
    rating: 5,
    quote:
      "Ordered Thursday night, delivered Saturday morning. The barrier cream saved my skin after a bad chemical peel.",
  },
  {
    name: "Divya Nair",
    city: "Kochi",
    rating: 5,
    quote:
      "Everything smells clean and herbal, nothing perfumed. My whole family uses the gentle shampoo now, including my daughter.",
  },
];

export function Testimonials() {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, align: "start" });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    embla.on("select", onSelect);
    onSelect();
    const id = setInterval(() => embla.scrollNext(), 5000);
    return () => clearInterval(id);
  }, [embla, onSelect]);

  return (
    <section className="bg-secondary/60 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">
              Reviews
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl">What Our Customers Say</h2>
          </div>
          <div className="flex gap-2">
            <button
              aria-label="Previous testimonial"
              onClick={() => embla?.scrollPrev()}
              className="grid size-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Next testimonial"
              onClick={() => embla?.scrollNext()}
              className="grid size-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="mt-10 overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {testimonials.map((t) => (
              <div key={t.name} className="min-w-0 shrink-0 basis-full pr-5 md:basis-1/2 lg:basis-1/3">
                <figure className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-6">
                  <Quote className="text-accent" size={22} />
                  <StarRating value={t.rating} />
                  <blockquote className="text-[15px] leading-relaxed text-foreground/90">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-auto pt-2 text-sm">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-muted-foreground"> · {t.city}</span>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {testimonials.map((t, i) => (
            <button
              key={t.name}
              aria-label={`Go to testimonial ${i + 1}`}
              onClick={() => embla?.scrollTo(i)}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === selected ? "w-8 bg-primary" : "w-2.5 bg-border")
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}