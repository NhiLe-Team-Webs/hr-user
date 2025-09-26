import { supabase } from '../supabaseClient';
import type { Assessment, Question } from '@/types/assessment';
import type { AssessmentAttempt } from '@/types/assessment';
import {
  mapSupabaseQuestion,
  normaliseQuestionFormat,
  type SupabaseQuestionData,
  type SupabaseQuestionOptionData,
} from './questionMappers';
import type { AnswerInput, AnswerRow, AssessmentAttemptRow } from './types';

interface AssessmentRow {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
}

const mapAssessmentAttempt = (row: AssessmentAttemptRow): AssessmentAttempt => ({
  id: row.id,
  profileId: row.profile_id,
  assessmentId: row.assessment_id,
  role: row.role,
  status: row.status,
  answeredCount: row.answered_count ?? 0,
  totalQuestions: row.total_questions ?? 0,
  progressPercent: Number(row.progress_percent ?? 0),
  startedAt: row.started_at,
  submittedAt: row.submitted_at,
  completedAt: row.completed_at,
  lastActivityAt: row.last_activity_at,
  cheatingCount: row.cheating_count ?? 0,
});

const fetchAssessmentRow = async (role: string): Promise<AssessmentRow | null> => {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, title, description, duration')
    .eq('target_role', role)
    .single();

  if (error) {
    console.error(`Failed to load assessment for role ${role}:`, error);
    throw new Error('Không thể tải bài đánh giá.');
  }

  return (data as AssessmentRow | null) ?? null;
};

const fetchAssessmentQuestions = async (assessmentId: string): Promise<SupabaseQuestionData[]> => {
  const { data, error } = await supabase
    .from('questions')
    .select('id, text, format, required, assessment_id, created_at')
    .eq('assessment_id', assessmentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load assessment questions:', error);
    throw new Error('Không thể tải danh sách câu hỏi.');
  }

  return ((data as SupabaseQuestionData[] | null) ?? []).map((question, index) => ({
    ...question,
    // Ensure each question has a deterministic created_at even if null to preserve ordering.
    created_at: question.created_at ?? `${index.toString().padStart(4, '0')}`,
  }));
};

const fetchQuestionOptions = async (questionIds: string[]): Promise<SupabaseQuestionOptionData[]> => {
  if (questionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('question_options')
    .select('id, option_text, is_correct, question_id')
    .in('question_id', questionIds);

  if (error) {
    console.error('Failed to load question options:', error);
    throw new Error('Không thể tải đáp án cho câu hỏi.');
  }

  return (data as SupabaseQuestionOptionData[] | null) ?? [];
};

const attachOptionsToQuestions = (
  questions: SupabaseQuestionData[],
  options: SupabaseQuestionOptionData[],
): Question[] => {
  const optionsByQuestion = options.reduce<Record<string, SupabaseQuestionOptionData[]>>((acc, option) => {
    if (!option.question_id) {
      return acc;
    }
    if (!acc[option.question_id]) {
      acc[option.question_id] = [];
    }
    acc[option.question_id].push(option);
    return acc;
  }, {});

  return questions.map((question) =>
    mapSupabaseQuestion({
      ...question,
      options: optionsByQuestion[question.id] ?? [],
    }),
  );
};

export const getAssessment = async (role: string): Promise<Assessment | null> => {
  const assessmentRow = await fetchAssessmentRow(role);
  if (!assessmentRow) {
    return null;
  }

  const questions = await fetchAssessmentQuestions(assessmentRow.id);
  const options = await fetchQuestionOptions(questions.map((question) => question.id));
  const mappedQuestions = attachOptionsToQuestions(questions, options).map((question) => ({
    ...question,
    format: normaliseQuestionFormat(question.format),
  }));

  return {
    ...assessmentRow,
    duration: Number(assessmentRow.duration ?? 0),
    questions: mappedQuestions,
  } as Assessment;
};

export const getQuestionsByIds = async (questionIds: string[]): Promise<Question[]> => {
  if (questionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('questions')
    .select('id, text, type, format, required, assessment_id, created_at')
    .in('id', questionIds);

  if (error) {
    console.error('Failed to load questions by ids:', error);
    throw new Error('Không thể tải danh sách câu hỏi.');
  }

  const questionRows = (data as SupabaseQuestionData[] | null) ?? [];
  const options = await fetchQuestionOptions(questionRows.map((question) => question.id));
  const mapped = attachOptionsToQuestions(questionRows, options);

  return mapped.sort((a, b) => questionIds.indexOf(a.id) - questionIds.indexOf(b.id));
};

export const upsertAnswer = async (payload: AnswerInput): Promise<AnswerRow> => {
  const base = {
    result_id: payload.resultId ?? null,
    attempt_id: payload.attemptId,
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
      throw new Error('Không thể lưu câu trả lời.');
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
    throw new Error('Không thể lưu câu trả lời.');
  }

  return data as AnswerRow;
};

interface ProfileRow {
  id: string;
  email: string | null;
  name: string | null;
}

const fetchLatestAssessmentAttempt = async (
  profileId: string,
  assessmentId: string,
): Promise<AssessmentAttemptRow | null> => {
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
    throw new Error('Không thể tải tiến độ bài đánh giá.');
  }

  return data as AssessmentAttemptRow | null;
};

export const getLatestAttemptForProfile = async (
  profileId: string,
): Promise<AssessmentAttempt | null> => {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch latest attempt for profile:', error);
    throw new Error('Không thể tải phiên làm bài gần nhất.');
  }

  if (!data) {
    return null;
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

export const getAssessmentAttemptById = async (attemptId: string): Promise<AssessmentAttempt | null> => {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch assessment attempt by id:', error);
    throw new Error('Không thể tải thông tin bài đánh giá.');
  }

  if (!data) {
    return null;
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
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
    throw new Error('Không thể khởi tạo hồ sơ người dùng.');
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

    if (existing.cheating_count == null) {
      updates.cheating_count = 0;
    }

    const { data, error } = await supabase
      .from('assessment_attempts')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update assessment attempt:', error);
      throw new Error('Không thể cập nhật tiến trình bài đánh giá.');
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
      cheating_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create assessment attempt:', error);
    throw new Error('Không thể khởi tạo bài đánh giá.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

export const submitAssessmentAttempt = async (payload: {
  attemptId: string;
  cheatingCount?: number;
  answeredCount?: number;
}): Promise<AssessmentAttempt> => {
  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: 'awaiting_ai',
    submitted_at: nowIso,
    last_activity_at: nowIso,
  };

  if (typeof payload.cheatingCount === 'number') {
    updates.cheating_count = payload.cheatingCount;
  }

  if (typeof payload.answeredCount === 'number') {
    updates.answered_count = payload.answeredCount;
  }

  const { data, error } = await supabase
    .from('assessment_attempts')
    .update(updates)
    .eq('id', payload.attemptId)
    .select()
    .single();

  if (error) {
    console.error('Failed to submit assessment attempt:', error);
    throw new Error('Không thể ghi nhận bài làm.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

export const completeAssessmentAttempt = async (
  attemptId: string,
  answeredCount: number,
  aiSummary?: Record<string, unknown> | null,
): Promise<AssessmentAttempt> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('assessment_attempts')
    .update({
      status: 'completed',
      completed_at: nowIso,
      last_activity_at: nowIso,
      answered_count: answeredCount,
      ai_status: 'completed',
      ai_summary: aiSummary ?? null,
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (error) {
    console.error('Failed to complete assessment attempt:', error);
    throw new Error('Không thể hoàn tất bài đánh giá.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

export const getAnswersByAttempt = async (attemptId: string): Promise<AnswerRow[]> => {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch answers for attempt:', error);
    throw new Error('Không thể tải câu trả lời cho bài làm.');
  }

  return (data as AnswerRow[] | null) ?? [];
};
