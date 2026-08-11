import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";

const socials = [
  { label: "Instagram", href: "https://instagram.com/dailydrip", Icon: Instagram },
  { label: "Facebook", href: "https://facebook.com/dailydrip", Icon: Facebook },
  { label: "YouTube", href: "https://youtube.com/@dailydrip", Icon: Youtube },
  { label: "X (Twitter)", href: "https://x.com/dailydrip", Icon: Twitter },
  { label: "LinkedIn", href: "https://linkedin.com/company/dailydrip", Icon: Linkedin },
];

const shopLinks = [
  { label: "All Products", to: "/shop", hash: undefined as string | undefined },
  { label: "Haircare", to: "/hair-care", hash: undefined },
  { label: "Ingredients", to: "/", hash: "ingredients" },
];

const companyLinks = [
  { label: "Our Story", to: "/our-story", hash: undefined as string | undefined },
  { label: "Blog", to: "/blogs", hash: undefined },
];

const helpLinks = [
  { label: "FAQs", to: "/", hash: "faqs" },
  { label: "Shipping & Returns", to: "/shipping-policy", hash: undefined as string | undefined },
  { label: "Terms & Conditions", to: "/terms", hash: undefined },
];

function LinkRow({ links }: { links: typeof shopLinks }) {
  return (
    <ul className="mt-5 space-y-3 text-sm text-cream/70">
      {links.map(({ label, to, hash }) => (
        <li key={label}>
          <Link to={to} hash={hash} className="transition-colors duration-200 hover:text-sage">
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Newsletter() {
  const [subscribed, setSubscribed] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubscribed(true);
  }

  return (
    <div className="border-t border-cream/10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 md:flex-row md:items-end">
        <div>
          <h3 className="font-display text-lg tracking-[0.2em] text-cream uppercase">
            Stay in the know
          </h3>
          <p className="mt-2 text-sm text-cream/60">
            Get early access to launches, offers and haircare tips.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex w-full max-w-sm items-center gap-3">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            placeholder="Your email"
            className="h-11 flex-1 rounded-full border border-cream/20 bg-cream/5 px-5 text-sm text-cream placeholder:text-cream/40 focus:border-sage/60 focus:ring-2 focus:ring-sage/40 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Subscribe"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-cream/20 text-sage transition-colors duration-200 hover:border-sage/60 hover:bg-sage/10"
          >
            <ArrowRight size={16} />
          </button>
        </form>
        {subscribed && <p className="text-sm text-sage md:w-40">You're on the list.</p>}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-forest text-cream">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-10">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:pr-8">
            <p className="font-display text-2xl tracking-[0.08em] text-cream">DAILY DRIP</p>
            <p className="mt-3 text-[11px] tracking-[0.3em] text-sage uppercase">
              Science. Nature. Daily.
            </p>
            <p className="mt-5 text-sm leading-relaxed text-cream/60">
              Dermatologist-tested skin and hair care made in India — honest formulas, full
              ingredient lists, no empty promises.
            </p>
            <div className="mt-6 flex gap-2.5">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-full border border-cream/20 text-cream/70 transition-colors duration-200 hover:border-sage/60 hover:text-sage"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
            <p className="mt-6 text-xs leading-relaxed text-cream/40">
              care@dailydrip.in · +91 80001 12233
              <br />
              Bengaluru, India
            </p>
          </div>

          <div>
            <h3 className="font-display text-xs tracking-[0.25em] text-gold uppercase">Shop</h3>
            <LinkRow links={shopLinks} />
          </div>

          <div>
            <h3 className="font-display text-xs tracking-[0.25em] text-gold uppercase">Company</h3>
            <ul className="mt-5 space-y-3 text-sm text-cream/70">
              {companyLinks.map(({ label, to, hash }) => (
                <li key={label}>
                  <Link
                    to={to}
                    hash={hash}
                    className="transition-colors duration-200 hover:text-sage"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="mailto:care@dailydrip.in"
                  className="transition-colors duration-200 hover:text-sage"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xs tracking-[0.25em] text-gold uppercase">Help</h3>
            <LinkRow links={helpLinks} />
          </div>
        </div>

        <Newsletter />

        <div className="mt-6 border-t border-cream/10 pt-6">
          <p className="text-xs text-cream/40">
            © {new Date().getFullYear()} Daily Drip. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
