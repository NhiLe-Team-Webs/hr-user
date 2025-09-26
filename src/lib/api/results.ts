import { supabase } from '../supabaseClient';
import type { AssessmentResult } from '@/types/assessment';
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

const calculateAdjustedScore = (score: number | null, cheatingCount: number | null): number => {
  const baseScore = typeof score === 'number' && !Number.isNaN(score) ? score : 0;
  const violations = Math.max(0, cheatingCount ?? 0);
  const penalty = violations * penaltyPerViolation;
  return Math.max(0, Math.round(baseScore - penalty));
};

const mapResultRow = (row: ResultRow): AssessmentResult => {
  const strengths = toStringArray(row.strengths ?? []);
  const weaknesses = toStringArray(row.weaknesses ?? []);
  const summary = row.summary ?? row.ai_summary ?? null;
  const cheatingCount = row.cheating_count ?? 0;
  const overallScore = row.overall_score;

  return {
    attemptId: row.assessment_attempt_id,
    overallScore,
    adjustedScore: calculateAdjustedScore(overallScore, cheatingCount),
    strengths,
    weaknesses,
    summary,
    aiSummary: row.ai_summary ?? summary,
    skillScores: toSkillScores(row.skill_scores ?? undefined),
    completedCount: row.total_answered ?? 0,
    cheatingCount,
  } satisfies AssessmentResult;
};

interface ResultPayload {
  attemptId: string;
  assessmentId: string | null;
  profileId: string | null;
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
  const { data, error } = await supabase
    .from('results')
    .upsert(
      {
        assessment_attempt_id: payload.attemptId,
        assessment_id: payload.assessmentId,
        profile_id: payload.profileId,
        overall_score: payload.overallScore,
        strengths: payload.strengths,
        weaknesses: payload.weaknesses,
        summary: payload.summary,
        ai_summary: payload.aiSummary ?? payload.summary,
        skill_scores: payload.skillScores ?? null,
        total_answered: payload.completedCount,
        cheating_count: payload.cheatingCount,
      },
      { onConflict: 'assessment_attempt_id' },
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to save assessment result:', error);
    throw new Error('Khong the luu ket qua danh gia.');
  }

  return mapResultRow(data as ResultRow);
};

export const getResultForAttempt = async (
  attemptId: string,
): Promise<AssessmentResult | null> => {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('assessment_attempt_id', attemptId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load result for attempt:', error);
    throw new Error('Khong the tai ket qua danh gia.');
  }

  if (!data) {
    return null;
  }

  return mapResultRow(data as ResultRow);
};
