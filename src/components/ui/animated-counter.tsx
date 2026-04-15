'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    className?: string;
}

export function AnimatedCounter({
    value,
    prefix = '',
    suffix = '',
    className = '',
}: AnimatedCounterProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, {
        damping: 50,
        stiffness: 100,
    });
    const isInView = useInView(ref, { once: true, margin: '-100px' });
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (isInView) {
            motionValue.set(value);
        }
    }, [motionValue, isInView, value]);

    useEffect(() => {
        const unsubscribe = springValue.on('change', (latest) => {
            setDisplayValue(Math.round(latest));
        });
        return unsubscribe;
    }, [springValue]);

    return (
        <span ref={ref} className={className}>
            {prefix}
            {displayValue.toLocaleString()}
            {suffix}
        </span>
    );
}
