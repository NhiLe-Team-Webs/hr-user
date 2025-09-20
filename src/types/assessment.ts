// src/types/assessment.ts

export interface Question {
  id: string;
  text: string;
  type: string;
  format: 'text' | 'multiple_choice';
  required: boolean;
  points: number;
  options?: Option[];
  correctAnswer?: string;
}

export interface Option {
  id: string;
  text: string;
}

export interface UserAnswers {
  [questionIndex: number]: number;
}

export interface Assessment {
  id: string;
  title: string;
  description: string;
  duration: number;
  questions: {
    question_id: string;
    order: number;
  }[];
}

export interface Role {
  name: string;
  title: string;
}

export interface AssessmentResult {
  score: number;
  strengths: string[];
}
