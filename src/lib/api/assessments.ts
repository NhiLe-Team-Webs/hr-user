import { apiClient } from '@/lib/httpClient';
import type { Question } from '@/types/question';
import type { AssessmentAttempt, AssessmentResult, AssessmentSkillScore, HrApprovalStatus } from '@/types/assessment';
import { normaliseQuestionFormat } from './questionMappers';
import type { AnswerSnapshotItem } from './types';
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

interface BackendAssessmentResponse {
  success: boolean;
  data: {
    assessment: {
      id: string;
      name: string;
      description?: string;
      role: string;
      duration_minutes: number;
      passing_score?: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    questionCount: number;
  };
}

interface BackendAssessmentsResponse {
  success: boolean;
  data: {
    assessments: Array<{
      id: string;
      name: string;
      description?: string;
      role: string;
      duration_minutes: number;
      passing_score?: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>;
  };
}

interface BackendAttemptResponse {
  success: boolean;
  data: {
    attempt: any; // Will be mapped to AssessmentAttempt
  };
}

interface BackendResultResponse {
  success: boolean;
  data: {
    result: any | null;
    attempt: any;
  };
}

export const getAssessment = async (role: string, roleId?: string) => {
  try {
    // If roleId is provided, fetch by ID, otherwise fetch by role
    // For now, we'll use the assessments list endpoint and filter
    const response = await apiClient.get<BackendAssessmentsResponse>('/hr/assessments');

    if (!response.success || !response.data?.assessments) {
      return null;
    }

    // Find assessment by role
    const assessment = response.data.assessments.find(a => a.role === role);

    if (!assessment) {
      return null;
    }

    // Fetch questions for this assessment
    const questionsResponse = await apiClient.get<any>('/hr/questions', {
      query: { assessment_id: assessment.id, include_options: 'true' },
    });

    const questions = questionsResponse.success && questionsResponse.data?.questions
      ? questionsResponse.data.questions
      : [];

    return {
      id: assessment.id,
      title: assessment.name,
      description: assessment.description || null,
      duration: assessment.duration_minutes || null,
      questions: questions.map((question: any) => ({
        id: question.id,
        text: question.text,
        type: 'General',
        format: normaliseQuestionFormat(question.format),
        required: true,
        points: question.points || 0,
        options: (question.options || []).map((option: any) => ({
          id: option.id,
          text: option.text,
          optionText: option.text,
          isCorrect: option.is_correct,
        })),
        correctAnswer: (question.options || []).find((option: any) => option.is_correct)?.id,
      })),
    };
  } catch (error) {
    console.error(`Failed to load assessment for role ${role} via backend:`, error);
    throw new Error('Khong the tai bai danh gia.');
  }
};

export const getQuestionsByIds = async (questionIds: string[]): Promise<Question[]> => {
  if (questionIds.length === 0) {
    return [];
  }

  try {
    const response = await apiClient.get<any>('/hr/questions/by-ids', {
      query: { ids: questionIds.join(',') },
    });

    if (!response.success || !response.data?.questions) {
      return [];
    }

    return response.data.questions.map((q: any) => ({
      id: q.id,
      text: q.text,
      type: 'General',
      format: normaliseQuestionFormat(q.format),
      required: true,
      points: q.points || 0,
      options: (q.options || []).map((option: any) => ({
        id: option.id,
        text: option.option_text,
        optionText: option.option_text,
        isCorrect: option.is_correct,
      })),
      correctAnswer: (q.options || []).find((option: any) => option.is_correct)?.id,
    }));
  } catch (error) {
    console.error('Failed to load questions by ids via backend:', error);
    throw new Error('Khong the tai danh sach cau hoi.');
  }
};

interface EnsureUserPayload {
  auth_id: string;
  email: string;
  full_name: string;
  token?: string;
}

export const ensureUser = async (payload: EnsureUserPayload): Promise<void> => {
  console.log('[ensureUser] Creating/updating user via backend:', { ...payload, token: payload.token ? '***' : undefined });

  try {
    const { token, ...body } = payload;
    const options: any = {};

    if (token) {
      options.headers = { Authorization: `Bearer ${token}` };
    }

    await apiClient.post('/hr/candidates/ensure', body, options);
    console.log('[ensureUser] User ensured successfully via backend');
  } catch (error) {
    console.error('[ensureUser] Failed to ensure user via backend:', error);
    throw new Error('Khong the khoi tao ho so nguoi dung.');
  }
};

/**
 * Starts a new assessment attempt for a candidate.
 */
export const startAssessmentAttempt = async (payload: {
  userId: string;
  assessmentId: string;
  role: string;
  roleId?: string;
  totalQuestions: number;
}): Promise<AssessmentAttempt> => {
  try {
    const response = await apiClient.post<BackendAttemptResponse>('/hr/assessments/attempts', {
      assessment_id: payload.assessmentId,
      role: payload.role,
      user_id: payload.userId,
    });

    if (!response.success || !response.data?.attempt) {
      throw new Error('Invalid response from backend');
    }

    return mapAssessmentAttempt(response.data.attempt);
  } catch (error) {
    console.error('Failed to start assessment attempt via backend:', error);
    throw new Error('Khong the khoi tao bai danh gia.');
  }
};

export const updateAssessmentAttemptMeta = async (
  attemptId: string,
  meta: {
    cheating_count?: number;
    cheating_events?: any[];
    question_timings?: Record<string, number>;
  }
): Promise<void> => {
  try {
    await apiClient.put(`/hr/assessments/attempts/${attemptId}/meta`, meta);
  } catch (error) {
    console.error('Failed to update attempt meta via backend:', error);
    // Non-blocking error
  }
};

export const submitAnswer = async (payload: {
  attemptId: string;
  questionId: string;
  answer: string | string[];
  timeSpent: number;
}): Promise<void> => {
  try {
    await apiClient.post(`/hr/assessments/attempts/${payload.attemptId}/answers`, {
      question_id: payload.questionId,
      answer: payload.answer,
      time_spent: payload.timeSpent,
    });
  } catch (error) {
    console.error('Failed to submit answer via backend:', error);
    throw new Error('Khong the luu cau tra loi.');
  }
};

export const submitAssessmentAttempt = async (
  attemptId: string,
  payload: {
    answersSnapshot?: AnswerSnapshotItem[];
    durationSeconds: number;
    averageSecondsPerQuestion?: number | null;
    cheatingCount?: number;
  }
): Promise<AssessmentAttempt> => {
  try {
    const response = await apiClient.post<BackendAttemptResponse>(
      `/hr/assessments/attempts/${attemptId}/submit`,
      {
        answers_snapshot: payload.answersSnapshot || [],
        duration_seconds: payload.durationSeconds,
      }
    );

    if (!response.success || !response.data?.attempt) {
      throw new Error('Invalid response from backend');
    }

    return mapAssessmentAttempt(response.data.attempt);
  } catch (error) {
    console.error('Failed to submit assessment via backend:', error);
    throw new Error('Khong the nop bai.');
  }
};

export interface FinaliseAssessmentOptions {
  attemptId: string;
  durationSeconds: number;
  answersSnapshot?: AnswerSnapshotItem[];
}

export interface FinaliseAssessmentResult {
  attempt: AssessmentAttempt;
  result: AssessmentResult | null;
  aiStatus: string;
}

const mapBackendResultToFrontend = (backendResult: any): AssessmentResult | null => {
  if (!backendResult) return null;
  return {
    summary: backendResult.summary || backendResult.ai_summary || null,
    strengths: backendResult.strengths || [],
    developmentAreas: backendResult.development_areas || backendResult.weaknesses || [],
    skillScores: backendResult.skill_scores || [],
    recommendedRoles: backendResult.recommended_roles || [],
    developmentSuggestions: backendResult.development_suggestions || [],
    completedAt: backendResult.created_at || null,
    hrApprovalStatus: backendResult.hr_approval_status || 'pending',
    teamFit: backendResult.team_fit || [],
    aiAnalysisAvailable: backendResult.ai_analysis_available !== false,
  };
};

export const finaliseAssessmentAttempt = async (payload: FinaliseAssessmentOptions): Promise<FinaliseAssessmentResult> => {
  try {
    const requestBody: any = {
      duration_seconds: payload.durationSeconds,
    };

    // Include answers_snapshot if provided
    if (payload.answersSnapshot && payload.answersSnapshot.length > 0) {
      requestBody.answers_snapshot = payload.answersSnapshot;
    }

    const response = await apiClient.post<BackendResultResponse>(
      `/hr/assessments/attempts/${payload.attemptId}/finalize`,
      requestBody
    );

    if (!response.success || !response.data?.attempt) {
      throw new Error('Invalid response from backend');
    }

    // Note: Result might be null if AI processing is async
    return {
      attempt: mapAssessmentAttempt(response.data.attempt),
      result: mapBackendResultToFrontend(response.data.result),
      aiStatus: response.data.attempt.ai_status || 'completed',
    };
  } catch (error) {
    console.error('Failed to finalize assessment via backend:', error);
    throw new Error('Khong the hoan tat bai danh gia.');
  }
};

export interface LatestResultRecord {
  id: string;
  assessmentId: string;
  role?: string;
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
  teamFit: string[] | { id: string; name: string }[];
}

export const getLatestResult = async (
  userId: string, // Auth ID
  assessmentId?: string | null,
): Promise<LatestResultRecord | null> => {
  if (!userId) {
    throw new Error('Khong the tai ket qua danh gia.');
  }

  try {
    const query: Record<string, string> = {};
    if (assessmentId) {
      query.assessment_id = assessmentId;
    }

    const response = await apiClient.get<{ success: boolean; data: LatestResultRecord | null }>(
      `/hr/candidates/${userId}/latest-result`,
      { query }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch latest assessment result via backend:', error);
    // Return null if not found or error, allowing UI to handle "no result" state
    return null;
  }
};

export const getActiveAttempt = async (userId: string): Promise<AssessmentAttempt | null> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: AssessmentAttempt | null }>(
      `/hr/candidates/${userId}/active-attempt`
    );
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch active attempt:', error);
    return null;
  }
};

export const upsertAnswer = async (payload: {
  id?: string;
  attemptId?: string | null;
  questionId: string;
  selectedOptionId?: string | null;
  userAnswerText?: string | null;
  timeSpentSeconds?: number;
}): Promise<any> => {
  try {
    // For now, just log - answers will be retrieved from attempt when finalizing
    console.log('[upsertAnswer] Answer recorded:', {
      questionId: payload.questionId,
      hasAnswer: !!(payload.selectedOptionId || payload.userAnswerText),
    });

    // TODO: Implement backend endpoint to save individual answers
    // For now, answers are stored in frontend state and will be sent on finalize
    return { id: payload.id || 'temp-id' };
  } catch (error) {
    console.error('[upsertAnswer] Failed to save answer:', error);
    return null;
  }
};
