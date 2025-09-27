import { supabase } from '@/lib/supabaseClient';
import type { Question } from '@/types/question';
import type { AssessmentAttempt, AssessmentResult } from '@/types/assessment';
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

    const summary = {
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
      summary,
      ai_summary: analysis.summary,
      analysis_model: GEMINI_MODEL_NAME,
    } satisfies Record<string, unknown>;

    const { error: resultError } = await supabase.from('results').insert(resultPayload);

    if (resultError) {
      console.error('Failed to persist assessment result:', resultError);
      throw new Error('Khong the luu ket qua danh gia.');
    }

    const nowIso = new Date().toISOString();
    const { data: attemptData, error: attemptError } = await supabase
      .from('assessment_attempts')
      .update({
        status: 'completed',
        completed_at: nowIso,
        last_activity_at: nowIso,
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
  total_score?: number | string | null;
  strengths?: string[] | null;
  summary?: { strengths?: string[] | null; summary?: string | null } | null;
  ai_summary?: string | null;
  analysis_model?: string | null;
  created_at: string;
}

const extractStrengthsFromResult = (row: LatestResultRow): string[] => {
  const candidates: unknown[] = [];

  if (Array.isArray(row.strengths)) {
    candidates.push(row.strengths);
  }

  const summaryStrengths = row.summary?.strengths;
  if (Array.isArray(summaryStrengths)) {
    candidates.push(summaryStrengths);
  }

  const [firstValid] = candidates as string[][];
  return firstValid ?? [];
};

const extractSummaryText = (row: LatestResultRow): string | null => {
  const summaryField = row.summary?.summary;
  if (typeof summaryField === 'string' && summaryField.trim().length > 0) {
    return summaryField.trim();
  }

  if (typeof row.ai_summary === 'string' && row.ai_summary.trim().length > 0) {
    return row.ai_summary.trim();
  }

  return null;
};

export interface LatestResultRecord {
  id: string;
  assessmentId: string;
  profileId: string;
  totalScore: number | null;
  strengths: string[];
  summary: string | null;
  analysisModel: string | null;
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
        summary,
        ai_summary,
        analysis_model,
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
  const rawScoreValue = row.overall_score ?? row.total_score ?? null;
  const rawScore =
    typeof rawScoreValue === 'string'
      ? Number.parseFloat(rawScoreValue)
      : rawScoreValue;
  const totalScore =
    typeof rawScore === 'number' && Number.isFinite(rawScore)
      ? Math.max(0, Math.min(100, Math.round(rawScore * 100) / 100))
      : null;

  return {
    id: row.id,
    assessmentId: row.assessment_id,
    profileId: row.profile_id,
    totalScore,
    strengths: extractStrengthsFromResult(row),
    summary: extractSummaryText(row),
    analysisModel: typeof row.analysis_model === 'string' ? row.analysis_model : null,
    createdAt: row.created_at,
  } satisfies LatestResultRecord;
};
