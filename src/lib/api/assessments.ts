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

export const getAssessment = async (role: string, roleId?: string) => {
  // Build query with optional role_id filter
  let query = supabase
    .from('interview_assessments')
    .select(
      `
        id,
        title,
        description,
        duration,
        target_role,
        questions:interview_questions(
          id,
          text,
          format,
          required,
          options:interview_question_options(id, option_text, is_correct)
        )
      `,
    );

  // Filter by target_role (for backward compatibility) or role_id if provided
  if (roleId) {
    query = query.eq('id', roleId);
  } else {
    query = query.eq('target_role', role);
  }

  const { data, error } = await query.single();

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
    .from('interview_questions')
    .select(
      `
        id,
        text,
        type,
        format,
        required,
        assessment_id,
        created_at,
        options:interview_question_options(id, option_text, is_correct)
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
    attempt_id: payload.attemptId ?? null,
    result_id: payload.resultId ?? null,
    question_id: payload.questionId,
    user_answer_text: payload.userAnswerText ?? null,
    selected_option_id: payload.selectedOptionId ?? null,
  };

  if (typeof payload.attemptId !== 'undefined') {
    base.attempt_id = payload.attemptId;
  }

  if (typeof payload.timeSpentSeconds === 'number') {
    base.time_spent_seconds = Math.max(0, Math.round(payload.timeSpentSeconds));
  } else if (payload.timeSpentSeconds === null) {
    base.time_spent_seconds = null;
  }

  if (payload.id) {
    const { data, error } = await supabase
      .from('interview_answers')
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
    .from('interview_answers')
    .insert(base)
    .select()
    .single();

  if (error) {
    console.error('Failed to insert answer:', error);
    throw new Error('Khong the luu cau tra loi.');
  }

  return data as AnswerRow;
};

interface UserRow {
  auth_id: string;
  email: string | null;
  full_name: string | null;
}

const fetchLatestAssessmentAttempt = async (authId: string, assessmentId: string) => {
  const { data, error } = await supabase
    .from('interview_assessment_attempts')
    .select('*, user:users!inner(auth_id)')
    .eq('user.auth_id', authId)
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

export const ensureUser = async (payload: UserRow): Promise<void> => {
  console.log('[ensureUser] Creating/updating user:', { auth_id: payload.auth_id, email: payload.email, name: payload.full_name });

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        auth_id: payload.auth_id,
        email: payload.email,
        full_name: payload.full_name,
        role: 'candidate',
      },
      { onConflict: 'email' },
    )
    .select();

  if (error) {
    console.error('[ensureUser] Failed to ensure user:', error);
    throw new Error('Khong the khoi tao ho so nguoi dung.');
  }

  console.log('[ensureUser] User ensured successfully:', data);
};

/**
 * Starts a new assessment attempt for a candidate.
 * 
 * Note: In this system, roles are defined by the interview_assessments table via the target_role field.
 * Each assessment has a unique target_role, creating a 1:1 relationship between assessments and roles.
 * Therefore, the assessmentId effectively serves as the role identifier.
 * 
 * @param payload.userId - The Auth ID of the user
 * @param payload.assessmentId - The assessment ID, which uniquely identifies the role
 * @param payload.role - The role name (target_role) for display purposes
 * @param payload.roleId - Optional, for backward compatibility (not stored in database)
 * @param payload.totalQuestions - Total number of questions in the assessment
 * @returns The created or updated assessment attempt
 */
export const startAssessmentAttempt = async (payload: {
  userId: string;
  assessmentId: string;
  role: string;
  roleId?: string;
  totalQuestions: number;
}): Promise<AssessmentAttempt> => {
  // Check if user already has a completed result
  // TEMPORARILY DISABLED FOR TESTING - REMOVE THIS COMMENT WHEN READY FOR PRODUCTION
  const ALLOW_RETAKE_FOR_TESTING = true; // Set to false in production

  if (!ALLOW_RETAKE_FOR_TESTING) {
    const { data: existingResult, error: resultError } = await supabase
      .from('interview_results')
      .select('id, hr_review_status, user:users!inner(auth_id)')
      .eq('user.auth_id', payload.userId)
      .limit(1)
      .maybeSingle();

    if (resultError) {
      console.error('Failed to check existing result:', resultError);
      throw new Error('Khong the kiem tra trang thai danh gia.');
    }

    if (existingResult) {
      throw new Error('Ban da hoan thanh danh gia. Khong the lam lai.');
    }
  }

  const nowIso = new Date().toISOString();
  const existing = await fetchLatestAssessmentAttempt(payload.userId, payload.assessmentId);

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
      .from('interview_assessment_attempts')
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

  // Get internal user ID from Auth ID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', payload.userId)
    .single();

  if (userError || !userData) {
    console.error('Failed to find user for assessment:', userError);
    throw new Error('Khong tim thay thong tin nguoi dung.');
  }

  const { data, error} = await supabase
    .from('interview_assessment_attempts')
    .insert({
      user_id: userData.id,
      assessment_id: payload.assessmentId, // assessment_id serves as the role identifier
      role: payload.role, // Store the role name for display purposes
      total_questions: payload.totalQuestions,
      status: 'in_progress',
      started_at: nowIso,
      last_activity_at: nowIso,
      ai_status: 'idle',
      last_ai_error: null,
      cheating_count: 0,
      duration_seconds: null,
      average_seconds_per_question: null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create assessment attempt:', error);
    throw new Error('Khong the khoi tao bai danh gia.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

interface SubmitAttemptOptions {
  durationSeconds?: number | null;
  averageSecondsPerQuestion?: number | null;
  cheatingCount?: number | null;
}

export const submitAssessmentAttempt = async (
  attemptId: string,
  meta?: SubmitAttemptOptions,
): Promise<AssessmentAttempt> => {
  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: 'awaiting_ai',
    submitted_at: nowIso,
    last_activity_at: nowIso,
    last_ai_error: null,
    ai_status: 'processing',
  } satisfies Record<string, unknown>;

  if (typeof meta?.durationSeconds === 'number') {
    updates.duration_seconds = Math.max(0, Math.round(meta.durationSeconds));
  } else if (meta?.durationSeconds === null) {
    updates.duration_seconds = null;
  }

  if (
    typeof meta?.averageSecondsPerQuestion === 'number' &&
    Number.isFinite(meta.averageSecondsPerQuestion)
  ) {
    const safeAverage = Math.max(0, meta.averageSecondsPerQuestion);
    updates.average_seconds_per_question = Math.round(safeAverage * 100) / 100;
  } else if (meta?.averageSecondsPerQuestion === null) {
    updates.average_seconds_per_question = null;
  }

  if (typeof meta?.cheatingCount === 'number') {
    updates.cheating_count = Math.max(0, Math.round(meta.cheatingCount));
  }

  const { data, error } = await supabase
    .from('interview_assessment_attempts')
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

export const updateAssessmentAttemptMeta = async (
  attemptId: string,
  payload: {
    cheatingCount?: number;
    durationSeconds?: number | null;
    averageSecondsPerQuestion?: number | null;
  },
): Promise<void> => {
  const updates: Record<string, unknown> = {};

  if (typeof payload.cheatingCount === 'number') {
    updates.cheating_count = Math.max(0, Math.round(payload.cheatingCount));
  }

  if (typeof payload.durationSeconds === 'number') {
    updates.duration_seconds = Math.max(0, Math.round(payload.durationSeconds));
  } else if (payload.durationSeconds === null) {
    updates.duration_seconds = null;
  }

  if (
    typeof payload.averageSecondsPerQuestion === 'number' &&
    Number.isFinite(payload.averageSecondsPerQuestion)
  ) {
    const safeAverage = Math.max(0, payload.averageSecondsPerQuestion);
    updates.average_seconds_per_question = Math.round(safeAverage * 100) / 100;
  } else if (payload.averageSecondsPerQuestion === null) {
    updates.average_seconds_per_question = null;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  updates.last_activity_at = new Date().toISOString();

  const { error } = await supabase
    .from('assessment_attempts')
    .update(updates)
    .eq('id', attemptId);

  if (error) {
    console.error('Failed to update assessment attempt metadata:', error);
    throw new Error('Khong the cap nhat thong tin bai danh gia.');
  }
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
    .from('interview_assessment_attempts')
    .update({
      last_ai_error: truncateErrorMessage(message),
      last_activity_at: nowIso,
      ai_status: 'failed',
    })
    .eq('id', attemptId);
};

export interface CheatingEvent {
  type?: string;
  questionId: string | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AnswerSnapshotItem {
  questionNumber: number;
  questionId: string;
  questionText: string;
  questionFormat: string;
  userAnswer: string | null;
  selectedOptionIndex?: number | null;
  allOptions: string[];
  correctAnswer?: string | null;
  isCorrect?: boolean | null;
  answeredAt: string;
}

export interface FinaliseAssessmentOptions {
  attemptId: string;
  assessmentId: string;
  userId: string; // Auth ID
  role: string;
  candidateName: string | null;
  language: 'vi' | 'en';
  answers: GeminiAnswerPayload[];
  answersSnapshot?: AnswerSnapshotItem[]; // Full snapshot with all details
  questionTimings?: Record<string, number>;
  durationSeconds?: number;
  averageSecondsPerQuestion?: number;
  cheatingCount?: number;
  cheatingEvents?: CheatingEvent[];
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
    // Fetch available teams with both id and name
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .is('deleted_at', null);

    const availableTeams = teamsData?.map(t => t.name) || [];
    const teamsMap = new Map(teamsData?.map(t => [t.name, t.id]) || []);

    const analysis: GeminiAnalysisResponse = await analyzeWithGemini({
      role: payload.role,
      candidateName: payload.candidateName,
      language: payload.language,
      answers: payload.answers,
      availableTeams,
    });

    const completedAt = new Date().toISOString();

    // Map team names to team IDs
    let teamFitId: string | null = null;
    if (analysis.teamFit.length > 0) {
      const firstRecommendedTeam = analysis.teamFit[0];
      teamFitId = teamsMap.get(firstRecommendedTeam) || null;
    }

    const structuredSummary = {
      strengths: analysis.strengths,
      development_areas: analysis.developmentAreas,
      skill_scores: analysis.skillScores,
      summary: analysis.summary,
      team_fit: analysis.teamFit,
    } satisfies Record<string, unknown>;

    // Get internal user ID from Auth ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', payload.userId)
      .single();

    if (userError || !userData) {
      throw new Error('Khong tim thay thong tin nguoi dung.');
    }

    const resultPayload = {
      user_id: userData.id,
      assessment_id: payload.assessmentId,
      strengths: analysis.strengths,
      weaknesses: analysis.developmentAreas,
      development_suggestions: analysis.developmentAreas,
      recommended_roles: analysis.recommendedRoles,
      skill_scores: analysis.skillScores,
      summary: structuredSummary,
      ai_summary: analysis.summary,
      analysis_model: GEMINI_MODEL_NAME,
      analysis_completed_at: completedAt,
      insight_locale: payload.language,
      team_fit: teamFitId, // Store team UUID (not array)
    } satisfies Record<string, unknown>;

    const { error: resultError } = await supabase.from('interview_results').insert(resultPayload);

    if (resultError) {
      console.error('Failed to persist assessment result:', resultError);
      throw new Error('Khong the luu ket qua danh gia.');
    }

    console.log('[finaliseAssessmentAttempt] Saving answers_snapshot:', {
      count: payload.answersSnapshot?.length ?? 0,
      snapshot: payload.answersSnapshot,
    });

    const { data: attemptData, error: attemptError } = await supabase
      .from('interview_assessment_attempts')
      .update({
        status: 'completed',
        completed_at: completedAt,
        last_activity_at: completedAt,
        last_ai_error: null,
        ai_status: 'completed',
        question_timings: payload.questionTimings ?? null,
        duration_seconds: payload.durationSeconds ?? null,
        average_seconds_per_question: payload.averageSecondsPerQuestion ?? null,
        cheating_count: payload.cheatingCount ?? 0,
        cheating_events: payload.cheatingEvents ?? null,
        answers_snapshot: payload.answersSnapshot ?? null,
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
  user_id: string;
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
  user?: Array<{ band: string | null }> | null;
  created_at: string;
  team_fit?: unknown;
}

type SummaryPayload = {
  strengths?: unknown;
  development_areas?: unknown;
  skill_scores?: unknown;
  recommended_roles?: unknown;
  development_suggestions?: unknown;
  overall_score?: unknown;
  summary?: unknown;
  team_fit?: unknown;
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

const extractHrApprovalStatusFromRow = (row: { hr_review_status?: unknown; user?: Array<{ band?: unknown }> | null }): HrApprovalStatus => {
  const reviewStatus = normaliseHrApprovalStatus(row.hr_review_status);
  if (reviewStatus) {
    return reviewStatus;
  }

  const userRecord = Array.isArray(row.user) ? row.user[0] : null;
  const bandStatus = normaliseHrApprovalStatus(userRecord?.band ?? null);

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

export interface LatestResultRecord {
  id: string;
  assessmentId: string;
  userId: string;
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
  teamFit: string[];
}

export const getLatestResult = async (
  userId: string, // Auth ID
  assessmentId?: string | null,
): Promise<LatestResultRecord | null> => {
  if (!userId) {
    throw new Error('Khong the tai ket qua danh gia.');
  }

  let query = supabase
    .from('interview_results')
    .select(
      `
        id,
        user_id,
        assessment_id,
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
        team_fit,
        user:users!inner(band, auth_id),
        created_at
      `,
    )
    .eq('user.auth_id', userId);

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

  // Handle team_fit as UUID and fetch team name
  let teamFit: string[] = [];
  if (row.team_fit) {
    if (typeof row.team_fit === 'string') {
      // team_fit is a UUID, fetch team name
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', row.team_fit)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (teamData?.name) {
        teamFit = [teamData.name];
      }
    } else {
      // Fallback to old format (JSONB array of team names)
      teamFit = collectStringValues(row.team_fit, summaryPayload?.team_fit);
    }
  }

  return {
    id: row.id,
    assessmentId: row.assessment_id,
    userId: row.user_id,
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
    teamFit,
  } satisfies LatestResultRecord;
};
