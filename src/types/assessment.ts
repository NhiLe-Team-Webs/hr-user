// src/types/assessment.ts

import type { Question as BaseQuestion, QuestionFormat, QuestionOption, QuestionType } from './question';

export interface Question extends Omit<BaseQuestion, 'options'> {
  format: QuestionFormat;
  options?: QuestionOption[];
  correctAnswer?: string;
  points?: number;
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
  description: string | null;
  duration: number;
  questions: Question[];
}

export interface Role {
  name: string;
  title: string;
}

export interface SkillScores {
  [skill: string]: number;
}

export interface AssessmentResult {
  overallScore: number | null;
  adjustedScore: number | null;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  completedCount: number;
  cheatingCount: number;
  skillScores?: SkillScores;
  rawSummary?: Record<string, unknown> | null;
}

export interface AssessmentAttempt {
  id: string;
  profileId: string;
  assessmentId: string;
  role: string;
  status: string;
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  startedAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  lastActivityAt?: string | null;
  cheatingCount?: number | null;
}
