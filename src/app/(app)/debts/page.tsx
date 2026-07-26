import { redirect } from "next/navigation";
import { getDebts } from "@/lib/actions/debts";
import { getCurrentUserProfile } from "@/lib/actions/profile";
import { DebtsClient } from "./debts-client";
import { getActiveSubscriptionForTenant, requireUserTenant } from "@/lib/tenant/server";

export const metadata = {
  title: "Mis Deudas | RutaCero",
  description: "Administra y da seguimiento a todas tus deudas",
};

export default async function DebtsPage() {
  let tenantId;
  try {
    ({ tenantId } = await requireUserTenant());
  } catch {
    redirect("/login");
  }

  const profile = await getCurrentUserProfile();
  const userCurrency = profile?.currency_base || "GTQ";

  const subscription = await getActiveSubscriptionForTenant(tenantId);
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
