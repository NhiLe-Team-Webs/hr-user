import type { Question } from '@/types/assessment';
import type { QuestionOption } from '../../types/question';

export interface SupabaseQuestionOptionData {
  id: string;
  option_text: string;
  is_correct: boolean;
  question_id?: string;
}

export interface SupabaseQuestionData {
  id: string;
  text: string;
  type?: string;
  format: string;
  required?: boolean;
  assessment_id?: string | null;
  created_at?: string;
  options?: SupabaseQuestionOptionData[];
}

export const MULTIPLE_CHOICE_FORMATS = new Set(['multiple_choice', 'multiple-choice', 'mcq']);
const ESSAY_FORMATS = new Set(['essay', 'long_form', 'long-form']);

export const normaliseQuestionFormat = (format?: string | null): Question['format'] => {
  if (!format) {
    return 'text';
  }

  const cleaned = format.trim().toLowerCase().replace(/-/g, '_');

  if (MULTIPLE_CHOICE_FORMATS.has(cleaned)) {
    return 'multiple_choice';
  }

  if (ESSAY_FORMATS.has(cleaned)) {
    return 'essay';
  }

  if (cleaned === 'text_area' || cleaned === 'paragraph') {
    return 'text';
  }

  return cleaned as Question['format'];
};

const deriveQuestionType = (providedType: string | undefined, format: Question['format']): Question['type'] => {
  if (providedType && providedType.trim().length > 0) {
    return providedType as Question['type'];
  }

  if (format === 'multiple_choice') {
    return 'multiple_choice';
  }

  if (format === 'essay') {
    return 'text';
  }

  return format as Question['type'];
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
    type: deriveQuestionType(question.type, format),
    format,
    required: question.required ?? true,
    assessmentId: question.assessment_id,
    createdAt: question.created_at,
    options,
    correctAnswer,
  };
};
