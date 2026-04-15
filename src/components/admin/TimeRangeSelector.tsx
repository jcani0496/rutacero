'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

const TIME_RANGES = [
    { label: '7D', value: 7, description: 'Última semana' },
    { label: '30D', value: 30, description: 'Último mes' },
    { label: '90D', value: 90, description: 'Últimos 3 meses' },
    { label: '1A', value: 365, description: 'Último año' },
];

interface TimeRangeSelectorProps {
    currentRange?: number;
}

export function TimeRangeSelector({ currentRange = 30 }: TimeRangeSelectorProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleRangeChange = (days: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('range', days.toString());
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
                {TIME_RANGES.map((range) => (
                    <Button
                        key={range.value}
                        variant={currentRange === range.value ? 'secondary' : 'ghost'}
                        size="sm"
                        className={`h-7 px-3 text-xs ${currentRange === range.value
                                ? 'bg-background shadow-sm'
                                : 'hover:bg-background/50'
                            }`}
                        onClick={() => handleRangeChange(range.value)}
                        title={range.description}
                    >
                        {range.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
