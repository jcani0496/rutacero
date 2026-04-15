'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

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
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [currentText, setCurrentText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
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
    }, [currentText, isDeleting, currentWordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

    return (
        <span className={className}>
            {currentText}
            <motion.span
                className={cursorClassName}
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
            >
                |
            </motion.span>
        </span>
    );
}
