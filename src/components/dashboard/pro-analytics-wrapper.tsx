import { createClient } from "@/lib/supabase/server";
import {
  getUserSubscription,
  getPaymentHistory,
  getDebtDistribution,
  getDebtProjection,
  getInterestSavings,
  getFinancialIndicators,
} from "@/lib/actions/dashboard-analytics";
import { ProAnalytics } from "@/components/dashboard/pro-analytics";

export async function ProAnalyticsWrapper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Check subscription first
  const { isPro } = await getUserSubscription();

  if (!isPro) return null;

  // Fetch currency preference
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("currency_base")
    .eq("user_id", user.id)
    .single();

  // Heavy data fetching
  const [paymentHistory, debtDistribution, debtProjection, interestSavings, indicators] = await Promise.all([
    getPaymentHistory(),
    getDebtDistribution(),
    getDebtProjection(),
    getInterestSavings(),
    getFinancialIndicators(),
  ]);

  return (
    <ProAnalytics
      paymentHistory={paymentHistory}
      debtDistribution={debtDistribution}
      debtProjection={debtProjection}
      interestSavings={interestSavings}
      indicators={indicators}
      currency={profile?.currency_base || "GTQ"}
    />
  );
}
