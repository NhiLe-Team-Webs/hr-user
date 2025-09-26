import { supabase } from '../supabaseClient';
import type { Question } from '../types/question';
import type { Assessment, AssessmentAttempt } from '@/types/assessment';
import {
  mapSupabaseQuestion,
  type SupabaseQuestionData,
  type SupabaseQuestionOptionData,
} from './questionMappers';
import type { AnswerInput, AnswerRow, AssessmentAttemptRow } from './types';
import { getResultForAttempt } from './results';
import type { AssessmentResult } from '@/types/assessment';

const mapAssessmentAttempt = (row: AssessmentAttemptRow): AssessmentAttempt => ({
  id: row.id,
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

const mapQuestionRows = (
  rows: SupabaseQuestionData[],
  optionsByQuestion: Record<string, SupabaseQuestionOptionData[]>,
): Question[] =>
  rows.map((row) =>
    mapSupabaseQuestion({
      ...row,
      options: optionsByQuestion[row.id] ?? [],
    }),
  );

const fetchQuestionOptions = async (questionIds: string[]) => {
  if (questionIds.length === 0) {
    return {} as Record<string, SupabaseQuestionOptionData[]>;
  }

  const { data, error } = await supabase
    .from('question_options')
    .select('id, question_id, option_text, is_correct')
    .in('question_id', questionIds);

  if (error) {
    console.error('Failed to load question options:', error);
    throw new Error('Khong the tai lua chon cau hoi.');
  }

  const rows = (data as SupabaseQuestionOptionData[] | null) ?? [];
  return rows.reduce<Record<string, SupabaseQuestionOptionData[]>>((acc, option) => {
    const questionId = option.question_id ?? '';
    if (!acc[questionId]) {
      acc[questionId] = [];
    }
    acc[questionId].push(option);
    return acc;
  }, {});
};

export const getAssessment = async (role: string): Promise<Assessment | null> => {
  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('assessments')
    .select('id, title, description, duration')
    .eq('target_role', role)
    .maybeSingle();

  if (assessmentError) {
    console.error(`Failed to load assessment for role ${role}:`, assessmentError);
    throw new Error('Khong the tai bai danh gia.');
  }

  if (!assessmentRow) {
    return null;
  }

  const { data: questionRows, error: questionsError } = await supabase
    .from('questions')
    .select('id, text, type, format, required, assessment_id, created_at')
    .eq('assessment_id', assessmentRow.id)
    .order('created_at', { ascending: true });

  if (questionsError) {
    console.error('Failed to load questions for assessment:', questionsError);
    throw new Error('Khong the tai danh sach cau hoi.');
  }

  const rawQuestions = (questionRows as SupabaseQuestionData[] | null) ?? [];
  const optionsByQuestion = await fetchQuestionOptions(rawQuestions.map((question) => question.id));
  const questions = mapQuestionRows(rawQuestions, optionsByQuestion);

  return {
    id: assessmentRow.id,
    title: assessmentRow.title,
    description: assessmentRow.description,
    duration: assessmentRow.duration ?? 0,
    questions,
  } satisfies Assessment;
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
    throw new Error('Khong the tai danh sach cau hoi.');
  }

  const rows = (data as SupabaseQuestionData[] | null) ?? [];
  const optionsByQuestion = await fetchQuestionOptions(rows.map((question) => question.id));
  return mapQuestionRows(rows, optionsByQuestion);
};

export const upsertAnswer = async (payload: AnswerInput): Promise<AnswerRow> => {
  const base = {
    assessment_attempt_id: payload.attemptId ?? null,
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
      cheating_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create assessment attempt:', error);
    throw new Error('Khong the khoi tao bai danh gia.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

export const submitAssessmentAttempt = async (
  attemptId: string,
  cheatingCount = 0,
): Promise<AssessmentAttempt> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('assessment_attempts')
    .update({
      status: 'awaiting_ai',
      submitted_at: nowIso,
      last_activity_at: nowIso,
      cheating_count: cheatingCount,
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

export const getAnswersForAttempt = async (attemptId: string): Promise<AnswerRow[]> => {
  const { data, error } = await supabase
    .from('answers')
    .select('id, assessment_attempt_id, result_id, question_id, user_answer_text, selected_option_id, created_at')
    .eq('assessment_attempt_id', attemptId);

  if (error) {
    console.error('Failed to load answers for attempt:', error);
    throw new Error('Khong the tai cau tra loi.');
  }

  return (data as AnswerRow[] | null) ?? [];
};

export interface AttemptAnswerDetail {
  answer: AnswerRow;
  question: Question | null;
  resolvedAnswer: string;
}

export const getAttemptAnswerDetails = async (
  attemptId: string,
): Promise<{ details: AttemptAnswerDetail[]; completedCount: number }> => {
  const answers = await getAnswersForAttempt(attemptId);
  const questionIds = Array.from(new Set(answers.map((answer) => answer.question_id)));
  const questions = await getQuestionsByIds(questionIds);
  const questionMap = new Map(questions.map((question) => [question.id, question]));

  const details = answers.map<AttemptAnswerDetail>((answer) => {
    const question = questionMap.get(answer.question_id) ?? null;
    let resolvedAnswer = answer.user_answer_text ?? '';

    if (!resolvedAnswer && answer.selected_option_id && question?.options) {
      const selected = question.options.find((option) => option.id === answer.selected_option_id);
      resolvedAnswer = selected?.text ?? '';
    }

    return {
      answer,
      question,
      resolvedAnswer: resolvedAnswer?.trim() ?? '',
    };
  });

  const completedCount = details.filter((detail) => detail.resolvedAnswer.length > 0).length;

  return { details, completedCount };
};

export const getCandidateProgress = async (
  profileId: string,
): Promise<{ attempt: AssessmentAttempt | null; result: AssessmentResult | null }> => {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to load candidate progress:', error);
    throw new Error('Khong the tai tien trinh ung vien.');
  }

  if (!data) {
    return { attempt: null, result: null };
  }

  const attempt = mapAssessmentAttempt(data as AssessmentAttemptRow);
  const result = await getResultForAttempt(attempt.id);

  return { attempt, result };
};
