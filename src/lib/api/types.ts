import type { Question } from '../types/question';
import type { AssessmentAttempt } from '@/types/assessment';

export interface ProfileUpdates {
  name?: string;
  email?: string;
  role?: string;
  band?: string;
}

export interface CandidateInfo {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string | null;
  band: string | null;
  avatarChar: string;
  scores: {
    overall: number | null;
  };
  status: 'completed' | 'in_progress';
  startTime: Date;
  phone: string;
  telegram: string;
}

export interface AnswerRow {
  id: string;
  attempt_id: string | null;
  result_id: string | null;
  question_id: string;
  user_answer_text: string | null;
  selected_option_id: string | null;
  created_at: string;
}

export interface AnswerInput {
  id?: string;
  attemptId?: string | null;
  resultId?: string | null;
  questionId: string;
  userAnswerText?: string | null;
  selectedOptionId?: string | null;
}

export interface AssessmentAttemptRow {
  id: string;
  profile_id: string;
  assessment_id: string;
  role: string;
  status: string;
  answered_count: number | null;
  total_questions: number | null;
  progress_percent: number | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  cheating_count: number | null;
}

export interface ResultRow {
  id: string;
  user_id: string | null;
  assessment_id: string | null;
  completed_at: string | null;
  overall_score: number | null;
  strengths: unknown;
  weaknesses: unknown;
  summary: string | null;
  ai_summary: unknown;
  skill_scores: Record<string, number> | null;
  analysis_completed_at: string | null;
  cheating_summary: unknown;
}

export type QuestionsByRole = Record<string, Question[]>;

export type { AssessmentAttempt };
