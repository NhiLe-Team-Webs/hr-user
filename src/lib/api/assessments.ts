import { supabase } from '../supabaseClient';
import type { Question } from '../types/question';
import type {
  AssessmentAttempt,
  AssessmentHistoryEntry,
  AssessmentLifecycleStatus,
  AssessmentResult,
  AttemptReview,
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
  aiStatus: row.ai_status ?? null,
  aiSummary: (row.ai_summary as Record<string, unknown> | null) ?? null,
  cheatingCount: row.cheating_count ?? null,
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
  const base: Record<string, unknown> = {
    attempt_id: payload.attemptId ?? null,
    result_id: payload.resultId ?? null,
    question_id: payload.questionId,
    user_answer_text: payload.userAnswerText ?? null,
    selected_option_id: payload.selectedOptionId ?? null,
  };

  if (typeof payload.timeSpentSeconds === 'number') {
    base.time_spent_seconds = payload.timeSpentSeconds;
  }

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

export const getAnswersForAttempt = async (attemptId: string): Promise<AnswerRow[]> => {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch answers for attempt:', error);
    throw new Error('Khong the tai cau tra loi da luu.');
  }

  return (data as AnswerRow[] | null) ?? [];
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

export const submitAssessmentAttempt = async (payload: {
  attemptId: string;
  answeredCount: number;
  totalQuestions: number;
  cheatingCount?: number;
}): Promise<AssessmentAttempt> => {
  const nowIso = new Date().toISOString();
  const progressPercent = payload.totalQuestions
    ? Math.min(100, Math.round((payload.answeredCount / payload.totalQuestions) * 100))
    : 100;

  const { data, error } = await supabase
    .from('assessment_attempts')
    .update({
      status: 'awaiting_ai',
      ai_status: 'processing',
      answered_count: payload.answeredCount,
      total_questions: payload.totalQuestions,
      progress_percent: progressPercent,
      cheating_count: payload.cheatingCount ?? null,
      submitted_at: nowIso,
      last_activity_at: nowIso,
    })
    .eq('id', payload.attemptId)
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
  const resultsById = new Map<string, ResultRow>();

  for (const result of resultRows) {
    resultsById.set(result.id, result);
  }

  const history: AssessmentHistoryEntry[] = attemptRows.map((row) => {
    const aiSummary = (row.ai_summary as Record<string, unknown> | null) ?? null;
    const resultId = typeof aiSummary?.result_id === 'string' ? (aiSummary.result_id as string) : null;
    const referencedResult = resultId ? resultsById.get(resultId) ?? null : null;
    const fallbackResult = referencedResult
      ? referencedResult
      : resultRows.find((candidate) => candidate.assessment_id === row.assessment_id) ?? null;

    return {
      id: row.id,
      role: row.role ?? 'Chưa xác định',
      assessmentId: row.assessment_id,
      status: row.status,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      completedAt: row.completed_at,
      overallScore: fallbackResult ? Math.round(toNumber(fallbackResult.overall_score, 0)) : null,
      createdAt: row.created_at ?? row.started_at ?? null,
      answeredCount: row.answered_count ?? null,
      totalQuestions: row.total_questions ?? null,
      cheatingCount: row.cheating_count ?? null,
    };
  });

  const activeAttemptRow = attemptRows.find((row) => row.status !== 'completed') ?? null;
  const activeAttempt = activeAttemptRow ? mapAssessmentAttempt(activeAttemptRow) : null;

  const completedAttemptRows = attemptRows.filter((row) => row.status === 'completed');
  const latestCompletedAttemptRow = completedAttemptRows[0] ?? null;

  const selectedRole: Role | null = activeAttempt?.role
    ? { name: activeAttempt.role, title: activeAttempt.role }
    : latestCompletedAttemptRow?.role
    ? { name: latestCompletedAttemptRow.role, title: latestCompletedAttemptRow.role }
    : null;

  let assessmentResultRow: ResultRow | null = null;

  if (latestCompletedAttemptRow) {
    const aiSummary = (latestCompletedAttemptRow.ai_summary as Record<string, unknown> | null) ?? null;
    const resultId = typeof aiSummary?.result_id === 'string' ? (aiSummary.result_id as string) : null;
    if (resultId) {
      assessmentResultRow = resultsById.get(resultId) ?? null;
    }

    if (!assessmentResultRow && latestCompletedAttemptRow.assessment_id) {
      assessmentResultRow =
        resultRows.find(
          (row) =>
            row.assessment_id === latestCompletedAttemptRow.assessment_id &&
            (!latestCompletedAttemptRow.completed_at || row.completed_at === latestCompletedAttemptRow.completed_at),
        ) ?? null;
    }
  }

  if (!assessmentResultRow) {
    assessmentResultRow = resultRows[0] ?? null;
  }

  const assessmentResult = assessmentResultRow ? mapAssessmentResult(assessmentResultRow) : null;
  const status = resolveLifecycleStatus(activeAttempt?.status, Boolean(assessmentResult));

  return {
    selectedRole,
    activeAttempt: status === 'completed' ? null : activeAttempt,
    assessmentResult,
    history,
    status,
  };
};

export const completeAssessmentAttempt = async (payload: {
  attemptId: string;
  profileId: string;
  assessmentId?: string | null;
  result: AssessmentResult;
  answeredCount: number;
  totalQuestions: number;
  durationSeconds?: number | null;
  cheatingCount?: number | null;
  answerIds?: string[];
}): Promise<{ attempt: AssessmentAttempt; result: AssessmentResult }> => {
  const nowIso = payload.result.completedAt ?? new Date().toISOString();
  const progressPercent = payload.totalQuestions
    ? Math.min(100, Math.round((payload.answeredCount / payload.totalQuestions) * 100))
    : 100;

  const resultInsert: Record<string, unknown> = {
    user_id: payload.profileId,
    assessment_id: payload.assessmentId ?? null,
    completed_at: nowIso,
    overall_score: payload.result.score,
    strengths: payload.result.strengths,
    weaknesses: payload.result.weaknesses,
    summary: payload.result.summary ?? null,
    recommended_roles: payload.result.recommendedRoles ?? null,
    ai_summary: payload.result.aiSummary ?? payload.result.summary ?? null,
    analysis_model: payload.result.analysisModel ?? 'gemini-pro',
    analysis_version: payload.result.analysisVersion ?? 'v1',
    analysis_completed_at: nowIso,
    insight_locale: 'vi-VN',
    insight_version: 'v1',
  };

  if (payload.result.metrics?.durationSeconds != null) {
    resultInsert.time_analysis = {
      durationSeconds: payload.result.metrics.durationSeconds,
    };
  }

  if (payload.cheatingCount != null) {
    resultInsert.cheating_summary = { cheatingCount: payload.cheatingCount };
  }

  const { data: resultData, error: resultError } = await supabase
    .from('results')
    .insert(resultInsert)
    .select()
    .single();

  if (resultError) {
    console.error('Failed to persist assessment result:', resultError);
    throw new Error('Khong the luu ket qua danh gia.');
  }

  const resultRow = resultData as ResultRow;

  const answerIds = payload.answerIds ?? [];

  if (answerIds.length > 0) {
    const { error: answerUpdateError } = await supabase
      .from('answers')
      .update({ result_id: resultRow.id })
      .in('id', answerIds);

    if (answerUpdateError) {
      console.warn('Failed to attach answers to result by ids:', answerUpdateError);
    }
  } else {
    const { error: answerUpdateError } = await supabase
      .from('answers')
      .update({ result_id: resultRow.id })
      .eq('attempt_id', payload.attemptId);

    if (answerUpdateError) {
      console.warn('Failed to attach answers to result by attempt id:', answerUpdateError);
    }
  }

  const attemptUpdates: Record<string, unknown> = {
    status: 'completed',
    ai_status: 'completed',
    submitted_at: payload.result.completedAt ?? nowIso,
    completed_at: nowIso,
    last_activity_at: nowIso,
    answered_count: payload.answeredCount,
    total_questions: payload.totalQuestions,
    progress_percent: progressPercent,
    duration_seconds: payload.durationSeconds ?? null,
    cheating_count: payload.cheatingCount ?? null,
    ai_summary: {
      overall_score: payload.result.score,
      summary: payload.result.summary ?? null,
      strengths: payload.result.strengths,
      weaknesses: payload.result.weaknesses,
      result_id: resultRow.id,
    },
  };

  const { data: attemptData, error: attemptError } = await supabase
    .from('assessment_attempts')
    .update(attemptUpdates)
    .eq('id', payload.attemptId)
    .select()
    .single();

  if (attemptError) {
    console.error('Failed to mark assessment attempt as completed:', attemptError);
    throw new Error('Khong the cap nhat trang thai bai danh gia.');
  }

  return {
    attempt: mapAssessmentAttempt(attemptData as AssessmentAttemptRow),
    result: mapAssessmentResult(resultRow),
  };
};

export const getAttemptReview = async (attemptId: string): Promise<AttemptReview | null> => {
  const { data: attemptData, error: attemptError } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle();

  if (attemptError) {
    console.error('Failed to load attempt for review:', attemptError);
    throw new Error('Khong the tai bai danh gia.');
  }

  if (!attemptData) {
    return null;
  }

  const attemptRow = attemptData as AssessmentAttemptRow;
  const attempt = mapAssessmentAttempt(attemptRow);
  const aiSummary = (attemptRow.ai_summary as Record<string, unknown> | null) ?? null;
  const resultIdFromSummary = typeof aiSummary?.result_id === 'string' ? (aiSummary.result_id as string) : null;

  let resultRow: ResultRow | null = null;

  if (resultIdFromSummary) {
    const { data: resultLookup, error: resultLookupError } = await supabase
      .from('results')
      .select('*')
      .eq('id', resultIdFromSummary)
      .maybeSingle();

    if (resultLookupError) {
      console.warn('Failed to load result by id for review:', resultLookupError);
    }

    resultRow = (resultLookup as ResultRow | null) ?? null;
  }

  if (!resultRow && attemptRow.assessment_id) {
    const { data: fallbackResult, error: fallbackError } = await supabase
      .from('results')
      .select('*')
      .eq('user_id', attemptRow.profile_id)
      .eq('assessment_id', attemptRow.assessment_id)
      .order('completed_at', { ascending: false })
      .maybeSingle();

    if (fallbackError) {
      console.warn('Failed to load fallback result for review:', fallbackError);
    }

    resultRow = (fallbackResult as ResultRow | null) ?? null;
  }

  let answerRows = await getAnswersForAttempt(attemptId);

  if (answerRows.length === 0 && resultRow) {
    const { data: resultAnswers, error: resultAnswersError } = await supabase
      .from('answers')
      .select('*')
      .eq('result_id', resultRow.id)
      .order('created_at', { ascending: true });

    if (resultAnswersError) {
      console.warn('Failed to load answers by result id for review:', resultAnswersError);
    }

    answerRows = (resultAnswers as AnswerRow[] | null) ?? [];
  }

  const questionIds = Array.from(new Set(answerRows.map((row) => row.question_id))).filter(Boolean);
  const questions = questionIds.length ? await getQuestionsByIds(questionIds) : [];
  const questionMap = new Map(questions.map((question) => [question.id, question]));

  const answers = answerRows.map((row) => {
    const question = questionMap.get(row.question_id);
    const selectedOptionText = question?.options?.find((option) => option.id === row.selected_option_id)?.text ?? null;

    return {
      id: row.id,
      questionId: row.question_id,
      questionText: question?.text ?? 'Câu hỏi đã được cập nhật',
      format: (question?.format as Question['format']) ?? 'text',
      options: question?.options,
      selectedOptionId: row.selected_option_id,
      selectedOptionText,
      userAnswerText: row.user_answer_text,
    };
  });

  return {
    attempt,
    result: resultRow ? mapAssessmentResult(resultRow) : null,
    answers,
  };
};
