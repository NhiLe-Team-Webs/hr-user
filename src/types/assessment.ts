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
  optionText?: string;
  isCorrect?: boolean;
}

export type AnswerValue = string | number;

export type UserAnswers = Record<number, AnswerValue>;

export type HrApprovalStatus = 'pending' | 'approved' | 'rejected' | null;

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
  id: string;
  name: string;
  title: string;
}

export interface AssessmentSkillScore {
  name: string;
  score: number;
}

export interface AssessmentResult {
  summary: string | null;
  strengths: string[];
  developmentAreas: string[];
  skillScores: AssessmentSkillScore[];
  recommendedRoles: string[];
  developmentSuggestions: string[];
  completedAt: string | null;
  hrApprovalStatus: HrApprovalStatus;
  teamFit: string[] | { id: string; name: string }[] | null;
  aiAnalysisAvailable?: boolean; // Indicates if AI analysis was successful
}



export interface CheatingEvent {
  type?: string;
  questionId: string | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  role?: string;
  status: string;
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  startedAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  lastActivityAt?: string | null;
  aiStatus?: 'idle' | 'processing' | 'completed' | 'failed' | null;
  lastAiError?: string | null;
  durationSeconds?: number | null;
  averageSecondsPerQuestion?: number | null;
  questionTimings?: Record<string, number> | null;
  cheatingCount?: number;
  cheatingEvents?: CheatingEvent[] | null;
}

