// src/types/question.ts

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  type: string;
  format: 'text' | 'multiple_choice';
  required: boolean;
  options?: { id: string; text: string }[];
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