import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";

const socials = [
  { label: "Instagram", href: "https://instagram.com/dailydrip", Icon: Instagram },
  { label: "Facebook", href: "https://facebook.com/dailydrip", Icon: Facebook },
  { label: "YouTube", href: "https://youtube.com/@dailydrip", Icon: Youtube },
  { label: "X (Twitter)", href: "https://x.com/dailydrip", Icon: Twitter },
  { label: "LinkedIn", href: "https://linkedin.com/company/dailydrip", Icon: Linkedin },
];

export function Footer() {
  return (
    <footer className="mt-24 bg-deep text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="font-display text-2xl">
            Daily<span className="text-accent">Drip</span>
          </p>
          <p className="mt-3 text-sm text-primary-foreground/70">
            Clean, dermatologist-tested skin and hair care made in India. Honest formulas,
            full ingredient lists, no empty promises.
          </p>
          <div className="mt-5 flex gap-2">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="grid size-9 place-items-center rounded-full border border-primary-foreground/20 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm tracking-widest uppercase text-accent">Company</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-primary-foreground/80">
            <li><Link to="/about" className="hover:text-accent">About Us</Link></li>
            <li><Link to="/our-story" className="hover:text-accent">Our Story / Our Values</Link></li>
            <li><Link to="/blogs" className="hover:text-accent">Blogs</Link></li>
            <li><Link to="/how-to-use" className="hover:text-accent">How to Use</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm tracking-widest uppercase text-accent">Support</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-primary-foreground/80">
            <li><Link to="/track-order" className="hover:text-accent">Track Order</Link></li>
            <li><Link to="/shipping-policy" className="hover:text-accent">Shipping Policy</Link></li>
            <li><Link to="/returns" className="hover:text-accent">Return &amp; Refund Policy</Link></li>
            <li><Link to="/privacy" className="hover:text-accent">Privacy Notice</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm tracking-widest uppercase text-accent">Reach us</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-primary-foreground/80">
            <li>Daily Drip Wellness Pvt. Ltd.</li>
            <li>4th Floor, Prestige Atrium, Bengaluru 560001</li>
            <li><a href="mailto:care@dailydrip.in" className="hover:text-accent">care@dailydrip.in</a></li>
            <li><a href="tel:+918000112233" className="hover:text-accent">+91 80001 12233</a></li>
            <li className="text-primary-foreground/60">Mon–Sat, 9 AM – 7 PM IST</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-primary-foreground/60">
          <p>© {new Date().getFullYear()} Daily Drip Wellness Pvt. Ltd. All rights reserved.</p>
          <p>GSTIN 29AABCD1234E1Z5 · CIN U24246KA2021PTC123456</p>
        </div>
      </div>
    </footer>
  );
}