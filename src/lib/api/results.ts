import { supabase } from '../supabaseClient';
import type { AssessmentAttempt, AssessmentResult } from '@/types/assessment';
import type { ResultRow } from './types';

const penaltyPerViolation = 10;

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter((item) => item.trim().length > 0);
      }
    } catch (error) {
      // fall through
    }

    return [trimmed];
  }

  return [];
};

const toSkillScores = (value: unknown): Record<string, number> | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).map(([key, score]) => [key, Number(score)]).filter(([, score]) => !Number.isNaN(score)),
        );
      }
    } catch (error) {
      console.warn('Failed to parse skill scores JSON:', error);
      return undefined;
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, score]) => [key, Number(score)]).filter(([, score]) => !Number.isNaN(score)),
    );
  }

  return undefined;
};

const toOptionalString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === 'object') {
    const summary = (value as Record<string, unknown>).summary;
    if (typeof summary === 'string') {
      const trimmed = summary.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
};

const calculateAdjustedScore = (score: number | null, cheatingCount: number | null): number => {
  const baseScore = typeof score === 'number' && !Number.isNaN(score) ? score : 0;
  const violations = Math.max(0, cheatingCount ?? 0);
  const penalty = violations * penaltyPerViolation;
  return Math.max(0, Math.round(baseScore - penalty));
};

const mapResultRow = (
  row: ResultRow,
  metadata: { attemptId: string; completedCount: number; cheatingCount: number },
): AssessmentResult => {
  const strengths = toStringArray(row.strengths);
  const weaknesses = toStringArray(row.weaknesses);
  const summary = toOptionalString(row.summary);
  const aiSummary = toOptionalString(row.ai_summary) ?? summary;
  const cheatingCount = metadata.cheatingCount ?? 0;
  const overallScore = row.overall_score;

  return {
    attemptId: metadata.attemptId,
    overallScore,
    adjustedScore: calculateAdjustedScore(overallScore, cheatingCount),
    strengths,
    weaknesses,
    summary: summary ?? aiSummary,
    aiSummary,
    skillScores: toSkillScores(row.skill_scores ?? undefined),
    completedCount: metadata.completedCount,
    cheatingCount,
  } satisfies AssessmentResult;
};

interface ResultPayload {
  attempt: AssessmentAttempt;
  overallScore: number | null;
  strengths: string[];
  weaknesses: string[];
  summary: string | null;
  aiSummary?: string | null;
  skillScores?: Record<string, number>;
  completedCount: number;
  cheatingCount: number;
}

export const saveAssessmentResultAnalysis = async (
  payload: ResultPayload,
): Promise<AssessmentResult> => {
  const { attempt } = payload;
  const nowIso = new Date().toISOString();

  if (!attempt.profileId || !attempt.assessmentId) {
    throw new Error('Missing attempt context to save assessment result.');
  }

  const baseResult = {
    user_id: attempt.profileId,
    assessment_id: attempt.assessmentId,
    overall_score: payload.overallScore,
    strengths: payload.strengths,
    weaknesses: payload.weaknesses,
    summary: payload.summary,
    ai_summary: payload.aiSummary ?? payload.summary,
    skill_scores: payload.skillScores ?? null,
    analysis_completed_at: nowIso,
    cheating_summary: {
      cheating_count: payload.cheatingCount,
      completed_count: payload.completedCount,
      adjusted_score: calculateAdjustedScore(payload.overallScore, payload.cheatingCount),
    },
  } satisfies Partial<ResultRow> & Record<string, unknown>;

  const { data: existingResult, error: fetchError } = await supabase
    .from('results')
    .select('id')
    .eq('user_id', attempt.profileId)
    .eq('assessment_id', attempt.assessmentId)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error('Failed to check existing assessment result:', fetchError);
    throw new Error('Khong the luu ket qua danh gia.');
  }

  let savedRow: ResultRow | null = null;

  if (existingResult?.id) {
    const { data, error } = await supabase
      .from('results')
      .update(baseResult)
      .eq('id', existingResult.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update assessment result:', error);
      throw new Error('Khong the luu ket qua danh gia.');
    }

    savedRow = data as ResultRow;
  } else {
    const { data, error } = await supabase
      .from('results')
      .insert(baseResult)
      .select()
      .single();

    if (error) {
      console.error('Failed to create assessment result:', error);
      throw new Error('Khong the luu ket qua danh gia.');
    }

    savedRow = data as ResultRow;
  }

  const progressPercent =
    attempt.totalQuestions > 0
      ? Math.min(100, Math.round((payload.completedCount / attempt.totalQuestions) * 100))
      : attempt.progressPercent;

  const attemptUpdate = {
    status: 'completed',
    answered_count: payload.completedCount,
    progress_percent: progressPercent,
    completed_at: nowIso,
    last_activity_at: nowIso,
    ai_status: 'completed',
    cheating_count: payload.cheatingCount,
    ai_summary: {
      overall_score: payload.overallScore,
      adjusted_score: calculateAdjustedScore(payload.overallScore, payload.cheatingCount),
      strengths: payload.strengths,
      weaknesses: payload.weaknesses,
      summary: payload.summary,
      skill_scores: payload.skillScores ?? null,
    },
  } satisfies Record<string, unknown>;

  const { error: attemptError } = await supabase
    .from('assessment_attempts')
    .update(attemptUpdate)
    .eq('id', attempt.id);

  if (attemptError) {
    console.error('Failed to update assessment attempt after analysis:', attemptError);
  }

  if (!savedRow) {
    throw new Error('Khong the luu ket qua danh gia.');
  }

  return mapResultRow(savedRow, {
    attemptId: attempt.id,
    completedCount: payload.completedCount,
    cheatingCount: payload.cheatingCount,
  });
};

interface ResultQueryInput {
  attemptId: string;
  profileId: string;
  assessmentId: string;
  completedCount: number;
  cheatingCount: number;
}

export const getResultForCandidate = async (
  input: ResultQueryInput,
): Promise<AssessmentResult | null> => {
  const { profileId, assessmentId } = input;

  if (!profileId || !assessmentId) {
    return null;
  }

  const { data, error } = await supabase
    .from('results')
    .select(
      'id, user_id, assessment_id, completed_at, overall_score, strengths, weaknesses, summary, ai_summary, skill_scores, analysis_completed_at, cheating_summary',
    )
    .eq('user_id', profileId)
    .eq('assessment_id', assessmentId)
    .order('analysis_completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to load assessment result:', error);
    throw new Error('Khong the tai ket qua danh gia.');
  }

  if (!data) {
    return null;
  }

  const row = data as ResultRow;

  let cheatingCount = input.cheatingCount;
  let completedCount = input.completedCount;

  if (row.cheating_summary && typeof row.cheating_summary === 'object') {
    const summary = row.cheating_summary as Record<string, unknown>;
    const cheatingFromSummary = Number(summary.cheating_count);
    const completedFromSummary = Number(summary.completed_count);

    if (!Number.isNaN(cheatingFromSummary)) {
      cheatingCount = cheatingFromSummary;
    }

    if (!Number.isNaN(completedFromSummary) && completedFromSummary > 0) {
      completedCount = completedFromSummary;
    }
  }

  return mapResultRow(row, {
    attemptId: input.attemptId,
    completedCount,
    cheatingCount,
  });
};
