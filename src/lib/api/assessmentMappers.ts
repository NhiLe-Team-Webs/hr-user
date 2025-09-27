import type { AssessmentAttempt } from '@/types/assessment';
import type { AssessmentAttemptRow } from './types';

export const mapAssessmentAttempt = (row: AssessmentAttemptRow): AssessmentAttempt => ({
  id: row.id,
  status: row.status,
  answeredCount: row.answered_count ?? 0,
  totalQuestions: row.total_questions ?? 0,
  progressPercent: Number(row.progress_percent ?? 0),
  startedAt: row.started_at,
  submittedAt: row.submitted_at,
  completedAt: row.completed_at,
  lastActivityAt: row.last_activity_at,
});
