import { supabase } from '@/lib/supabaseClient';

interface SupabaseAnalyticsUser {
  auth_id: string;
  full_name: string | null;
  band: string | null;
}

interface SupabaseAnalyticsAssessment {
  target_role: string | null;
}

interface SupabaseAnalyticsRow {
  assessment: SupabaseAnalyticsAssessment[] | null;
  user: SupabaseAnalyticsUser[] | null;
}

export interface AnalyticsCandidateSummary {
  id: string;
  name: string;
  role: string;
  band: string | null;
  status: 'completed';
}

export const getAnalyticsData = async (): Promise<AnalyticsCandidateSummary[]> => {
  const { data, error } = await supabase
    .from('interview_results')
    .select(
      `
        assessment:interview_assessments(target_role),
        user:users(auth_id, full_name, band)
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
      if (!user?.auth_id) {
        return null;
      }

      const assessment = item.assessment?.[0] ?? null;

      return {
        id: user.auth_id,
        name: user.full_name ?? 'Unknown',
        role: assessment?.target_role ?? 'Unknown',
        band: user.band ?? null,
        status: 'completed' as const,
      } satisfies AnalyticsCandidateSummary;
    })
    .filter((item): item is AnalyticsCandidateSummary => item !== null);
};
