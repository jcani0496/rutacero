/**
 * Faux product chrome for the hero: a stylized "plan" card that looks
 * like a real screen from the app (list of debts + payoff progress),
 * not a decorative illustration. Static SVG-free markup so it stays
 * sharp at any size and costs ~0kb of image weight.
 */
const DEBTS = [
    { creditor: 'Tarjeta BI', note: 'Cuota mínima Q450', amount: 'Q8,240', pct: 62 },
    { creditor: 'Cemaco', note: 'Cuota 6 de 12', amount: 'Q1,380', pct: 50 },
    { creditor: 'El primo', note: 'Préstamo personal', amount: 'Q2,000', pct: 20 },
] as const;

export function PlanMock() {
    return (
        <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(27,24,18,0.04),0_12px_32px_-16px_rgba(27,24,18,0.12)]">
            {/* Faux window chrome */}
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E5DCC6]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#E5DCC6]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#E5DCC6]" />
                <span className="ml-3 text-xs font-medium text-muted-foreground">Tu plan · agosto</span>
            </div>

            <div className="divide-y divide-border">
                {DEBTS.map((debt) => (
                    <div key={debt.creditor} className="flex items-center justify-between gap-4 px-4 py-3.5">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{debt.creditor}</p>
                            <p className="truncate text-xs text-muted-foreground">{debt.note}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="font-money text-sm font-semibold text-foreground">{debt.amount}</span>
                            <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${debt.pct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t border-border px-4 py-4">
                <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Progreso total
                    </span>
                    <span className="font-money text-sm font-semibold text-[var(--rc-teal-text)]">45%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[45%] rounded-full bg-primary" />
                </div>
                <p className="mt-2 font-money text-xs text-muted-foreground">
                    Q5,190 pagado de Q11,620
                </p>
            </div>
        </div>
    );
}
