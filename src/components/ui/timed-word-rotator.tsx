'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface TimedWordRotatorProps {
    /** Ordered list of full phrases to cycle through on a timer. */
    words: string[];
    /** Optional className applied to each rendered word. */
    className?: string;
    /** Milliseconds each word stays visible before crossfading. */
    intervalMs?: number;
    /** Crossfade transition duration (ms). */
    crossfadeMs?: number;
}

/**
 * Timer-driven word rotator with crossfade transitions.
 *
 * Replaces the prior ScrollWordRotator. The scroll-driven approach had a real
 * UX bug: by the time the user scrolled enough to reach the next word, the
 * hero (and the rotating headline) was already leaving the viewport. Words
 * past the first were effectively invisible.
 *
 * This component cycles words on a timer (default 3s per word) with a
 * full-string crossfade — never letter-by-letter — so phrases are always
 * complete and screenshots never catch a glyph mid-typing.
 *
 * Reduced-motion users see only the first word as static text and no
 * animation runs.
 */
export function TimedWordRotator({
    words,
    className = '',
    intervalMs = 3000,
    crossfadeMs = 350,
}: TimedWordRotatorProps) {
    const prefersReducedMotion = useReducedMotion();
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (prefersReducedMotion) return;
        if (words.length <= 1) return;

        const id = window.setInterval(() => {
            setIndex((current) => (current + 1) % words.length);
        }, intervalMs);

        return () => {
            window.clearInterval(id);
        };
    }, [prefersReducedMotion, words.length, intervalMs]);

    if (!words.length) return null;

    if (prefersReducedMotion) {
        return <span className={className}>{words[0]}</span>;
    }

    const duration = crossfadeMs / 1000;

    return (
        <span className="inline-block relative align-baseline">
            {/* Invisible sizer keeps layout stable across word swaps so the H1
                doesn't reflow when phrases of different widths cycle. */}
            <span className="invisible" aria-hidden="true">
                {words.reduce(
                    (longest, word) => (word.length > longest.length ? word : longest),
                    '',
                )}
            </span>
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration, ease: 'easeOut' }}
                    className={`absolute inset-0 ${className}`}
                    aria-live="polite"
                >
                    {words[index]}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}
