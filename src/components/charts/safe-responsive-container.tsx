'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartDimensions {
    height: number;
    width: number;
}

interface SafeResponsiveContainerProps {
    children: ReactNode | ((dimensions: ChartDimensions) => ReactNode);
    className: string;
}

export function SafeResponsiveContainer({
    children,
    className,
}: SafeResponsiveContainerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [dimensions, setDimensions] = useState<ChartDimensions | null>(null);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const updateDimensions = () => {
            const { width, height } = element.getBoundingClientRect();
            const nextWidth = Math.round(width);
            const nextHeight = Math.round(height);

            if (nextWidth <= 0 || nextHeight <= 0) {
                setDimensions(null);
                return;
            }

            setDimensions((current) => {
                if (current?.width === nextWidth && current.height === nextHeight) {
                    return current;
                }

                return { width: nextWidth, height: nextHeight };
            });
        };

        updateDimensions();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateDimensions);
            return () => window.removeEventListener('resize', updateDimensions);
        }

        const observer = new ResizeObserver(updateDimensions);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const content =
        dimensions == null
            ? null
            : typeof children === 'function'
                ? children(dimensions)
                : children;

    return (
        <div ref={containerRef} className={cn('min-w-0', className)}>
            {content}
        </div>
    );
}
