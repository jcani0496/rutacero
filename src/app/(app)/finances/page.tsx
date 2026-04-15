import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getIncomes, getExpenses, getBudgetTargets } from "@/lib/actions/finances";
import { FinancesClient } from "./finances-client";

export const metadata = {
    title: "Finanzas | RutaCero",
    description: "Administra tus ingresos y gastos",
};

export default async function FinancesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch user profile for currency preference
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("currency_base")
        .eq("user_id", user.id)
        .single();

    const userCurrency = (profile as { currency_base: string } | null)?.currency_base || "GTQ";

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
