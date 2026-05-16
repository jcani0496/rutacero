import { fetchUserInsights } from '@/lib/actions/insights';
import { InsightsSection } from './insights-section';

export async function InsightsSectionWrapper() {
    const result = await fetchUserInsights();
    if (!result.hasData || result.insights.length === 0) return null;
    return <InsightsSection insights={result.insights} />;
}
