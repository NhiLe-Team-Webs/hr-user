import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role, AssessmentResult, AssessmentAttempt } from '@/types/assessment';
import type { AssessmentAttemptRow } from './types';
import { mapAssessmentAttempt } from './assessmentMappers.js';

type NextRoute = '/result' | '/assessment' | '/role-selection';

interface SupabaseResultRow {
  id: string;
  total_score: number | null;
  strengths?: string[] | null;
  insights?: string[] | null;
  summary?: { strengths?: string[] | null } | null;
  assessment?: Array<{ target_role: string | null }> | null;
}

interface ResolveAssessmentStateOptions {
  profileId: string;
  client: SupabaseClient;
}

export interface AssessmentResolution {
  nextRoute: NextRoute;
  selectedRole: Role | null;
  assessmentResult: AssessmentResult | null;
  activeAttempt: AssessmentAttempt | null;
}

const defaultResolution: AssessmentResolution = {
  nextRoute: '/role-selection',
  selectedRole: null,
  assessmentResult: null,
  activeAttempt: null,
};

const toRole = (roleName: string | null | undefined): Role | null => {
  if (!roleName) {
    return null;
  }

  return {
    name: roleName,
    title: roleName,
  };
};

const normaliseStrengths = (row: SupabaseResultRow): string[] => {
  const candidates: unknown[] = [];

  if (Array.isArray(row.strengths)) {
    candidates.push(row.strengths);
  }

  if (Array.isArray(row.insights)) {
    candidates.push(row.insights);
  }

  const summaryStrengths = row.summary?.strengths;
  if (Array.isArray(summaryStrengths)) {
    candidates.push(summaryStrengths);
  }

  if (candidates.length === 0) {
    return [];
  }

  const [firstValid] = candidates as string[][];
  return firstValid;
};

export const resolveAssessmentState = async ({
  profileId,
  client,
}: ResolveAssessmentStateOptions): Promise<AssessmentResolution> => {
  if (!profileId) {
    return defaultResolution;
  }

  const { data: resultData, error: resultError } = await client
    .from('results')
    .select(
      `
        id,
        total_score,
        strengths,
        insights,
        summary,
        assessment:assessments(target_role)
      `,
    )
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resultError) {
    throw resultError;
  }

  const resultRow = (resultData as SupabaseResultRow | null) ?? null;

  if (resultRow) {
    const strengths = normaliseStrengths(resultRow);
    const score = Number(resultRow.total_score ?? 0);
    const roleName = resultRow.assessment?.[0]?.target_role ?? null;

    return {
      nextRoute: '/result',
      selectedRole: toRole(roleName),
      assessmentResult: {
        score: Number.isFinite(score) ? score : 0,
        strengths,
      },
      activeAttempt: null,
    } satisfies AssessmentResolution;
  }

  const { data: attemptData, error: attemptError } = await client
    .from('assessment_attempts')
    .select('*')
    .eq('profile_id', profileId)
    .is('submitted_at', null)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attemptError) {
    throw attemptError;
  }

  const attemptRow = (attemptData as AssessmentAttemptRow | null) ?? null;

  if (attemptRow) {
    return {
      nextRoute: '/assessment',
      selectedRole: toRole(attemptRow.role),
      assessmentResult: null,
      activeAttempt: mapAssessmentAttempt(attemptRow),
    } satisfies AssessmentResolution;
  }

  return defaultResolution;
};

