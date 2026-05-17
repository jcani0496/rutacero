'use client';

import { useEffect, useState, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll } from 'framer-motion';

export interface ScrollWordRotatorProps {
    /** Ordered list of full phrases to cycle through as the user scrolls. */
    words: string[];
    /** Ref to the scroll container (typically the hero <section>). */
    targetRef: RefObject<HTMLElement | null>;
    /** Optional className applied to each rendered word. */
    className?: string;
    /** Crossfade duration between word swaps (ms). */
    crossfadeMs?: number;
}

/**
 * Scroll-driven word rotator. Words are tied to user scroll progress through
 * `targetRef` — never to a timer — so phrases are always full strings and
 * never caught mid-letter. Replaces the timer-based Typewriter in surfaces
 * where deterministic, scroll-linked reveal is desired.
 *
 * Reduced-motion users see only the first word as static text.
 */
export function ScrollWordRotator({
    words,
    targetRef,
    className = '',
    crossfadeMs = 350,
}: ScrollWordRotatorProps) {
    const prefersReducedMotion = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ['start start', 'end start'],
    });

    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (prefersReducedMotion) return;
        if (!words.length) return;

        const unsubscribe = scrollYProgress.on('change', (progress) => {
            const next = Math.min(
                words.length - 1,
                Math.max(0, Math.floor(progress * words.length)),
            );
            setIndex((current) => (current === next ? current : next));
        });

        return () => {
            unsubscribe();
        };
    }, [prefersReducedMotion, scrollYProgress, words.length]);

    if (!words.length) return null;

    if (prefersReducedMotion) {
        return <span className={className}>{words[0]}</span>;
    }

    const duration = crossfadeMs / 1000;

    return (
        <span className="inline-block relative align-baseline">
            {/* Invisible sizer keeps layout stable across word swaps. */}
            <span className="invisible" aria-hidden="true">
                {words.reduce((longest, word) => (word.length > longest.length ? word : longest), '')}
            </span>
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration, ease: 'easeOut' }}
                    className={`absolute inset-0 ${className}`}
                >
                    {words[index]}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}
