// src/lib/api.ts

import { supabase } from './supabaseClient';
import { Question, QuestionsByRole } from '../types/question';
import type { AssessmentAttempt } from '@/types/assessment';
import { LandingPage } from '@/types/landingPage';


const landingPageFallbacks = {
  error_title: 'CÃ³ lá»—i xáº£y ra',
  error_subtitle: 'ChÃºng tÃ´i Ä‘ang kiá»ƒm tra sá»± cá»‘. Vui lÃ²ng thá»­ láº¡i sau Ã­t phÃºt.',
  error_cta_text: 'Quay vá» trang chá»§',
  error_cta_link: '/',
} as const;

const applyLandingPageFallbacks = (payload: LandingPage): LandingPage => ({
  ...payload,
  error_title: payload.error_title ?? landingPageFallbacks.error_title,
  error_subtitle: payload.error_subtitle ?? landingPageFallbacks.error_subtitle,
  error_cta_text: payload.error_cta_text ?? landingPageFallbacks.error_cta_text,
  error_cta_link: payload.error_cta_link ?? landingPageFallbacks.error_cta_link,
});

// ===========================================
// === INTERFACES Äá»‚ Äáº¢M Báº¢O AN TOÃ€N KIá»‚U ===
// ===========================================

// Interfaces cho hÃ m getQuestionsByRole
interface SupabaseQuestionData {
  id: string;
  text: string;
  type?: string;
  format: 'text' | 'multiple_choice' | 'multiple-choice';
  required?: boolean;
  options: {
    id: string;
    option_text: string;
    is_correct: boolean;
  }[];
}


// Interfaces cho hÃ m updateCandidateInfo
interface ProfileUpdates {
  name?: string;
  email?: string;
  role?: string;
  band?: string;
}

// Interfaces cho hÃ m getRoles
interface SupabaseRoleData {
  target_role: string;
}

// Interfaces cho hÃ m getAnalyticsData
interface SupabaseAnalyticsUser {
  id: string;
  name: string;
  band: string | null;
}

interface SupabaseAnalyticsAssessment {
  target_role: string;
}

interface SupabaseAnalyticsRow {
  total_score: number | null;
  assessment: SupabaseAnalyticsAssessment[] | null;
  user: SupabaseAnalyticsUser[] | null;
}

// Interfaces cho hÃ m getCandidates
interface SupabaseCandidateProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  band: string | null;
  results: { total_score: number | null }[];
}

interface CandidateInfo {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string | null;
  band: string | null;
  avatarChar: string;
  scores: {
    overall: number | null;
  };
  status: 'completed' | 'in_progress';
  startTime: Date;
  phone: string;
  telegram: string;
}


// Interfaces cho hÃ m getCandidateDetails
interface SupabaseCandidateDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  band: string | null;
  scores: { total_score: number | null }[];
}


// ===============================================
// === CÃC HÃ€M API CHO CHá»¨C NÄ‚NG LANDING PAGE ===
// ===============================================

/**
 * Láº¥y dá»¯ liá»‡u trang landing page tá»« database.
 */
export const getLandingPageData = async (): Promise<LandingPage> => {
  const { data, error } = await supabase
    .from('landing_page')
    .select('*')
    .single();

  if (error) {
    console.error('Lá»—i khi táº£i dá»¯ liá»‡u landing page:', error);
    throw new Error('KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u landing page.');
  }
  return applyLandingPageFallbacks(data as LandingPage);
};

/**
 * Cáº­p nháº­t dá»¯ liá»‡u trang landing page vÃ o database.
 * @param data Dá»¯ liá»‡u cáº§n cáº­p nháº­t.
 */
export const updateLandingPageData = async (data: Partial<LandingPage>) => {
  const { error } = await supabase
    .from('landing_page')
    .update(data)
    .eq('id', 1);

  if (error) {
    console.error('Lá»—i khi lÆ°u dá»¯ liá»‡u landing page:', error);
    throw new Error('KhÃ´ng thá»ƒ lÆ°u dá»¯ liá»‡u landing page.');
  }
};

// ==================================================
// === CÃC HÃ€M API CHO CHá»¨C NÄ‚NG QUáº¢N LÃ CÃ‚U Há»ŽI ===
// ==================================================

/**
 * Láº¥y danh sÃ¡ch cÃ¡c vai trÃ² (vá»‹ trÃ­ cÃ´ng viá»‡c) duy nháº¥t tá»« database.
 */
export const getRoles = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('assessments')
    .select('target_role');

  if (error) {
    console.error('Lá»—i khi táº£i danh sÃ¡ch vai trÃ²:', error);
    return [];
  }

  const roles = data as SupabaseRoleData[];
  const uniqueRoles = [...new Set(roles.map(item => item.target_role))];
  return uniqueRoles;
};

/**
 * Láº¥y táº¥t cáº£ cÃ¢u há»i cho má»™t vai trÃ² cá»¥ thá»ƒ.
 * @param role TÃªn vai trÃ².
 */
export const getQuestionsByRole = async (role: string): Promise<Question[]> => {
  const { data: assessmentData, error: assessmentError } = await supabase
    .from('assessments')
    .select('id')
    .eq('target_role', role)
    .single();

  if (assessmentError) {
    console.error(`Lá»—i khi táº£i assessment cho vai trÃ² ${role}:`, assessmentError);
    return [];
  }
  
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      text,
      format,
      required,
      options:question_options(id, option_text, is_correct)
    `)
    .eq('assessment_id', assessmentData.id);

  if (error) {
    console.error(`Lá»—i khi táº£i cÃ¢u há»i cho vai trÃ² ${role}:`, error);
    throw new Error('KhÃ´ng thá»ƒ táº£i cÃ¢u há»i.');
  }

  const formattedData = (data as SupabaseQuestionData[]).map(q => {
    const format = q.format === 'multiple-choice' ? 'multiple_choice' : q.format;
    const formattedQuestion: Question = {
      id: q.id,
      text: q.text,
      type: q.type ?? 'General',
      format,
      required: q.required ?? true,
      points: 0,
    };

    if (format === 'multiple_choice' && q.options) {
      formattedQuestion.options = q.options.map(opt => ({
        id: opt.id,
        text: opt.option_text,
      }));
      formattedQuestion.correctAnswer = q.options.find(opt => opt.is_correct)?.id;
    }
    
    return formattedQuestion;
  });

  return formattedData;
};

/**
 * Táº¡o má»™t cÃ¢u há»i má»›i vÃ  cÃ¡c phÆ°Æ¡ng Ã¡n tráº£ lá»i tÆ°Æ¡ng á»©ng.
 * @param questionData Dá»¯ liá»‡u cÃ¢u há»i.
 * @param targetRole Vai trÃ² cá»§a cÃ¢u há»i.
 * @returns Promise<Question>
 */
export const createQuestion = async (questionData: Omit<Question, 'id'>, targetRole: string): Promise<Question> => {
  // TÃ¬m assessment_id cho role
  const { data: assessment, error: assessmentError } = await supabase
    .from('assessments')
    .select('id')
    .eq('target_role', targetRole)
    .single();

  if (assessmentError) {
    console.error('KhÃ´ng tÃ¬m tháº¥y bÃ i Ä‘Ã¡nh giÃ¡ cho vai trÃ² nÃ y.');
    throw new Error('KhÃ´ng thá»ƒ táº¡o cÃ¢u há»i.');
  }

  const { data: newQuestion, error: questionError } = await supabase
    .from('questions')
    .insert([{
      text: questionData.text,
      format: questionData.format,
      required: questionData.required,
      assessment_id: assessment.id
    }])
    .select()
    .single();

  if (questionError) {
    console.error('Lá»—i khi táº¡o cÃ¢u há»i:', questionError);
    throw new Error('KhÃ´ng thá»ƒ táº¡o cÃ¢u há»i.');
  }

  if (questionData.format === 'multiple_choice' && questionData.options) {
    const optionsToInsert = questionData.options.map(opt => ({
      question_id: newQuestion.id,
      option_text: opt.text,
      is_correct: opt.id === questionData.correctAnswer,
    }));

    const { error: optionsError } = await supabase
      .from('question_options')
      .insert(optionsToInsert);

    if (optionsError) {
      console.error('Lá»—i khi táº¡o options:', optionsError);
      throw new Error('KhÃ´ng thá»ƒ táº¡o cÃ¡c phÆ°Æ¡ng Ã¡n tráº£ lá»i.');
    }
  }

  return {
    ...newQuestion,
    format: newQuestion.format === 'multiple-choice' ? 'multiple_choice' : newQuestion.format,
    type: questionData.type ?? 'General',
  };
};

/**
 * Cáº­p nháº­t thÃ´ng tin cá»§a má»™t cÃ¢u há»i vÃ  cÃ¡c phÆ°Æ¡ng Ã¡n tráº£ lá»i.
 * @param questionData Dá»¯ liá»‡u cÃ¢u há»i cáº§n cáº­p nháº­t.
 * @returns Promise<void>
 */
export const updateQuestion = async (questionData: Partial<Question>): Promise<void> => {
  const { error: questionError } = await supabase
    .from('questions')
    .update({
      text: questionData.text,
      format: questionData.format,
      required: questionData.required,
    })
    .eq('id', questionData.id);

  if (questionError) {
    console.error('Lá»—i khi cáº­p nháº­t cÃ¢u há»i:', questionError);
    throw new Error('KhÃ´ng thá»ƒ cáº­p nháº­t cÃ¢u há»i.');
  }

  if (questionData.format === 'multiple_choice' && questionData.options) {
    await supabase
      .from('question_options')
      .delete()
      .eq('question_id', questionData.id);
    
    const optionsToInsert = questionData.options.map(opt => ({
      question_id: questionData.id,
      option_text: opt.text,
      is_correct: opt.id === questionData.correctAnswer,
    }));
    
    const { error: insertError } = await supabase
      .from('question_options')
      .insert(optionsToInsert);
    
    if (insertError) {
      console.error('Lá»—i khi thÃªm options má»›i:', insertError);
      throw new Error('KhÃ´ng thá»ƒ cáº­p nháº­t cÃ¡c phÆ°Æ¡ng Ã¡n tráº£ lá»i.');
    }
  }
};

/**
 * XÃ³a má»™t cÃ¢u há»i khá»i database.
 * @param questionId ID cá»§a cÃ¢u há»i.
 * @returns Promise<void>
 */
export const deleteQuestion = async (questionId: string): Promise<void> => {
  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    console.error('Lá»—i khi xÃ³a cÃ¢u há»i:', error);
    throw new Error('KhÃ´ng thá»ƒ xÃ³a cÃ¢u há»i.');
  }
};

/**
 * Táº¡o má»™t vai trÃ² má»›i báº±ng cÃ¡ch chÃ¨n má»™t cÃ¢u há»i máº·c Ä‘á»‹nh.
 * @param roleName TÃªn vai trÃ² má»›i.
 * @returns Promise<void>
 */
export const createRole = async (roleName: string): Promise<void> => {
  const { error: assessmentError } = await supabase
    .from('assessments')
    .insert([
      { target_role: roleName, title: `ÄÃ¡nh giÃ¡ cho ${roleName}`, description: `BÃ i Ä‘Ã¡nh giÃ¡ dÃ nh riÃªng cho vá»‹ trÃ­ ${roleName}`, duration: 1800, is_active: true }
    ]);
  
  if (assessmentError) {
    console.error('Lá»—i khi táº¡o bÃ i Ä‘Ã¡nh giÃ¡ cho vai trÃ² má»›i:', assessmentError);
    throw new Error('KhÃ´ng thá»ƒ táº¡o vai trÃ².');
  }
};

/**
 * XÃ³a má»™t vai trÃ² vÃ  táº¥t cáº£ cÃ¡c cÃ¢u há»i liÃªn quan.
 * @param roleName TÃªn vai trÃ² cáº§n xÃ³a.
 * @returns Promise<void>
 */
export const deleteRole = async (roleName: string): Promise<void> => {
  const { error: assessmentError } = await supabase
    .from('assessments')
    .delete()
    .eq('target_role', roleName);
  
  if (assessmentError) {
    console.error('Lá»—i khi xÃ³a vai trÃ²:', assessmentError);
    throw new Error('KhÃ´ng thá»ƒ xÃ³a vai trÃ².');
  }
};

// ===================================================
// === CÃC HÃ€M API CHO CHá»¨C NÄ‚NG PHÃ‚N TÃCH/BÃO CÃO ===
// ===================================================

/**
 * Láº¥y dá»¯ liá»‡u cáº§n thiáº¿t cho trang phÃ¢n tÃ­ch vÃ  bÃ¡o cÃ¡o.
 * @returns Promise<any>
 */
export const getAnalyticsData = async () => {
  const { data, error } = await supabase
    .from('results')
    .select(`
      total_score,
      assessment:assessments(target_role),
      user:profiles(id, name, band)
    `);

  if (error) {
    console.error('Failed to fetch analytics data:', error);
    throw new Error('Unable to fetch analytics data.');
  }

  const rows = (data as SupabaseAnalyticsRow[]) ?? [];

  const formattedData = rows
    .map((item) => {
      const user = item.user?.[0] ?? null;
      if (!user?.id) {
        return null;
      }

      const assessment = item.assessment?.[0] ?? null;

      return {
        id: user.id,
        name: user.name ?? 'Unknown',
        role: assessment?.target_role ?? 'Unknown',
        band: user.band,
        scores: {
          overall: item.total_score,
        },
        status: 'completed' as const,
      };
    })
    .filter((item): item is Exclude<typeof item, null> => item !== null);

  return formattedData;
};

// =================================================
// === CÃC HÃ€M API CHO CHá»¨C NÄ‚NG á»¨NG VIÃŠN/Há»’ SÆ  ===
// =================================================

/**
 * Cáº­p nháº­t thÃ´ng tin há»“ sÆ¡ á»©ng viÃªn.
 * @param candidateId ID cá»§a á»©ng viÃªn.
 * @param updates Dá»¯ liá»‡u cáº§n cáº­p nháº­t.
 * @returns Promise<void>
 */
export const updateCandidateInfo = async (candidateId: string, updates: ProfileUpdates): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', candidateId);

  if (error) {
    console.error('Lá»—i khi cáº­p nháº­t thÃ´ng tin á»©ng viÃªn:', error);
    throw new Error('KhÃ´ng thá»ƒ cáº­p nháº­t thÃ´ng tin á»©ng viÃªn.');
  }
};

export const getCandidateDetails = async (candidateId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      scores:results(total_score)
    `)
    .eq('id', candidateId)
    .single();

  if (error) {
    console.error('Lá»—i khi táº£i dá»¯ liá»‡u chi tiáº¿t á»©ng viÃªn:', error);
    throw new Error('KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u chi tiáº¿t á»©ng viÃªn.');
  }

  return data;
};

export const getCandidates = async (): Promise<CandidateInfo[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      name,
      email,
      role,
      band,
      results(total_score)
    `);

  if (error) {
    console.error('Lá»—i khi táº£i dá»¯ liá»‡u á»©ng viÃªn:', error);
    throw new Error('KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u á»©ng viÃªn.');
  }
  const rows = (data as SupabaseCandidateProfile[]) ?? [];

  const formattedData: CandidateInfo[] = rows.map((item) => {
    const hasResults = Array.isArray(item.results) && item.results.length > 0;
    const overallScore = hasResults ? item.results[0]?.total_score ?? null : null;
    const status: CandidateInfo['status'] = hasResults && overallScore !== null ? 'completed' : 'in_progress';

    return {
      id: item.id,
      fullName: item.name ?? null,
      email: item.email ?? null,
      role: item.role ?? null,
      band: item.band ?? null,
      avatarChar: item.name?.charAt(0).toUpperCase() ?? '?',
      scores: {
        overall: overallScore,
      },
      status,
      startTime: new Date(),
      phone: 'N/A',
      telegram: 'N/A',
    };
  });

  return formattedData;
};

export const getAssessment = async (role: string) => {
  const { data, error } = await supabase
    .from('assessments')
    .select(`
      id,
      title,
      description,
      duration,
      questions:questions(id, text, format, required, options:question_options(id, option_text, is_correct))
    `)
    .eq('target_role', role)
    .single();

  if (error) {
    console.error(`Lá»—i khi táº£i bÃ i Ä‘Ã¡nh giÃ¡ cho vai trÃ² ${role}:`, error);
    throw new Error('KhÃ´ng thá»ƒ táº£i bÃ i Ä‘Ã¡nh giÃ¡.');
  }

  if (!data) {
    return null;
  }

  const normalisedQuestions = data.questions?.map((question) => ({
    ...question,
    type: 'General',
    format: question.format === 'multiple-choice' ? 'multiple_choice' : question.format,
    required: question.required ?? true,
    points: 0,
  })) ?? [];

  return {
    ...data,
    questions: normalisedQuestions,
  };
};

export const getQuestionsByIds = async (questionIds: string[]) => {
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      text,
      format,
      required,
      options:question_options(id, option_text, is_correct)
    `)
    .in('id', questionIds);

  if (error) {
    console.error(`Lá»—i khi táº£i cÃ¢u há»i theo IDs:`, error);
    throw new Error('KhÃ´ng thá»ƒ táº£i cÃ¢u há»i.');
  }

  // Map the data to the correct Question interface
  const formattedData = (data as SupabaseQuestionData[]).map(q => {
    const format = q.format === 'multiple-choice' ? 'multiple_choice' : q.format;
    // Format options and correctAnswer
    const formattedOptions = q.options?.map(opt => ({
      id: opt.id,
      text: opt.option_text,
    }));
    const correctAnswerId = q.options?.find(opt => opt.is_correct)?.id;

    return {
      id: q.id,
      text: q.text,
      type: q.type ?? 'General',
      format,
      // You may need to provide a default value for 'required' and 'points'
      // if they are missing from the select query
      required: q.required ?? true,
      points: 0,
      options: formattedOptions,
      correctAnswer: correctAnswerId,
    };
  });

  return formattedData;
};


interface AnswerRow {
  id: string;
  result_id: string | null;
  question_id: string;
  user_answer_text: string | null;
  selected_option_id: string | null;
  created_at: string;
}

interface AnswerInput {
  id?: string;
  attemptId?: string | null;
  resultId?: string | null;
  questionId: string;
  userAnswerText?: string | null;
  selectedOptionId?: string | null;
}

/**
 * Luu ho?c c?p nh?t câu tr? l?i c?a ?ng viên.
 */
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
      throw new Error('Không th? luu câu tr? l?i.');
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
    throw new Error('Không th? luu câu tr? l?i.');
  }

  return data as AnswerRow;
};


interface ProfileRow {
  id: string;
  email: string | null;
  name: string | null;
}

interface AssessmentAttemptRow {
  id: string;
  profile_id: string;
  assessment_id: string;
  role: string;
  status: string;
  answered_count: number | null;
  total_questions: number | null;
  progress_percent: number | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
}

const mapAssessmentAttempt = (row: AssessmentAttemptRow): AssessmentAttempt => ({
  id: row.id,
  status: row.status,
  answeredCount: row.answered_count ?? 0,
  totalQuestions: row.total_questions ?? 0,
  progressPercent: Number(row.progress_percent ?? 0),
  startedAt: row.started_at,
  submittedAt: row.submitted_at,
  completedAt: row.completed_at,
  lastActivityAt: row.last_activity_at,
});

export const ensureProfile = async (payload: ProfileRow) => {
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
    console.error('Failed to ensure profile exists:', error);
    throw new Error('Không thể khởi tạo hồ sơ người dùng.');
  }
};

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
    throw new Error('Không thể tải tiến độ bài đánh giá.');
  }

  return data as AssessmentAttemptRow | null;
};

export const startAssessmentAttempt = async (payload: {
  profileId: string;
  assessmentId: string;
  role: string;
  totalQuestions: number;
}) => {
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
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create assessment attempt:', error);
    throw new Error('Không thể khởi tạo bài đánh giá.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};

export const submitAssessmentAttempt = async (attemptId: string) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('assessment_attempts')
    .update({
      status: 'awaiting_ai',
      submitted_at: nowIso,
      last_activity_at: nowIso,
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (error) {
    console.error('Failed to submit assessment attempt:', error);
    throw new Error('Không thể ghi nhận bài làm.');
  }

  return mapAssessmentAttempt(data as AssessmentAttemptRow);
};
