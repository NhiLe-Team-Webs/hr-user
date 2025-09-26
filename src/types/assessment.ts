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

export type AssessmentLifecycleStatus = 'idle' | 'in_progress' | 'awaiting_ai' | 'completed';

export interface AssessmentMetrics {
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  durationSeconds?: number;
  tabViolations?: number;
}

export interface AssessmentResult {
  id: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  summary?: string | null;
  recommendedRoles?: string[];
  completedAt?: string | null;
  hrMessage?: string;
  aiSummary?: string | null;
  metrics?: AssessmentMetrics;
  analysisModel?: string | null;
  analysisVersion?: string | null;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId?: string | null;
  role?: string | null;
  status: string;
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  startedAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  lastActivityAt?: string | null;
  createdAt?: string | null;
  durationSeconds?: number | null;
}

export interface AssessmentHistoryEntry {
  id: string;
  role: string;
  status: string;
  assessmentId?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  overallScore?: number | null;
  createdAt?: string | null;
}
