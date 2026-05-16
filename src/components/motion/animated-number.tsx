'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  /** The numeric target. */
  value: number;
  /** Optional string prefix preserved verbatim (e.g. "Q"). */
  prefix?: string;
  /** Optional string suffix preserved verbatim (e.g. "%"). */
  suffix?: string;
  /** Use the same locale-aware grouping that the rest of the app does. */
  locale?: string;
  /** Number of fraction digits to render. Defaults to 0 — change for currency w/ decimals. */
  fractionDigits?: number;
  /** Animation duration in seconds. */
  duration?: number;
}

/**
 * Counts from 0 → value on mount with framer-motion's animate(). Honors
 * prefers-reduced-motion by jumping straight to the final value.
 */
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  locale = 'es-GT',
  fractionDigits = 0,
  duration = 0.6,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? value : 0);
  const formatted = useTransform(motionValue, (current) => {
    const rounded = fractionDigits === 0
      ? Math.round(current)
      : Number(current.toFixed(fractionDigits));
    const numberPart = rounded.toLocaleString(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    return `${prefix}${numberPart}${suffix}`;
  });

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration,
      ease: 'easeOut',
    });
    return () => controls.stop();
  }, [motionValue, value, duration, reduced]);

  return <motion.span>{formatted}</motion.span>;
}
