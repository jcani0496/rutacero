'use client';

import { useReducedMotion } from 'framer-motion';

/**
 * Wrapper around framer-motion's useReducedMotion that returns a boolean
 * (true when the user prefers reduced motion). Use for conditional animation logic.
 */
export function useReducedMotionSafe(): boolean {
    const prefersReduced = useReducedMotion();
    return Boolean(prefersReduced);
}
