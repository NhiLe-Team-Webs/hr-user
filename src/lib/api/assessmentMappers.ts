import type { AssessmentAttempt } from '@/types/assessment';
import type { AssessmentAttemptRow } from './types';

export const mapAssessmentAttempt = (row: AssessmentAttemptRow): AssessmentAttempt => ({
  id: row.id,
  assessmentId: row.assessment_id,
  status: row.status,
  answeredCount: row.answered_count ?? 0,
  totalQuestions: row.total_questions ?? 0,
  progressPercent: Number(row.progress_percent ?? 0),
  startedAt: row.started_at,
  submittedAt: row.submitted_at,
  completedAt: row.completed_at,
  lastActivityAt: row.last_activity_at,
  aiStatus: (row.ai_status as AssessmentAttempt['aiStatus']) ?? null,
  lastAiError: row.last_ai_error ?? null,
  durationSeconds: row.duration_seconds ?? null,
  averageSecondsPerQuestion: row.average_seconds_per_question ?? null,
  cheatingCount: row.cheating_count ?? 0,
});
