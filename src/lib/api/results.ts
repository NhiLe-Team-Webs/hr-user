import { supabase } from '../supabaseClient';
import type { AssessmentResult } from '@/types/assessment';

interface ResultRow {
  id: string;
  assessment_attempt_id: string;
  assessment_id: string | null;
  overall_score: number | null;
  total_score: number | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  summary: string | null;
  ai_summary: Record<string, unknown> | null;
  created_at: string;
}

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [value];
    } catch (error) {
      return [value];
    }
  }
  return [];
};

const mapResultRow = (row: ResultRow): AssessmentResult => ({
  overallScore: row.overall_score ?? row.total_score ?? null,
  adjustedScore: row.total_score ?? row.overall_score ?? null,
  strengths: toStringArray(row.strengths),
  weaknesses: toStringArray(row.weaknesses),
  summary: row.summary ?? '',
  completedCount: Number((row.ai_summary as { completed_count?: number } | null)?.completed_count ?? 0),
  cheatingCount: Number((row.ai_summary as { cheating_count?: number } | null)?.cheating_count ?? 0),
  skillScores:
    (row.ai_summary as { skill_scores?: Record<string, number> } | null)?.skill_scores ?? undefined,
  rawSummary: row.ai_summary,
});

export const upsertAssessmentResult = async (payload: {
  attemptId: string;
  assessmentId: string;
  overallScore: number | null;
  adjustedScore: number | null;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  aiSummary?: Record<string, unknown> | null;
}): Promise<AssessmentResult> => {
  const base = {
    assessment_attempt_id: payload.attemptId,
    assessment_id: payload.assessmentId,
    overall_score: payload.overallScore,
    total_score: payload.adjustedScore,
    strengths: payload.strengths,
    weaknesses: payload.weaknesses,
    summary: payload.summary,
    ai_summary: payload.aiSummary ?? null,
  };

  const { data, error } = await supabase
    .from('results')
    .upsert(base, { onConflict: 'assessment_attempt_id' })
    .select()
    .single();

  if (error) {
    console.error('Failed to save AI assessment result:', error);
    throw new Error('Không thể lưu kết quả đánh giá.');
  }

  return mapResultRow(data as ResultRow);
};

export const getResultByAttempt = async (attemptId: string): Promise<AssessmentResult | null> => {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('assessment_attempt_id', attemptId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch assessment result:', error);
    throw new Error('Không thể tải kết quả đánh giá.');
  }

  if (!data) {
    return null;
  }

  return mapResultRow(data as ResultRow);
};
