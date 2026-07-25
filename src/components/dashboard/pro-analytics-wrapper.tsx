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

  const { isPro } = await getUserSubscription();
  const profile = await getCurrentUserProfile();
  const currency = profile?.currency_base || "GTQ";

  // FREE teaser: one savings number + blur the rest. PRO: full analytics.
  if (!isPro) {
    const interestSavings = await getInterestSavings();
    if (!interestSavings.savings && !interestSavings.withMinimums) {
      return null;
    }

    return (
      <ProAnalytics
        paymentHistory={[]}
        debtDistribution={[]}
        debtProjection={[]}
        interestSavings={interestSavings}
        indicators={{
          debtToIncomeRatio: 0,
          monthlyProgress: 0,
          daysToNextPayment: 0,
          avgMonthlyPayment: 0,
          totalPaid: 0,
          percentagePaid: 0,
        }}
        currency={currency}
        teaserMode
      />
    );
  }

  const [paymentHistory, debtDistribution, debtProjection, interestSavings, indicators] =
    await Promise.all([
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
      currency={currency}
    />
  );
}
