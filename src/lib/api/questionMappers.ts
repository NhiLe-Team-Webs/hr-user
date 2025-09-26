import type { Question, QuestionOption } from '../types/question';

export interface SupabaseQuestionOptionData {
  id: string;
  option_text: string;
  is_correct: boolean;
  question_id?: string | null;
}

export interface SupabaseQuestionData {
  id: string;
  text: string;
  type?: string;
  format?: string | null;
  required?: boolean;
  assessment_id?: string | null;
  created_at?: string;
  options?: SupabaseQuestionOptionData[];
}

export const MULTIPLE_CHOICE_FORMATS = new Set(['multiple_choice', 'multiple-choice', 'single']);

export const normaliseQuestionFormat = (format?: string | null): Question['format'] => {
  if (!format) {
    return 'text';
  }

  if (format === 'multiple-choice') {
    return 'multiple_choice';
  }

  if (format === 'single') {
    return 'multiple_choice';
  }

  return format as Question['format'];
};

export const mapSupabaseQuestion = (question: SupabaseQuestionData): Question => {
  const format = normaliseQuestionFormat(question.format);
  const options: QuestionOption[] | undefined = question.options?.map((option) => ({
    id: option.id,
    text: option.option_text,
    optionText: option.option_text,
    isCorrect: option.is_correct,
  }));

  const correctAnswer = question.options?.find((option) => option.is_correct)?.id;

  return {
    id: question.id,
    text: question.text,
    type: question.type ?? 'General',
    format,
    required: question.required ?? true,
    assessmentId: question.assessment_id,
    createdAt: question.created_at,
    options,
    correctAnswer,
  };
};
