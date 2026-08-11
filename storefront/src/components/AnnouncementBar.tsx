import { useEffect, useState } from "react";

import { useAnnouncement } from "@/lib/medusa-announcement";

const pad = (n: number) => String(n).padStart(2, "0");

const isExternalUrl = (url: string) =>
  url.startsWith("http://") || url.startsWith("https://");

/** Shared pill styling for both the countdown and the optional link. */
const pillClasses =
  "rounded-full border border-white/15 bg-white/10 px-3 py-[3px] text-[10px] font-medium tabular-nums tracking-[0.14em] text-sage";

/**
 * Client-side countdown to a target date. Returns null until mounted so the
 * server markup (placeholder) matches the first client render — no hydration
 * mismatch, then the tick starts after mount. A null target (countdown
 * disabled or unconfigured) never ticks.
 */
function useCountdown(target: Date | null) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (now === null || target === null) return null;

  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  return `${pad(days)}d : ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
}

export function AnnouncementBar() {
  const { text, endsAt, showCountdown, link } = useAnnouncement();
  const countdown = useCountdown(showCountdown ? endsAt : null);

  return (
    <div className="border-b border-white/5 bg-forest">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-3 px-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-cream/90 md:text-[11px]">
          {text}
        </p>
        {showCountdown && endsAt ? (
          <span
            aria-label="Time remaining until the pre-launch sale ends"
            className={pillClasses}
          >
            {countdown ?? "00d : 00h : 00m : 00s"}
          </span>
        ) : link ? (
          <a
            href={link.url}
            target={isExternalUrl(link.url) ? "_blank" : undefined}
            rel={isExternalUrl(link.url) ? "noopener noreferrer" : undefined}
            className={pillClasses}
          >
            {link.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
