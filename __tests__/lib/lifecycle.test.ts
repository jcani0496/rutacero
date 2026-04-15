import {
    buildLifecycleTriggers,
    calculateDaysUntilDue,
    getIsoWeekKey,
    type LifecycleUserSnapshot,
} from '@/lib/lifecycle';

function buildSnapshot(overrides: Partial<LifecycleUserSnapshot> = {}): LifecycleUserSnapshot {
    return {
        userId: 'user-1',
        tenantId: 'tenant-1',
        onboardingCompleted: true,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
        lastActiveAt: null,
        debts: [
            {
                id: 'debt-1',
                creditor: 'Banco Uno',
                balance: 1200,
                currency: 'GTQ',
                minPayment: 250,
                dueDay: 10,
            },
        ],
        plans: [
            {
                createdAt: '2026-04-02T12:00:00.000Z',
                etaDebtFree: '2026-12-01',
                avgPayment: 300,
            },
        ],
        paymentsLast7d: [
            {
                amount: 250,
                paymentDate: '2026-04-04',
            },
        ],
        ...overrides,
    };
}

describe('lifecycle orchestration helpers', () => {
    it('calculates same-month overdue days without rolling to next month', () => {
        const now = new Date('2026-04-12T12:00:00.000Z');
        expect(calculateDaysUntilDue(10, now)).toBe(-2);
    });

    it('creates onboarding nudges for incomplete onboarding in the first three days', () => {
        const snapshot = buildSnapshot({
            onboardingCompleted: false,
            plans: [],
            debts: [],
            createdAt: '2026-04-03T10:00:00.000Z',
        });

        const triggers = buildLifecycleTriggers(snapshot, new Date('2026-04-05T09:00:00.000Z'));

        expect(triggers).toEqual([
            expect.objectContaining({
                campaign: 'ONBOARDING_NUDGE',
                dedupeKey: 'onboarding-nudge:day-2',
            }),
        ]);
    });

    it('creates a first-plan reminder when onboarding is complete but no plan exists', () => {
        const snapshot = buildSnapshot({
            plans: [],
            createdAt: '2026-04-02T10:00:00.000Z',
        });

        const triggers = buildLifecycleTriggers(snapshot, new Date('2026-04-05T09:00:00.000Z'));

        expect(triggers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    campaign: 'FIRST_PLAN_REMINDER',
                    dedupeKey: 'first-plan-reminder:day-3',
                }),
            ])
        );
    });

    it('creates weekly progress and overdue nudges independently', () => {
        const snapshot = buildSnapshot({
            debts: [
                {
                    id: 'debt-1',
                    creditor: 'Banco Uno',
                    balance: 1200,
                    currency: 'GTQ',
                    minPayment: 250,
                    dueDay: 4,
                },
            ],
        });

        const now = new Date('2026-04-06T09:00:00.000Z');
        const triggers = buildLifecycleTriggers(snapshot, now);

        expect(triggers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    campaign: 'WEEKLY_PROGRESS',
                    dedupeKey: `weekly-progress:${getIsoWeekKey(now)}`,
                }),
                expect.objectContaining({
                    campaign: 'OVERDUE_NUDGE',
                    dedupeKey: 'overdue-nudge:2026-04-06',
                }),
            ])
        );
    });
});
