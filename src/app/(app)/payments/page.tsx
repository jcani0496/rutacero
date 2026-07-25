import { redirect } from "next/navigation";
import { getPayments, getPaymentStats, getDebtsForPayment, getTotalPaymentCount } from "@/lib/actions/payments";
import { getCurrentUserProfile } from "@/lib/actions/profile";
import { PaymentsClient } from "./payments-client";
import { requireUserTenant } from "@/lib/tenant/server";

export const metadata = {
    title: "Pagos | RutaCero",
    description: "Historial de pagos realizados",
};

export default async function PaymentsPage() {
    let supabase, tenantId;
    try {
        ({ supabase, tenantId } = await requireUserTenant());
    } catch {
        redirect("/login");
    }

    const profile = await getCurrentUserProfile();
    const userCurrency = profile?.currency_base || "GTQ";

    // Subscriptions stay on PostgREST until F3g (funnel/billing).
    const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_code, status")
        .eq("tenant_id", tenantId)
        .eq("status", "ACTIVE")
        .single();

    const planCode = subscription?.plan_code || "FREE";
    const isPro = planCode === "PRO" || planCode === "BUSINESS";

    // Fetch payments, stats, debts, and hidden count
    const [paymentsResult, stats, debts, paymentCounts] = await Promise.all([
        getPayments(),
        getPaymentStats(),
        getDebtsForPayment(),
        getTotalPaymentCount(),
    ]);

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
        />
    );
}

