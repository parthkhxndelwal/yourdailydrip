import { Reveal } from "./Reveal";

export function BrandStatement() {
  return (
    <section className="bg-forest py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
        <Reveal>
          <img
            src="/dailydrip_logo.png"
            alt="Daily Drip"
            className="mx-auto h-14 w-auto brightness-0 invert"
            loading="lazy"
            decoding="async"
          />
          <h2 className="mt-8 font-display text-2xl leading-tight tracking-[0.2em] text-cream md:text-3xl">
            SCIENCE. NATURE. DAILY.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cream/85 md:text-lg">
            Advanced hair &amp; skincare, made for everyday routines.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-cream/60 md:text-[15px]">
            Thoughtfully formulated in India with globally developed actives, transparent
            ingredient lists, and no unnecessary hype.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
