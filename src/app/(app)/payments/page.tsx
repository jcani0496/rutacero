import { redirect } from "next/navigation";
import { getPayments, getPaymentStats, getDebtsForPayment, getTotalPaymentCount } from "@/lib/actions/payments";
import { getCurrentUserProfile } from "@/lib/actions/profile";
import { getActivePlan, getPlanItems } from "@/lib/actions/plans";
import { PaymentsClient } from "./payments-client";
import { getActiveSubscriptionForTenant, requireUserTenant } from "@/lib/tenant/server";
import { resolveNextPlanPayment, type PlanPaymentHint } from "@/lib/plans/next-payment";

export const metadata = {
    title: "Pagos | RutaCero",
    description: "Historial de pagos realizados",
};

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    let tenantId;
    try {
        ({ tenantId } = await requireUserTenant());
    } catch {
        redirect("/login");
    }

    const resolvedSearchParams = await searchParams;
    const profile = await getCurrentUserProfile();
    const userCurrency = profile?.currency_base || "GTQ";

    const subscription = await getActiveSubscriptionForTenant(tenantId);
    const planCode = subscription?.plan_code || "FREE";
    const isPro = planCode === "PRO" || planCode === "BUSINESS";

    // Fetch payments, stats, debts, and hidden count
    const [paymentsResult, stats, debts, paymentCounts, activePlan] = await Promise.all([
        getPayments(),
        getPaymentStats(),
        getDebtsForPayment(),
        getTotalPaymentCount(),
        getActivePlan(),
    ]);

    let planHint: PlanPaymentHint | null = null;
    if (activePlan) {
        try {
            const items = await getPlanItems(activePlan.id);
            const focusDebtId =
                activePlan.assumptions &&
                typeof activePlan.assumptions === "object" &&
                "focusDebtId" in activePlan.assumptions
                    ? (activePlan.assumptions as { focusDebtId?: string }).focusDebtId
                    : undefined;
            planHint = resolveNextPlanPayment(items, focusDebtId);
        } catch {
            planHint = null;
        }
    }

    const pick = (key: string) => {
        const raw = resolvedSearchParams[key];
        return Array.isArray(raw) ? raw[0] : raw;
    };

    const queryDebtId = pick("debtId") || undefined;
    const queryAmountRaw = pick("amount");
    const queryAmount = queryAmountRaw ? Number(queryAmountRaw) : undefined;
    const fromPlan = pick("fromPlan") === "1";

    // getPayments without pagination returns array, with pagination returns PaginatedResponse
    const payments = Array.isArray(paymentsResult) ? paymentsResult : paymentsResult.data;

    return (
        <PaymentsClient
            initialPayments={payments}
            stats={stats}
            debts={debts}
            userCurrency={userCurrency}
            isPro={isPro}
            hiddenPaymentsCount={paymentCounts.hidden}
            planHint={planHint}
            prefill={{
                debtId: queryDebtId,
                amount:
                    queryAmount && Number.isFinite(queryAmount) && queryAmount > 0
                        ? queryAmount
                        : undefined,
                fromPlan,
            }}
        />
    );
}
