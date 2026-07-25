import {
  getUserSubscription,
  getPaymentHistory,
  getDebtDistribution,
  getDebtProjection,
  getInterestSavings,
  getFinancialIndicators,
} from "@/lib/actions/dashboard-analytics";
import { getCurrentUserProfile } from "@/lib/actions/profile";
import { getAppUser } from "@/lib/auth/session";
import { ProAnalytics } from "@/components/dashboard/pro-analytics";

export async function ProAnalyticsWrapper() {
  const appUser = await getAppUser();
  if (!appUser) return null;

  // Check subscription first
  const { isPro } = await getUserSubscription();

  if (!isPro) return null;

  // Fetch currency preference (dual-path)
  const profile = await getCurrentUserProfile();

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
