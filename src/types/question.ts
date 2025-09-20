// src/types/question.ts

export const QUESTION_TYPES = [
  'multiple-choice',
  'text',
  'technical',
  'mcq',
] as const;

export type QuestionType =
  | (typeof QUESTION_TYPES)[number]
  | (string & {});

export const QUESTION_FORMATS = [
  'text',
  'multiple-choice',
  'multiple_choice',
  'single',
] as const;

export type QuestionFormat =
  | (typeof QUESTION_FORMATS)[number]
  | (string & {});

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  optionText?: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  format: QuestionFormat;
  required: boolean;
  assessmentId?: string | null;
  createdAt?: string;
  options?: QuestionOption[];
  correctAnswer?: string;
}

export interface QuestionsByRole {
  [role: string]: Question[];
}

export interface QuestionTypeInfo {
  value: string;
  label: string;
  color: string;
}

export interface SupabaseRoleData {
  target_role: string;
}
