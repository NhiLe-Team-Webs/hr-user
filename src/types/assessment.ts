// src/types/assessment.ts

import type { Question } from './question';

export type AnswerValue = string | number;

export type UserAnswers = Record<number, AnswerValue>;

export interface Assessment {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  questions: Question[];
}

export interface Role {
  name: string;
  title: string;
}

export interface AssessmentResult {
  attemptId: string;
  overallScore: number | null;
  adjustedScore: number;
  strengths: string[];
  weaknesses: string[];
  summary: string | null;
  aiSummary: string | null;
  skillScores?: Record<string, number>;
  completedCount: number;
  cheatingCount: number;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  profileId: string;
  role: string;
  status: string;
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  startedAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  lastActivityAt?: string | null;
  cheatingCount: number;
}
