import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role, AssessmentResult, AssessmentAttempt, HrApprovalStatus } from '@/types/assessment';
import type { AssessmentAttemptRow } from './types';
import { mapAssessmentAttempt } from './assessmentMappers.js';

type NextRoute = '/result' | '/assessment' | '/role-selection';

interface SupabaseResultRow {
  id: string;
  overall_score?: number | string | null;
  strengths?: unknown;
  weaknesses?: unknown;
  summary?: unknown;
  ai_summary?: string | null;
  skill_scores?: unknown;
  development_suggestions?: unknown;
  recommended_roles?: unknown;
  completed_at?: string | null;
  hr_review_status?: string | null;
  profile?: Array<{ band: string | null }> | null;
  assessment?: Array<{ target_role: string | null }> | null;
}

const normaliseHrApprovalStatus = (value: unknown): HrApprovalStatus => {
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (!normalised) {
      return null;
    }

    if (['approved', 'accept', 'accepted', 'approved_by_hr', 'ready', 'green', 'go', 'tryout'].includes(normalised)) {
      return 'approved';
    }

    if (['rejected', 'declined', 'failed', 'no', 'not_approved'].includes(normalised)) {
      return 'rejected';
    }

    if (['pending', 'reviewing', 'in_review', 'waiting', 'processing'].includes(normalised)) {
      return 'pending';
    }

    return 'pending';
  }

  if (typeof value === 'boolean') {
    return value ? 'approved' : 'pending';
  }

  return null;
};

const extractHrApprovalStatusFromRow = (row: SupabaseResultRow): HrApprovalStatus => {
  const reviewStatus = normaliseHrApprovalStatus(row.hr_review_status);
  if (reviewStatus) {
    return reviewStatus;
  }

  const profileRecord = Array.isArray(row.profile) ? row.profile[0] : null;
  const bandStatus = normaliseHrApprovalStatus(profileRecord?.band ?? null);

  return bandStatus ?? 'pending';
};

const parseMaybeJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const getSummaryField = (
  summaryPayload: Record<string, unknown> | null,
  key: string,
): unknown => (summaryPayload ? summaryPayload[key] : null);

const normaliseScoreValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.round(Math.max(0, Math.min(100, parsed)) * 100) / 100;
    }
  }

  return null;
};

const normaliseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return normaliseStringArray(parsed);
    } catch {
      return [trimmed];
    }
  }

  return [];
};

const mergeUniqueStrings = (...groups: string[][]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  groups.forEach((group) => {
    group.forEach((entry) => {
      if (!seen.has(entry)) {
        seen.add(entry);
        result.push(entry);
      }
    });
  });

  return result;
};

const normaliseSkillScores = (value: unknown): AssessmentResult['skillScores'] => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return normaliseSkillScores(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const record = entry as { name?: unknown; score?: unknown };
      if (typeof record.name !== 'string') {
        return null;
      }

      const score = normaliseScoreValue(record.score ?? null);
      if (score === null) {
        return null;
      }

      const name = record.name.trim();
      if (!name) {
        return null;
      }

      return { name, score };
    })
    .filter((entry): entry is { name: string; score: number } => entry !== null);
};

const resolveSummaryText = (
  row: SupabaseResultRow,
  summaryPayload: Record<string, unknown> | null,
): string | null => {
  const fromSummary = getSummaryField(summaryPayload, 'summary');
  if (typeof fromSummary === 'string') {
    const trimmed = fromSummary.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (typeof row.ai_summary === 'string') {
    const trimmed = row.ai_summary.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
};

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
        overall_score,
        strengths,
        weaknesses,
        summary,
        ai_summary,
        skill_scores,
        development_suggestions,
        recommended_roles,
        completed_at,
        profile:profiles(band),
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
    const summaryPayload = parseMaybeJsonObject(resultRow.summary ?? null);
    const summaryScore = normaliseScoreValue(getSummaryField(summaryPayload, 'overall_score'));
    const fallbackScore = normaliseScoreValue(resultRow.overall_score ?? null);
    const score = summaryScore ?? fallbackScore;
    const strengths = mergeUniqueStrings(
      normaliseStringArray(resultRow.strengths),
      normaliseStringArray(getSummaryField(summaryPayload, 'strengths')),
    );
    const roleName = resultRow.assessment?.[0]?.target_role ?? null;

    return {
      nextRoute: '/result',
      selectedRole: toRole(roleName),
      assessmentResult: {
        score,
        summary: resolveSummaryText(resultRow, summaryPayload),
        strengths,
        developmentAreas: mergeUniqueStrings(
          normaliseStringArray(resultRow.weaknesses),
          normaliseStringArray(
            getSummaryField(summaryPayload, 'development_areas') ??
              getSummaryField(summaryPayload, 'weaknesses'),
          ),
        ),
        skillScores: normaliseSkillScores(
          getSummaryField(summaryPayload, 'skill_scores') ?? resultRow.skill_scores,
        ),
        recommendedRoles: mergeUniqueStrings(
          normaliseStringArray(resultRow.recommended_roles),
          normaliseStringArray(getSummaryField(summaryPayload, 'recommended_roles')),
        ),
        developmentSuggestions: mergeUniqueStrings(
          normaliseStringArray(resultRow.development_suggestions),
          normaliseStringArray(getSummaryField(summaryPayload, 'development_suggestions')),
        ),
        completedAt: resultRow.completed_at ?? null,
        hrApprovalStatus: extractHrApprovalStatusFromRow(resultRow),
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


