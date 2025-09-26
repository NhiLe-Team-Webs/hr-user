import { supabase } from '../supabaseClient';
import type { AssessmentResult } from '@/types/assessment';

interface ResultRow {
  id: string;
  user_id: string | null;
  assessment_id: string | null;
  overall_score: number | null;
  strengths: unknown;
  weaknesses: unknown;
  summary: string | null;
  ai_summary: unknown;
  skill_scores: unknown;
  analysis_completed_at: string | null;
  created_at: string;
}

interface AttemptIdentifiersRow {
  profile_id: string;
  assessment_id: string | null;
}

const parseJsonValue = (value: unknown): unknown => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return value;
    }
  }

  return value;
};

const ensureRecord = (value: unknown): Record<string, unknown> | null => {
  const parsed = parseJsonValue(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return null;
};

const toStringArray = (value: unknown): string[] => {
  const parsed = parseJsonValue(value);

  if (Array.isArray(parsed)) {
    return parsed.map((item) => String(item));
  }

  if (typeof parsed === 'string' && parsed.trim().length > 0) {
    return parsed
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toSkillScoreRecord = (value: unknown): Record<string, number> | null => {
  const parsed = parseJsonValue(value);

  if (!parsed) {
    return null;
  }

  if (Array.isArray(parsed)) {
    return parsed.reduce<Record<string, number>>((acc, item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const skill = 'skill' in item ? (item.skill as string) : undefined;
        const score = 'score' in item ? toNumberValue((item as Record<string, unknown>).score) : null;
        if (skill && score != null) {
          acc[skill] = score;
        }
      }
      return acc;
    }, {});
  }

  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, number>>(
      (acc, [key, rawValue]) => {
        const numericValue = toNumberValue(rawValue);
        if (numericValue != null) {
          acc[key] = numericValue;
        }
        return acc;
      },
      {},
    );
  }

  return null;
};

const mapResultRow = (row: ResultRow): AssessmentResult => {
  const aiSummaryRecord = ensureRecord(row.ai_summary);
  const skillScoresFromSummary = aiSummaryRecord
    ? toSkillScoreRecord((aiSummaryRecord as { skill_scores?: unknown }).skill_scores)
    : null;
  const skillScores = toSkillScoreRecord(row.skill_scores) ?? skillScoresFromSummary ?? undefined;
  const completedCount = aiSummaryRecord
    ? toNumberValue((aiSummaryRecord as { completed_count?: unknown }).completed_count) ?? 0
    : 0;
  const cheatingCount = aiSummaryRecord
    ? toNumberValue((aiSummaryRecord as { cheating_count?: unknown }).cheating_count) ?? 0
    : 0;
  const adjustedScore =
    (aiSummaryRecord && toNumberValue((aiSummaryRecord as { adjusted_score?: unknown }).adjusted_score)) ??
    row.overall_score ??
    null;
  const summaryText =
    row.summary ??
    (aiSummaryRecord && typeof (aiSummaryRecord as { summary?: unknown }).summary === 'string'
      ? ((aiSummaryRecord as { summary?: string }).summary as string)
      : '') ??
    '';

  return {
    overallScore: row.overall_score ?? null,
    adjustedScore,
    strengths: toStringArray(row.strengths),
    weaknesses: toStringArray(row.weaknesses),
    summary: summaryText,
    completedCount,
    cheatingCount,
    skillScores,
    rawSummary: aiSummaryRecord,
  } satisfies AssessmentResult;
};

interface UpsertResultPayload {
  userId: string;
  assessmentId: string;
  overallScore: number | null;
  adjustedScore: number | null;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  aiSummary?: Record<string, unknown> | null;
  skillScores?: Record<string, number> | null;
}

export const upsertAssessmentResult = async (payload: UpsertResultPayload): Promise<AssessmentResult> => {
  const nowIso = new Date().toISOString();
  const summaryPayload: Record<string, unknown> = {
    ...(payload.aiSummary ?? {}),
  };

  if (payload.adjustedScore != null) {
    summaryPayload.adjusted_score = payload.adjustedScore;
  }

  const aiSummary = Object.keys(summaryPayload).length > 0 ? summaryPayload : null;
  const skillScores = payload.skillScores ?? null;

  const baseRow = {
    user_id: payload.userId,
    assessment_id: payload.assessmentId,
    overall_score: payload.overallScore,
    strengths: payload.strengths,
    weaknesses: payload.weaknesses,
    summary: payload.summary,
    ai_summary: aiSummary,
    skill_scores: skillScores,
    analysis_model: 'gemini-1.5-flash',
    analysis_version: 'v1',
    analysis_completed_at: nowIso,
  };

  const { data: existing, error: existingError } = await supabase
    .from('results')
    .select('id')
    .eq('user_id', payload.userId)
    .eq('assessment_id', payload.assessmentId)
    .order('analysis_completed_at', { ascending: false, nullsLast: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('Failed to determine existing assessment result:', existingError);
    throw new Error('Không thể lưu kết quả đánh giá.');
  }

  let row: ResultRow | null = null;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('results')
      .update(baseRow)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update AI assessment result:', error);
      throw new Error('Không thể lưu kết quả đánh giá.');
    }

    row = data as ResultRow;
  } else {
    const { data, error } = await supabase
      .from('results')
      .insert(baseRow)
      .select()
      .single();

    if (error) {
      console.error('Failed to insert AI assessment result:', error);
      throw new Error('Không thể lưu kết quả đánh giá.');
    }

    row = data as ResultRow;
  }

  return mapResultRow(row);
};

export const getResultByAttempt = async (attemptId: string): Promise<AssessmentResult | null> => {
  const { data: attemptData, error: attemptError } = await supabase
    .from('assessment_attempts')
    .select('profile_id, assessment_id')
    .eq('id', attemptId)
    .maybeSingle();

  if (attemptError) {
    console.error('Failed to resolve assessment attempt identifiers:', attemptError);
    throw new Error('Không thể tải kết quả đánh giá.');
  }

  if (!attemptData) {
    return null;
  }

  const identifiers = attemptData as AttemptIdentifiersRow;

  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('user_id', identifiers.profile_id)
    .eq('assessment_id', identifiers.assessment_id)
    .order('analysis_completed_at', { ascending: false, nullsLast: true })
    .limit(1)
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
