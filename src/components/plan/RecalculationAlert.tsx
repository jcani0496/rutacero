'use client';

import { useState, useTransition } from 'react';
import {
    ArrowClockwise,
    CaretDown,
    CaretUp,
    Warning,
    X
} from '@phosphor-icons/react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface RecalculationAlertProps {
    needsRecalculation: boolean;
    reasons: string[];
    lastPlanDate: string | null;
    onRecalculate: () => Promise<void>;
}

export function RecalculationAlert({
    needsRecalculation,
    reasons,
    lastPlanDate,
    onRecalculate,
}: RecalculationAlertProps) {
    const [dismissed, setDismissed] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [isPending, startTransition] = useTransition();

    if (!needsRecalculation || dismissed) {
        return null;
    }

    const handleRecalculate = () => {
        startTransition(async () => {
            await onRecalculate();
        });
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    return (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <Warning className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
                <AlertTitle className="text-amber-700 dark:text-amber-400 flex items-center justify-between">
                    <span>Tu plan puede estar desactualizado</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-amber-600 hover:text-amber-700"
                        onClick={() => setDismissed(true)}
                        aria-label="Descartar aviso de recálculo"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </AlertTitle>
                <div className="text-sm text-amber-600 dark:text-amber-300 space-y-3">
                    <p className="leading-relaxed">
                        {lastPlanDate
                            ? `Tu plan fue creado el ${formatDate(lastPlanDate)}. Desde entonces ha habido cambios.`
                            : 'Se detectaron cambios en tus finanzas que podrían afectar tu plan.'
                        }
                    </p>

                    <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium hover:underline">
                            {showDetails ? (
                                <>
                                    <CaretUp className="h-4 w-4" />
                                    Ocultar detalles
                                </>
                            ) : (
                                <>
                                    <CaretDown className="h-4 w-4" />
                                    Ver qué cambió ({reasons.length})
                                </>
                            )}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                            <ul className="space-y-1 text-sm">
                                {reasons.map((reason, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                        <span className="text-amber-500">•</span>
                                        {reason}
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleContent>
                    </Collapsible>

                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={handleRecalculate}
                            disabled={isPending}
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isPending ? (
                                <>
                                    <ArrowClockwise className="mr-2 h-4 w-4 animate-spin" />
                                    Recalculando...
                                </>
                            ) : (
                                <>
                                    <ArrowClockwise className="mr-2 h-4 w-4" />
                                    Recalcular Plan
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDismissed(true)}
                            className="border-amber-500/50 text-amber-700 hover:bg-amber-100"
                        >
                            Ahora no
                        </Button>
                    </div>
                </div>
            </div>
        </Alert>
    );
}
