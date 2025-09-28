import { supabase } from '@/lib/supabaseClient';
import type { Question } from '@/types/question';
import type { AssessmentAttempt, AssessmentResult, AssessmentSkillScore, HrApprovalStatus } from '@/types/assessment';
import {
  analyzeWithGemini,
  GEMINI_MODEL_NAME,
  toAssessmentResult,
  type GeminiAnswerPayload,
  type GeminiAnalysisResponse,
} from './gemini';
import {
  mapSupabaseQuestion,
  normaliseQuestionFormat,
  type SupabaseQuestionData,
} from './questionMappers';
import type { AnswerInput, AnswerRow, AssessmentAttemptRow } from './types';
import { mapAssessmentAttempt } from './assessmentMappers';

interface AssessmentPayload {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  questions: Array<{
    id: string;
    text: string;
    format: string;
    required?: boolean;
    options: Array<{ id: string; option_text: string; is_correct: boolean }>;
  }>;
}

export const getAssessment = async (role: string) => {
  const { data, error } = await supabase
    .from('assessments')
    .select(
      `
        id,
        title,
        description,
        duration,
        questions:questions(
          id,
          text,
          format,
          required,
          options:question_options(id, option_text, is_correct)
        )
      `,
    )
    .eq('target_role', role)
    .single();

  if (error) {
    console.error(`Failed to load assessment for role ${role}:`, error);
    throw new Error('Khong the tai bai danh gia.');
  }

  if (!data) {
    return null;
  }

  const payload = data as AssessmentPayload;

  return {
    ...payload,
    questions: payload.questions.map((question) => ({
      id: question.id,
      text: question.text,
      type: 'General',
      format: normaliseQuestionFormat(question.format),
      required: question.required ?? true,
      points: 0,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.option_text,
        optionText: option.option_text,
        isCorrect: option.is_correct,
      })),
      correctAnswer: question.options.find((option) => option.is_correct)?.id,
    })),
  };
};

export const getQuestionsByIds = async (questionIds: string[]): Promise<Question[]> => {
  if (questionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('questions')
    .select(
      `
        id,
        text,
        type,
        format,
        required,
        assessment_id,
        created_at,
        options:question_options(id, option_text, is_correct)
      `,
    )
    .in('id', questionIds);

  if (error) {
    console.error('Failed to load questions by ids:', error);
    throw new Error('Khong the tai danh sach cau hoi.');
  }

  return ((data as SupabaseQuestionData[] | null) ?? []).map(mapSupabaseQuestion);
};

export const upsertAnswer = async (payload: AnswerInput): Promise<AnswerRow> => {
  const base = {
    result_id: payload.resultId ?? null,
    question_id: payload.questionId,
    user_answer_text: payload.userAnswerText ?? null,
    selected_option_id: payload.selectedOptionId ?? null,
  };

  if (payload.id) {
    const { data, error } = await supabase
      .from('answers')
      .update(base)
      .eq('id', payload.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update answer:', error);
      throw new Error('Khong the luu cau tra loi.');
    }

    return data as AnswerRow;
  }

  const { data, error } = await supabase
    .from('answers')
    .insert(base)
    .select()
    .single();

  if (error) {
    console.error('Failed to insert answer:', error);
    throw new Error('Khong the luu cau tra loi.');
  }

  return data as AnswerRow;
};

interface ProfileRow {
  id: string;
  email: string | null;
  name: string | null;
}

const fetchLatestAssessmentAttempt = async (profileId: string, assessmentId: string) => {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('assessment_id', assessmentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch assessment attempt:', error);
    throw new Error('Khong the tai tien do bai danh gia.');
  }

  return data as AssessmentAttemptRow | null;
};

export const ensureProfile = async (payload: ProfileRow): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: payload.id,
        email: payload.email,
        name: payload.name,
      },
      { onConflict: 'id' },
    );

  if (error) {
    console.error('Failed to ensure profile:', error);
    throw new Error('Khong the khoi tao ho so nguoi dung.');
  }
};

export const startAssessmentAttempt = async (payload: {
  profileId: string;
  assessmentId: string;
  role: string;
  totalQuestions: number;
}): Promise<AssessmentAttempt> => {
  const nowIso = new Date().toISOString();
  const existing = await fetchLatestAssessmentAttempt(payload.profileId, payload.assessmentId);

  if (existing && existing.status !== 'completed') {
    const updates: Record<string, unknown> = {
      total_questions: payload.totalQuestions,
      last_activity_at: nowIso,
    };

    if (!existing.started_at) {
      updates.started_at = nowIso;
    }

    if (existing.status === 'not_started') {
      updates.status = 'in_progress';
    }

    const { data, error } = await supabase
      .from('assessment_attempts')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update assessment attempt:', error);
      throw new Error('Khong the cap nhat tien trinh bai danh gia.');
    }

    return mapAssessmentAttempt(data as AssessmentAttemptRow);
  }

  const { data, error } = await supabase
    .from('assessment_attempts')
    .insert({
      profile_id: payload.profileId,
      assessment_id: payload.assessmentId,
      role: payload.role,
      total_questions: payload.totalQuestions,
      status: 'in_progress',
      started_at: nowIso,
      last_activity_at: nowIso,
      ai_status: 'idle',
      last_ai_error: null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create assessment attempt:', error);
    throw new Error('Khong the khoi tao bai danh gia.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

export const submitAssessmentAttempt = async (attemptId: string): Promise<AssessmentAttempt> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('assessment_attempts')
    .update({
      status: 'awaiting_ai',
      submitted_at: nowIso,
      last_activity_at: nowIso,
      last_ai_error: null,
      ai_status: 'processing',
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (error) {
    console.error('Failed to submit assessment attempt:', error);
    throw new Error('Khong the ghi nhan bai lam.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

const truncateErrorMessage = (value: string, maxLength = 500) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
};

const logAiFailure = async (attemptId: string, message: string) => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('assessment_attempts')
    .update({
      last_ai_error: truncateErrorMessage(message),
      last_activity_at: nowIso,
      ai_status: 'failed',
    })
    .eq('id', attemptId);
};

export interface FinaliseAssessmentOptions {
  attemptId: string;
  assessmentId: string;
  profileId: string;
  role: string;
  candidateName: string | null;
  language: 'vi' | 'en';
  answers: GeminiAnswerPayload[];
}

export interface FinaliseAssessmentResult {
  attempt: AssessmentAttempt;
  result: AssessmentResult;
  aiSummary: string;
}

export const finaliseAssessmentAttempt = async (
  payload: FinaliseAssessmentOptions,
): Promise<FinaliseAssessmentResult> => {
  try {
    const analysis: GeminiAnalysisResponse = await analyzeWithGemini({
      role: payload.role,
      candidateName: payload.candidateName,
      language: payload.language,
      answers: payload.answers,
    });

    const completedAt = new Date().toISOString();

    const structuredSummary = {
      strengths: analysis.strengths,
      development_areas: analysis.developmentAreas,
      skill_scores: analysis.skillScores,
      overall_score: analysis.overallScore,
      summary: analysis.summary,
    } satisfies Record<string, unknown>;

    const resultPayload = {
      profile_id: payload.profileId,
      assessment_id: payload.assessmentId,
      overall_score: analysis.overallScore,
      strengths: analysis.strengths,
      weaknesses: analysis.developmentAreas,
      development_suggestions: analysis.developmentAreas,
      skill_scores: analysis.skillScores,
      summary: structuredSummary,
      ai_summary: analysis.summary,
      analysis_model: GEMINI_MODEL_NAME,
      analysis_completed_at: completedAt,
      insight_locale: payload.language,
    } satisfies Record<string, unknown>;

    const { error: resultError } = await supabase.from('results').insert(resultPayload);

    if (resultError) {
      console.error('Failed to persist assessment result:', resultError);
      throw new Error('Khong the luu ket qua danh gia.');
    }

    const { data: attemptData, error: attemptError } = await supabase
      .from('assessment_attempts')
      .update({
        status: 'completed',
        completed_at: completedAt,
        last_activity_at: completedAt,
        last_ai_error: null,
        ai_status: 'completed',
      })
      .eq('id', payload.attemptId)
      .select()
      .single();

    if (attemptError) {
      console.error('Failed to update attempt after AI analysis:', attemptError);
      throw new Error('Khong the cap nhat trang thai bai danh gia.');
    }

    return {
      attempt: mapAssessmentAttempt(attemptData as AssessmentAttemptRow),
      result: toAssessmentResult(analysis),
      aiSummary: analysis.summary,
    } satisfies FinaliseAssessmentResult;
  } catch (error) {
    console.error('Failed to finalise assessment attempt with AI:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Khong the phan tich bai danh gia voi tri tue nhan tao.';
    await logAiFailure(payload.attemptId, message);
    throw error;
  }
};

interface LatestResultRow {
  id: string;
  profile_id: string;
  assessment_id: string;
  overall_score?: number | string | null;
  strengths?: unknown;
  weaknesses?: unknown;
  development_suggestions?: unknown;
  skill_scores?: unknown;
  recommended_roles?: unknown;
  summary?: unknown;
  ai_summary?: string | null;
  analysis_model?: string | null;
  analysis_completed_at?: string | null;
  insight_locale?: string | null;
  hr_review_status?: string | null;
  profile?: Array<{ band: string | null }> | null;
  created_at: string;
}

type SummaryPayload = {
  strengths?: unknown;
  development_areas?: unknown;
  skill_scores?: unknown;
  recommended_roles?: unknown;
  development_suggestions?: unknown;
  overall_score?: unknown;
  summary?: unknown;
};

const parseJsonCandidate = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '[' && last === ']') || (first === '{' && last === '}')) {
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        console.warn('[Gemini] Failed to parse JSON candidate from database field', {
          error,
          sample: trimmed.slice(0, 200),
        });
        return trimmed;
      }
    }

    return trimmed;
  }

  return value;
};

const getSummaryPayload = (row: LatestResultRow): SummaryPayload | null => {
  const parsed = parseJsonCandidate(row.summary);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as SummaryPayload;
  }
  return null;
};

const collectStringValues = (...candidates: unknown[]): string[] => {
  const results: string[] = [];

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (typeof entry === 'string') {
          const trimmed = entry.trim();
          if (trimmed.length > 0) {
            results.push(trimmed);
          }
        }
      }
    } else if (typeof parsed === 'string') {
      const trimmed = parsed.trim();
      if (trimmed.length > 0) {
        results.push(trimmed);
      }
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of results) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  }

  return unique;
};

const collectSkillScores = (...candidates: unknown[]): AssessmentSkillScore[] => {
  const scores: AssessmentSkillScore[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (!Array.isArray(parsed)) {
      continue;
    }

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const nameRaw = (entry as { name?: unknown }).name;
      const scoreRaw = (entry as { score?: unknown }).score;
      if (typeof nameRaw !== 'string') {
        continue;
      }

      const name = nameRaw.trim();
      if (!name || seen.has(name.toLowerCase())) {
        continue;
      }

      let numericScore: number | null = null;
      if (typeof scoreRaw === 'number') {
        numericScore = scoreRaw;
      } else if (typeof scoreRaw === 'string') {
        const parsedScore = Number.parseFloat(scoreRaw);
        if (Number.isFinite(parsedScore)) {
          numericScore = parsedScore;
        }
      }

      const safeScore = Number.isFinite(numericScore ?? NaN) ? numericScore ?? 0 : 0;
      const clampedScore = Math.max(0, Math.min(100, Math.round(safeScore * 100) / 100));

      scores.push({ name, score: clampedScore });
      seen.add(name.toLowerCase());
    }
  }

  return scores;
};

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

const extractHrApprovalStatusFromRow = (row: { hr_review_status?: unknown; profile?: Array<{ band?: unknown }> | null }): HrApprovalStatus => {
  const reviewStatus = normaliseHrApprovalStatus(row.hr_review_status);
  if (reviewStatus) {
    return reviewStatus;
  }

  const profileRecord = Array.isArray(row.profile) ? row.profile[0] : null;
  const bandStatus = normaliseHrApprovalStatus(profileRecord?.band ?? null);

  return bandStatus ?? 'pending';
};


const extractStrengthsFromResult = (row: LatestResultRow, summary: SummaryPayload | null): string[] =>
  collectStringValues(row.strengths, summary?.strengths);

const extractDevelopmentAreasFromResult = (row: LatestResultRow, summary: SummaryPayload | null): string[] =>
  collectStringValues(row.weaknesses, summary?.development_areas);

const extractDevelopmentSuggestionsFromResult = (
  row: LatestResultRow,
  summary: SummaryPayload | null,
): string[] => collectStringValues(row.development_suggestions, summary?.development_suggestions, summary?.development_areas);

const extractRecommendedRolesFromResult = (row: LatestResultRow, summary: SummaryPayload | null): string[] =>
  collectStringValues(row.recommended_roles, summary?.recommended_roles);

const extractSkillScoresFromResult = (row: LatestResultRow, summary: SummaryPayload | null): AssessmentSkillScore[] =>
  collectSkillScores(row.skill_scores, summary?.skill_scores);

const extractSummaryText = (row: LatestResultRow, summary: SummaryPayload | null): string | null => {
  const summaryField = parseJsonCandidate(summary?.summary);
  if (typeof summaryField === 'string' && summaryField.trim().length > 0) {
    return summaryField.trim();
  }

  if (typeof row.ai_summary === 'string' && row.ai_summary.trim().length > 0) {
    return row.ai_summary.trim();
  }

  const rawSummary = row.summary;
  if (typeof rawSummary === 'string' && rawSummary.trim().length > 0) {
    return rawSummary.trim();
  }

  return null;
};

const resolveScore = (row: LatestResultRow, summary: SummaryPayload | null): number | null => {
  const candidates: unknown[] = [summary?.overall_score, row.overall_score];

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      const value = Math.max(0, Math.min(100, parsed));
      return Math.round(value * 100) / 100;
    }

    if (typeof parsed === 'string') {
      const value = Number.parseFloat(parsed);
      if (Number.isFinite(value)) {
        const clamped = Math.max(0, Math.min(100, value));
        return Math.round(clamped * 100) / 100;
      }
    }
  }

  return null;
};

export interface LatestResultRecord {
  id: string;
  assessmentId: string;
  profileId: string;
  score: number | null;
  strengths: string[];
  summary: string | null;
  developmentAreas: string[];
  developmentSuggestions: string[];
  skillScores: AssessmentSkillScore[];
  recommendedRoles: string[];
  hrApprovalStatus: HrApprovalStatus;
  analysisModel: string | null;
  completedAt: string | null;
  insightLocale: string | null;
  createdAt: string;
}

export const getLatestResult = async (
  profileId: string,
  assessmentId?: string | null,
): Promise<LatestResultRecord | null> => {
  if (!profileId) {
    throw new Error('Khong the tai ket qua danh gia.');
  }

  let query = supabase
    .from('results')
    .select(
      `
        id,
        profile_id,
        assessment_id,
        overall_score,
        strengths,
        weaknesses,
        development_suggestions,
        skill_scores,
        recommended_roles,
        summary,
        ai_summary,
        analysis_model,
        analysis_completed_at,
        insight_locale,
        profile:profiles(band),
        created_at
      `,
    )
    .eq('profile_id', profileId);

  if (assessmentId) {
    query = query.eq('assessment_id', assessmentId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (error) {
    console.error('Failed to fetch latest assessment result:', error);
    throw new Error('Khong the tai ket qua danh gia.');
  }

  if (!data) {
    return null;
  }

  const row = data as LatestResultRow;
  const summaryPayload = getSummaryPayload(row);
  const score = resolveScore(row, summaryPayload);

  return {
    id: row.id,
    assessmentId: row.assessment_id,
    profileId: row.profile_id,
    score,
    strengths: extractStrengthsFromResult(row, summaryPayload),
    summary: extractSummaryText(row, summaryPayload),
    developmentAreas: extractDevelopmentAreasFromResult(row, summaryPayload),
    developmentSuggestions: extractDevelopmentSuggestionsFromResult(row, summaryPayload),
    skillScores: extractSkillScoresFromResult(row, summaryPayload),
    recommendedRoles: extractRecommendedRolesFromResult(row, summaryPayload),
    hrApprovalStatus: extractHrApprovalStatusFromRow(row),
    analysisModel: typeof row.analysis_model === 'string' ? row.analysis_model : null,
    completedAt: typeof row.analysis_completed_at === 'string' ? row.analysis_completed_at : null,
    insightLocale: typeof row.insight_locale === 'string' ? row.insight_locale : null,
    createdAt: row.created_at,
  } satisfies LatestResultRecord;
};


