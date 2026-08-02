import type { ReactNode } from "react";

export function PageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <section className="border-b border-border bg-secondary/60">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          {eyebrow && (
            <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">{eyebrow}</p>
          )}
          <h1 className="mt-3 text-4xl md:text-5xl">{title}</h1>
          {intro && <p className="mt-4 text-muted-foreground">{intro}</p>}
        </div>
      </section>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-14 text-[15px] leading-relaxed text-foreground/90">
        {children}
      </div>
    </>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl">{heading}</h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}