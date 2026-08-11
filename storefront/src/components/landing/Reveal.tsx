import { motion } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Horizontal drift on entry (px). Negative moves right-to-left. */
  x?: number;
};

/**
 * Subtle fade-up wrapper used across the landing page. Animates once, when
 * the element scrolls into view, and never again (viewport once).
 */
export function Reveal({ children, className, delay = 0, x = 0 }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
