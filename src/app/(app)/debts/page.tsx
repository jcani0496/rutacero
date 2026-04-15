import { redirect } from "next/navigation";
import { getDebts } from "@/lib/actions/debts";
import { DebtsClient } from "./debts-client";
import { requireUserTenant } from "@/lib/tenant/server";

export const metadata = {
  title: "Mis Deudas | RutaCero",
  description: "Administra y da seguimiento a todas tus deudas",
};

export default async function DebtsPage() {
  let supabase, user, tenantId;
  try {
    ({ supabase, user, tenantId } = await requireUserTenant());
  } catch {
    redirect("/login");
  }

  // Fetch user profile for currency preference
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("currency_base")
    .eq("user_id", user.id)
    .single();

  const userCurrency = (profile as { currency_base: string } | null)?.currency_base || "GTQ";

  // Fetch subscription status
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .eq("tenant_id", tenantId)
    .eq("status", "ACTIVE")
    .single();

  const planCode = subscription?.plan_code || "FREE";
  const isPro = planCode === "PRO" || planCode === "BUSINESS";

  // Fetch debts
  const debtsResult = await getDebts("ACTIVE");

  // getDebts without pagination returns Debt[], with pagination returns PaginatedResponse
  const debts = Array.isArray(debtsResult) ? debtsResult : debtsResult.data;

  return (
    <DebtsClient
      initialDebts={debts}
      userCurrency={userCurrency}
      isPro={isPro}
    />
  );
}
