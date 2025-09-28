import type { AssessmentAttempt } from '@/types/assessment';
import type { AssessmentAttemptRow } from './types';

const parseNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

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
  durationSeconds: parseNullableNumber(row.duration_seconds ?? null),
  averageSecondsPerQuestion: parseNullableNumber(row.average_seconds_per_question ?? null),
  cheatingCount:
    typeof row.cheating_count === 'number'
      ? row.cheating_count
      : typeof row.cheating_count === 'string'
        ? Number.parseInt(row.cheating_count, 10) || 0
        : 0,
});
