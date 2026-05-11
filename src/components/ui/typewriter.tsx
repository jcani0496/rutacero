'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe';

interface TypewriterProps {
    words: string[];
    typingSpeed?: number;
    deletingSpeed?: number;
    pauseDuration?: number;
    className?: string;
    cursorClassName?: string;
}

export function Typewriter({
    words,
    typingSpeed = 100,
    deletingSpeed = 50,
    pauseDuration = 2000,
    className = '',
    cursorClassName = '',
}: TypewriterProps) {
    const reduced = useReducedMotionSafe();
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [currentText, setCurrentText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        // Skip animation entirely when reduced motion is preferred or user paused.
        if (reduced || paused) return;

        const currentWord = words[currentWordIndex];

        const timeout = setTimeout(() => {
            if (!isDeleting) {
                // Typing
                if (currentText.length < currentWord.length) {
                    setCurrentText(currentWord.slice(0, currentText.length + 1));
                } else {
                    // Pause at end of word
                    setTimeout(() => setIsDeleting(true), pauseDuration);
                }
            } else {
                // Deleting
                if (currentText.length > 0) {
                    setCurrentText(currentText.slice(0, -1));
                } else {
                    setIsDeleting(false);
                    setCurrentWordIndex((prev) => (prev + 1) % words.length);
                }
            }
        }, isDeleting ? deletingSpeed : typingSpeed);

        return () => clearTimeout(timeout);
    }, [
        reduced,
        paused,
        currentText,
        isDeleting,
        currentWordIndex,
        words,
        typingSpeed,
        deletingSpeed,
        pauseDuration,
    ]);

    // Reduced motion: render the first word statically, no cursor blink, no controls.
    if (reduced) {
        return <span className={className}>{words[0]}</span>;
    }

    return (
        <span className={className}>
            {currentText}
            <motion.span
                className={cursorClassName}
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                aria-hidden="true"
            >
                |
            </motion.span>
            <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="ml-2 align-middle text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                aria-label={paused ? 'Reanudar animación' : 'Pausar animación'}
                aria-pressed={paused}
            >
                <span aria-hidden="true">{paused ? '▶' : '⏸'}</span>
            </button>
        </span>
    );
}
