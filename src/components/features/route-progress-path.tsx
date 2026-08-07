'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Flag
} from '@phosphor-icons/react';

interface RouteProgressPathProps {
    progress: number;
    mood: 'positive' | 'steady' | 'warning';
}

const PATH_D = 'M24,95 C300,10 520,115 776,30';
const CHECKPOINTS = [
    { label: 'Inicio', at: 0.08 },
    { label: 'Hito', at: 0.5 },
    { label: 'RutaCero', at: 0.92 },
];

export function RouteProgressPath({ progress, mood }: RouteProgressPathProps) {
    const pathRef = useRef<SVGPathElement | null>(null);
    const [length, setLength] = useState(0);
    const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
    const [points, setPoints] = useState<Array<{ label: string; at: number; x: number; y: number }>>([]);

    useEffect(() => {
        if (!pathRef.current) return;
        const total = pathRef.current.getTotalLength();
        setLength(total);
        const markerPoint = pathRef.current.getPointAtLength(total * progress);
        const checkpointPoints = CHECKPOINTS.map((checkpoint) => {
            const point = pathRef.current?.getPointAtLength(total * checkpoint.at);
            return {
                ...checkpoint,
                x: point?.x ?? 0,
                y: point?.y ?? 0,
            };
        });
        setMarker({ x: markerPoint.x, y: markerPoint.y });
        setPoints(checkpointPoints);
    }, [progress]);

    const progressLength = Math.max(0, length * progress);

    return (
        <div className="relative h-32 rounded-2xl border border-border bg-secondary p-3">
            <svg viewBox="0 0 800 120" className="h-full w-full">
                <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={mood === 'warning' ? '#B45309' : '#0D9488'} />
                        <stop offset="100%" stopColor={mood === 'warning' ? '#B45309' : '#0F6F65'} />
                    </linearGradient>
                </defs>
                <path
                    d={PATH_D}
                    stroke="rgba(27,24,18,0.12)"
                    strokeWidth="7"
                    fill="none"
                />
                <path
                    ref={pathRef}
                    d={PATH_D}
                    stroke="url(#routeGradient)"
                    strokeWidth="7"
                    strokeDasharray={`${progressLength} ${length || 1}`}
                    strokeDashoffset={0}
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-700"
                />
                {points.map((checkpoint) => {
                    const isActive = progress >= checkpoint.at;
                    return (
                        <g key={checkpoint.label}>
                            <circle
                                cx={checkpoint.x}
                                cy={checkpoint.y}
                                r="6"
                                fill={isActive ? 'rgba(13,148,136,0.9)' : 'rgba(27,24,18,0.15)'}
                                stroke={isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)'}
                                strokeWidth="1.5"
                            />
                            <text
                                x={checkpoint.x}
                                y={checkpoint.y + 20}
                                textAnchor="middle"
                                fill="rgba(107,99,87,0.9)"
                                fontSize="9"
                                letterSpacing="0.25em"
                                dominantBaseline="hanging"
                            >
                                {checkpoint.label.toUpperCase()}
                            </text>
                        </g>
                    );
                })}
                {marker && (
                    <g>
                        <circle
                            cx={marker.x}
                            cy={marker.y}
                            r="12"
                            fill="rgba(13,148,136,0.18)"
                            className="animate-ping"
                            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
                        />
                        <circle
                            cx={marker.x}
                            cy={marker.y}
                            r="6"
                            fill="rgba(13,148,136,0.9)"
                            stroke="rgba(255,255,255,0.9)"
                            strokeWidth="1.5"
                        />
                    </g>
                )}
            </svg>
            <div className="absolute right-4 top-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Flag className="h-4 w-4 text-warning" />
                {mood === 'warning' ? 'Ritmo bajo' : mood === 'positive' ? 'Ruta fuerte' : 'Ritmo estable'}
            </div>
        </div>
    );
}
