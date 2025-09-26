import { supabase } from '../supabaseClient';
import type { Question } from '../types/question';
import type {
  AssessmentAttempt,
  AssessmentHistoryEntry,
  AssessmentLifecycleStatus,
  AssessmentResult,
  Role,
} from '@/types/assessment';
import {
  mapSupabaseQuestion,
  normaliseQuestionFormat,
  type SupabaseQuestionData,
} from './questionMappers';
import type { AnswerInput, AnswerRow, AssessmentAttemptRow, ResultRow } from './types';

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

const HR_NOTIFICATION_MESSAGE =
  'Kết quả của bạn đã được gửi về cho HR xem xét, bạn sẽ nhận được thông báo qua email hoặc trực tiếp trên giao diện.';

const STORAGE_NULL_KEY = '__null__';

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapAssessmentAttempt = (row: AssessmentAttemptRow): AssessmentAttempt => ({
  id: row.id,
  assessmentId: row.assessment_id ?? null,
  role: row.role ?? null,
  status: row.status,
  answeredCount: row.answered_count ?? 0,
  totalQuestions: row.total_questions ?? 0,
  progressPercent: toNumber(row.progress_percent, 0),
  startedAt: row.started_at,
  submittedAt: row.submitted_at,
  completedAt: row.completed_at,
  lastActivityAt: row.last_activity_at,
  createdAt: row.created_at ?? null,
  durationSeconds: row.duration_seconds ?? null,
});

const normaliseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object') {
        const candidate =
          (item as Record<string, unknown>).text ??
          (item as Record<string, unknown>).label ??
          (item as Record<string, unknown>).title;
        return typeof candidate === 'string' ? candidate : [];
      }
      return [];
    });
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
};

const mapAssessmentResult = (row: ResultRow): AssessmentResult => ({
  id: row.id,
  score: Math.round(toNumber(row.overall_score, 0)),
  strengths: normaliseStringArray(row.strengths),
  weaknesses: normaliseStringArray(row.weaknesses),
  summary: row.summary,
  recommendedRoles: normaliseStringArray(row.recommended_roles),
  completedAt: row.completed_at,
  hrMessage: HR_NOTIFICATION_MESSAGE,
  aiSummary: typeof row.ai_summary === 'string' ? row.ai_summary : null,
  analysisModel: row.analysis_model,
  analysisVersion: row.analysis_version,
});

const resolveLifecycleStatus = (
  attemptStatus: string | null | undefined,
  hasResult: boolean,
): AssessmentLifecycleStatus => {
  if (hasResult) {
    return 'completed';
  }

  switch (attemptStatus) {
    case 'completed':
      return 'completed';
    case 'awaiting_ai':
      return 'awaiting_ai';
    case 'in_progress':
      return 'in_progress';
    default:
      return 'idle';
  }
};

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
      progress_percent: 100,
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

interface AssessmentSnapshot {
  selectedRole: Role | null;
  activeAttempt: AssessmentAttempt | null;
  assessmentResult: AssessmentResult | null;
  history: AssessmentHistoryEntry[];
  status: AssessmentLifecycleStatus;
}

export const getAssessmentSnapshot = async (profileId: string): Promise<AssessmentSnapshot> => {
  const { data: attemptData, error: attemptError } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (attemptError) {
    console.error('Failed to fetch assessment attempts:', attemptError);
    throw new Error('Khong the tai thong tin bai danh gia.');
  }

  const attemptRows = (attemptData as AssessmentAttemptRow[] | null) ?? [];

  const { data: resultData, error: resultError } = await supabase
    .from('results')
    .select('*')
    .eq('user_id', profileId)
    .order('completed_at', { ascending: false });

  if (resultError) {
    console.error('Failed to fetch assessment results:', resultError);
  }

  const resultRows = (resultData as ResultRow[] | null) ?? [];
  const resultsByAssessment = new Map<string | null, ResultRow[]>();

  for (const row of resultRows) {
    const key = row.assessment_id ?? STORAGE_NULL_KEY;
    const bucket = resultsByAssessment.get(key) ?? [];
    bucket.push(row);
    resultsByAssessment.set(key, bucket);
  }

  const history: AssessmentHistoryEntry[] = attemptRows.map((row) => {
    const bucket = resultsByAssessment.get(row.assessment_id ?? STORAGE_NULL_KEY);
    const latestResult = bucket?.[0];

    return {
      id: row.id,
      role: row.role,
      assessmentId: row.assessment_id,
      status: row.status,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      completedAt: row.completed_at,
      overallScore: latestResult ? Math.round(toNumber(latestResult.overall_score, 0)) : null,
      createdAt: row.created_at ?? row.started_at ?? null,
    };
  });

  const latestAttemptRow = attemptRows[0] ?? null;
  const latestAttempt = latestAttemptRow ? mapAssessmentAttempt(latestAttemptRow) : null;

  const latestResultRow = latestAttemptRow
    ? resultsByAssessment.get(latestAttemptRow.assessment_id ?? STORAGE_NULL_KEY)?.[0] ?? resultRows[0] ?? null
    : resultRows[0] ?? null;

  const assessmentResult = latestResultRow ? mapAssessmentResult(latestResultRow) : null;

  const status = resolveLifecycleStatus(latestAttemptRow?.status, Boolean(assessmentResult));

  const selectedRole: Role | null = latestAttempt?.role
    ? { name: latestAttempt.role, title: latestAttempt.role }
    : assessmentResult?.recommendedRoles?.[0]
    ? {
        name: assessmentResult.recommendedRoles[0],
        title: assessmentResult.recommendedRoles[0],
      }
    : null;

  return {
    selectedRole,
    activeAttempt: status === 'completed' ? null : latestAttempt,
    assessmentResult,
    history,
    status,
  };
};

export const finalizeAssessmentAttempt = async (payload: {
  attemptId: string;
  profileId: string;
  assessmentId?: string | null;
  result: AssessmentResult;
}): Promise<{ attempt: AssessmentAttempt; result: AssessmentResult }> => {
  const nowIso = payload.result.completedAt ?? new Date().toISOString();

  const updates: Record<string, unknown> = {
    status: 'completed',
    completed_at: nowIso,
    last_activity_at: nowIso,
    progress_percent: 100,
  };

  if (payload.result.metrics?.durationSeconds != null) {
    updates.duration_seconds = payload.result.metrics.durationSeconds;
  }

  const { data: attemptData, error: attemptError } = await supabase
    .from('assessment_attempts')
    .update(updates)
    .eq('id', payload.attemptId)
    .select()
    .single();

  if (attemptError) {
    console.error('Failed to finalise assessment attempt:', attemptError);
    throw new Error('Khong the cap nhat trang thai bai danh gia.');
  }

  const resultInsert: Record<string, unknown> = {
    user_id: payload.profileId,
    completed_at: nowIso,
    overall_score: payload.result.score,
    strengths: payload.result.strengths,
    weaknesses: payload.result.weaknesses,
    summary: payload.result.summary ?? null,
    recommended_roles: payload.result.recommendedRoles ?? null,
    ai_summary: payload.result.aiSummary ?? null,
    analysis_model: payload.result.analysisModel ?? 'gemini-local',
    analysis_version: payload.result.analysisVersion ?? 'v1',
    insight_locale: 'vi-VN',
    insight_version: 'v1',
  };

  if (payload.assessmentId) {
    resultInsert.assessment_id = payload.assessmentId;
  }

  const { data: resultData, error: resultError } = await supabase
    .from('results')
    .upsert(resultInsert, { onConflict: 'user_id,assessment_id' })
    .select()
    .single();

  if (resultError) {
    console.error('Failed to persist assessment result:', resultError);
    throw new Error('Khong the luu ket qua danh gia.');
  }

  return {
    attempt: mapAssessmentAttempt(attemptData as AssessmentAttemptRow),
    result: mapAssessmentResult(resultData as ResultRow),
  };
};
