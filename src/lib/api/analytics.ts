import { supabase } from '@/lib/supabaseClient';

interface SupabaseAnalyticsUser {
  id: string;
  name: string | null;
  band: string | null;
}

interface SupabaseAnalyticsAssessment {
  target_role: string | null;
}

interface SupabaseAnalyticsRow {
  total_score: number | null;
  assessment: SupabaseAnalyticsAssessment[] | null;
  user: SupabaseAnalyticsUser[] | null;
}

export interface AnalyticsCandidateSummary {
  id: string;
  name: string;
  role: string;
  band: string | null;
  scores: {
    overall: number | null;
  };
  status: 'completed';
}

export const getAnalyticsData = async (): Promise<AnalyticsCandidateSummary[]> => {
  const { data, error } = await supabase
    .from('results')
    .select(
      `
        total_score,
        assessment:assessments(target_role),
        user:profiles(id, name, band)
      `,
    );

  if (error) {
    console.error('Failed to fetch analytics data:', error);
    throw new Error('Unable to fetch analytics data.');
  }

  const rows = (data as SupabaseAnalyticsRow[] | null) ?? [];

  return rows
    .map((item) => {
      const user = item.user?.[0] ?? null;
      if (!user?.id) {
        return null;
      }

      const assessment = item.assessment?.[0] ?? null;

      return {
        id: user.id,
        name: user.name ?? 'Unknown',
        role: assessment?.target_role ?? 'Unknown',
        band: user.band ?? null,
        scores: {
          overall: item.total_score,
        },
        status: 'completed' as const,
      } satisfies AnalyticsCandidateSummary;
    })
    .filter((item): item is AnalyticsCandidateSummary => item !== null);
};
