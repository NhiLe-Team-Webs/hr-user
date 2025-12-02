import { apiClient } from '@/lib/httpClient';
import type { Question } from '@/types/question';
import { mapSupabaseQuestion } from './questionMappers';

interface BackendQuestionsResponse {
  success: boolean;
  data: {
    questions: Array<{
      id: string;
      text: string;
      format: string;
      role: string;
      options?: Array<{
        id: string;
        text: string; // Backend maps option_text to text
        is_correct: boolean;
      }>;
      correct_answer?: string;
      points: number;
      order_index: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>;
  };
}

export const getQuestionsByRole = async (role: string): Promise<Question[]> => {
  try {
    const response = await apiClient.get<BackendQuestionsResponse>('/hr/questions', {
      query: { role, include_options: true },
    });

    if (response.success && response.data?.questions) {
      // Map backend questions to frontend Question format
      return response.data.questions.map((q) => mapSupabaseQuestion({
        id: q.id,
        text: q.text,
        type: 'General', // Default type
        format: q.format as any,
        required: true,
        assessment_id: '', // Not needed for frontend
        created_at: q.created_at,
        options: q.options || [],
      }));
    }

    return [];
  } catch (error) {
    console.error(`Failed to load questions for role ${role} via backend:`, error);
    throw new Error('Khong the tai cau hoi.');
  }
};

export const getQuestionsByIds = async (questionIds: string[]): Promise<Question[]> => {
  if (questionIds.length === 0) {
    return [];
  }

  try {
    const response = await apiClient.get<BackendQuestionsResponse>('/hr/questions/by-ids', {
      query: { ids: questionIds.join(',') },
    });

    if (response.success && response.data?.questions) {
      return response.data.questions.map((q) => mapSupabaseQuestion({
        id: q.id,
        text: q.text,
        type: 'General',
        format: q.format as any,
        required: true,
        assessment_id: '',
        created_at: q.created_at,
        options: q.options || [],
      }));
    }

    return [];
  } catch (error) {
    console.error('Failed to load questions by ids via backend:', error);
    throw new Error('Khong the tai danh sach cau hoi.');
  }
};
