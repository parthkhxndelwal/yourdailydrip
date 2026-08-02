// Checkout step indicator (address → payment).

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckoutStep = "address" | "payment";

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "payment", label: "Payment" },
];

export function StepIndicator({ current }: { current: CheckoutStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-wrap items-center gap-3">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s.key} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check size={14} /> : i + 1}
            </span>
            <span className={cn("text-sm", active ? "font-medium" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
