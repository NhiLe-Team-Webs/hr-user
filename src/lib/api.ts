// src/lib/api.ts

import { supabase } from './supabaseClient';
import { Question, QuestionsByRole } from '../types/question';
import { LandingPage } from '@/types/landingPage';

// ===========================================
// === INTERFACES ĐỂ ĐẢM BẢO AN TOÀN KIỂU ===
// ===========================================

// Interfaces cho hàm getQuestionsByRole
interface SupabaseQuestionData {
  id: string;
  text: string;
  type: string;
  format: 'text' | 'multiple_choice';
  required: boolean;
  options: {
    id: string;
    option_text: string;
    is_correct: boolean;
  }[];
}


// Interfaces cho hàm updateCandidateInfo
interface ProfileUpdates {
  name?: string;
  email?: string;
  role?: string;
  band?: string;
}

// Interfaces cho hàm getRoles
interface SupabaseRoleData {
  target_role: string;
}

// Interfaces cho hàm getAnalyticsData
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

// Interfaces cho hàm getCandidates
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


// Interfaces cho hàm getCandidateDetails
interface SupabaseCandidateDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  band: string | null;
  scores: { total_score: number | null }[];
}


// ===============================================
// === CÁC HÀM API CHO CHỨC NĂNG LANDING PAGE ===
// ===============================================

/**
 * Lấy dữ liệu trang landing page từ database.
 */
export const getLandingPageData = async (): Promise<LandingPage> => {
  const { data, error } = await supabase
    .from('landing_page')
    .select('*')
    .single();

  if (error) {
    console.error('Lỗi khi tải dữ liệu landing page:', error);
    throw new Error('Không thể tải dữ liệu landing page.');
  }
  return data as LandingPage;
};

/**
 * Cập nhật dữ liệu trang landing page vào database.
 * @param data Dữ liệu cần cập nhật.
 */
export const updateLandingPageData = async (data: Partial<LandingPage>) => {
  const { error } = await supabase
    .from('landing_page')
    .update(data)
    .eq('id', 1);

  if (error) {
    console.error('Lỗi khi lưu dữ liệu landing page:', error);
    throw new Error('Không thể lưu dữ liệu landing page.');
  }
};

// ==================================================
// === CÁC HÀM API CHO CHỨC NĂNG QUẢN LÝ CÂU HỎI ===
// ==================================================

/**
 * Lấy danh sách các vai trò (vị trí công việc) duy nhất từ database.
 */
export const getRoles = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('assessments')
    .select('target_role');

  if (error) {
    console.error('Lỗi khi tải danh sách vai trò:', error);
    return [];
  }

  const roles = data as SupabaseRoleData[];
  const uniqueRoles = [...new Set(roles.map(item => item.target_role))];
  return uniqueRoles;
};

/**
 * Lấy tất cả câu hỏi cho một vai trò cụ thể.
 * @param role Tên vai trò.
 */
export const getQuestionsByRole = async (role: string): Promise<Question[]> => {
  const { data: assessmentData, error: assessmentError } = await supabase
    .from('assessments')
    .select('id')
    .eq('target_role', role)
    .single();

  if (assessmentError) {
    console.error(`Lỗi khi tải assessment cho vai trò ${role}:`, assessmentError);
    return [];
  }
  
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      text,
      type,
      format,
      required,
      options:question_options(id, option_text, is_correct)
    `)
    .eq('assessment_id', assessmentData.id);

  if (error) {
    console.error(`Lỗi khi tải câu hỏi cho vai trò ${role}:`, error);
    throw new Error('Không thể tải câu hỏi.');
  }

  const formattedData = (data as SupabaseQuestionData[]).map(q => {
    const formattedQuestion: Question = {
      id: q.id,
      text: q.text,
      type: q.type,
      format: q.format,
      required: q.required,
    };

    if (q.format === 'multiple_choice' && q.options) {
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
 * Tạo một câu hỏi mới và các phương án trả lời tương ứng.
 * @param questionData Dữ liệu câu hỏi.
 * @param targetRole Vai trò của câu hỏi.
 * @returns Promise<Question>
 */
export const createQuestion = async (questionData: Omit<Question, 'id'>, targetRole: string): Promise<Question> => {
  // Tìm assessment_id cho role
  const { data: assessment, error: assessmentError } = await supabase
    .from('assessments')
    .select('id')
    .eq('target_role', targetRole)
    .single();

  if (assessmentError) {
    console.error('Không tìm thấy bài đánh giá cho vai trò này.');
    throw new Error('Không thể tạo câu hỏi.');
  }

  const { data: newQuestion, error: questionError } = await supabase
    .from('questions')
    .insert([{
      text: questionData.text,
      type: questionData.type,
      format: questionData.format,
      required: questionData.required,
      assessment_id: assessment.id
    }])
    .select()
    .single();

  if (questionError) {
    console.error('Lỗi khi tạo câu hỏi:', questionError);
    throw new Error('Không thể tạo câu hỏi.');
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
      console.error('Lỗi khi tạo options:', optionsError);
      throw new Error('Không thể tạo các phương án trả lời.');
    }
  }

  return newQuestion;
};

/**
 * Cập nhật thông tin của một câu hỏi và các phương án trả lời.
 * @param questionData Dữ liệu câu hỏi cần cập nhật.
 * @returns Promise<void>
 */
export const updateQuestion = async (questionData: Partial<Question>): Promise<void> => {
  const { error: questionError } = await supabase
    .from('questions')
    .update({
      text: questionData.text,
      type: questionData.type,
      format: questionData.format,
      required: questionData.required,
    })
    .eq('id', questionData.id);

  if (questionError) {
    console.error('Lỗi khi cập nhật câu hỏi:', questionError);
    throw new Error('Không thể cập nhật câu hỏi.');
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
      console.error('Lỗi khi thêm options mới:', insertError);
      throw new Error('Không thể cập nhật các phương án trả lời.');
    }
  }
};

/**
 * Xóa một câu hỏi khỏi database.
 * @param questionId ID của câu hỏi.
 * @returns Promise<void>
 */
export const deleteQuestion = async (questionId: string): Promise<void> => {
  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    console.error('Lỗi khi xóa câu hỏi:', error);
    throw new Error('Không thể xóa câu hỏi.');
  }
};

/**
 * Tạo một vai trò mới bằng cách chèn một câu hỏi mặc định.
 * @param roleName Tên vai trò mới.
 * @returns Promise<void>
 */
export const createRole = async (roleName: string): Promise<void> => {
  const { error: assessmentError } = await supabase
    .from('assessments')
    .insert([
      { target_role: roleName, title: `Đánh giá cho ${roleName}`, description: `Bài đánh giá dành riêng cho vị trí ${roleName}`, duration: 1800, is_active: true }
    ]);
  
  if (assessmentError) {
    console.error('Lỗi khi tạo bài đánh giá cho vai trò mới:', assessmentError);
    throw new Error('Không thể tạo vai trò.');
  }
};

/**
 * Xóa một vai trò và tất cả các câu hỏi liên quan.
 * @param roleName Tên vai trò cần xóa.
 * @returns Promise<void>
 */
export const deleteRole = async (roleName: string): Promise<void> => {
  const { error: assessmentError } = await supabase
    .from('assessments')
    .delete()
    .eq('target_role', roleName);
  
  if (assessmentError) {
    console.error('Lỗi khi xóa vai trò:', assessmentError);
    throw new Error('Không thể xóa vai trò.');
  }
};

// ===================================================
// === CÁC HÀM API CHO CHỨC NĂNG PHÂN TÍCH/BÁO CÁO ===
// ===================================================

/**
 * Lấy dữ liệu cần thiết cho trang phân tích và báo cáo.
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
// === CÁC HÀM API CHO CHỨC NĂNG ỨNG VIÊN/HỒ SƠ ===
// =================================================

/**
 * Cập nhật thông tin hồ sơ ứng viên.
 * @param candidateId ID của ứng viên.
 * @param updates Dữ liệu cần cập nhật.
 * @returns Promise<void>
 */
export const updateCandidateInfo = async (candidateId: string, updates: ProfileUpdates): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', candidateId);

  if (error) {
    console.error('Lỗi khi cập nhật thông tin ứng viên:', error);
    throw new Error('Không thể cập nhật thông tin ứng viên.');
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
    console.error('Lỗi khi tải dữ liệu chi tiết ứng viên:', error);
    throw new Error('Không thể tải dữ liệu chi tiết ứng viên.');
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
    console.error('Lỗi khi tải dữ liệu ứng viên:', error);
    throw new Error('Không thể tải dữ liệu ứng viên.');
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
      questions:questions(id, text, type, format, required, options:question_options(id, option_text, is_correct))
    `)
    .eq('target_role', role)
    .single();

  if (error) {
    console.error(`Lỗi khi tải bài đánh giá cho vai trò ${role}:`, error);
    throw new Error('Không thể tải bài đánh giá.');
  }

  return data;
};

export const getQuestionsByIds = async (questionIds: string[]) => {
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      text,
      type,
      format,
      options:question_options(id, option_text, is_correct)
    `)
    .in('id', questionIds);

  if (error) {
    console.error(`Lỗi khi tải câu hỏi theo IDs:`, error);
    throw new Error('Không thể tải câu hỏi.');
  }

  // Map the data to the correct Question interface
  const formattedData = (data as SupabaseQuestionData[]).map(q => {
    // Format options and correctAnswer
    const formattedOptions = q.options?.map(opt => ({
      id: opt.id,
      text: opt.option_text,
    }));
    const correctAnswerId = q.options?.find(opt => opt.is_correct)?.id;

    return {
      id: q.id,
      text: q.text,
      type: q.type,
      format: q.format,
      // You may need to provide a default value for 'required' and 'points'
      // if they are missing from the select query
      required: true,
      points: 0,
      options: formattedOptions,
      correctAnswer: correctAnswerId,
    };
  });

  return formattedData;
};


