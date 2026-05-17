'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealOnMountProps {
  children: ReactNode;
  /** Seconds to wait before this child starts revealing. Use to stagger siblings. */
  delay?: number;
}

/**
 * Subtle, fast fade + 8px rise on mount. ~320ms with a smooth ease-out.
 * Honors prefers-reduced-motion (returns children unwrapped — no motion at all).
 *
 * Designed for stacking on dashboard sections: pass `delay={index * 0.05}`
 * to get a gentle cascade without ever exceeding ~300ms per element.
 */
export function RevealOnMount({ children, delay = 0 }: RevealOnMountProps) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        ease: [0.23, 1, 0.32, 1],
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
