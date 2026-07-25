import { redirect } from "next/navigation";
import { getIncomes, getExpenses, getBudgetTargets } from "@/lib/actions/finances";
import { getCurrentUserProfile } from "@/lib/actions/profile";
import { getAppUser } from "@/lib/auth/session";
import { FinancesClient } from "./finances-client";

export const metadata = {
    title: "Finanzas | RutaCero",
    description: "Administra tus ingresos y gastos",
};

export default async function FinancesPage() {
    const appUser = await getAppUser();
    if (!appUser) {
        redirect("/login");
    }

    const profile = await getCurrentUserProfile();
    const userCurrency = profile?.currency_base || "GTQ";

    // Fetch incomes, expenses, and budget targets
    const [incomes, expenses, budgetTargets] = await Promise.all([
        getIncomes(),
        getExpenses(),
        getBudgetTargets(),
    ]);

    return (
        <FinancesClient
            initialIncomes={incomes}
            initialExpenses={expenses}
            initialBudgetTargets={budgetTargets}
            userCurrency={userCurrency}
        />
    );
}
