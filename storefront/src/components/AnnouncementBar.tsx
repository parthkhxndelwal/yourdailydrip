const messages = [
  "Shipping rates calculated at checkout from your pincode",
  "FLAT 20% off your first order — code DRIP20",
  "Buy any 2 hair care products, get a scalp massager free",
  "Dermatologist tested · Cruelty free · Made in India",
  "Same-day dispatch on orders placed before 4 PM",
];

export function AnnouncementBar() {
  const loop = [...messages, ...messages];
  return (
    <div className="overflow-hidden bg-deep py-2.5 text-primary-foreground">
      <div className="marquee-track flex w-max gap-12 whitespace-nowrap">
        {loop.map((m, i) => (
          <span
            key={i}
            className="flex items-center gap-3 text-xs font-medium tracking-wide uppercase"
          >
            <span className="text-accent">✦</span>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}