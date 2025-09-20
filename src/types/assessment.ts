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

export type AnswerValue = string | number;

export type UserAnswers = Record<number, AnswerValue>;

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



export interface AssessmentAttempt {
  id: string;
  status: string;
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  startedAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  lastActivityAt?: string | null;
}
