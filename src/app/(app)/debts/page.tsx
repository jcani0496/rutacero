import { redirect } from "next/navigation";
import { getDebts } from "@/lib/actions/debts";
import { getCurrentUserProfile } from "@/lib/actions/profile";
import { DebtsClient } from "./debts-client";
import { requireUserTenant } from "@/lib/tenant/server";

export const metadata = {
  title: "Mis Deudas | RutaCero",
  description: "Administra y da seguimiento a todas tus deudas",
};

export default async function DebtsPage() {
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
