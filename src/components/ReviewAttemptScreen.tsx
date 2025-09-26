// src/components/ReviewAttemptScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import type {
  AssessmentAttempt,
  AssessmentResult,
  AttemptAnswerReview,
} from '@/types/assessment';

interface ReviewAttemptScreenProps {
  attempt: AssessmentAttempt;
  result: AssessmentResult | null;
  answers: AttemptAnswerReview[];
  onBack: () => void;
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Đang cập nhật';
  }

  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (error) {
    console.warn('Failed to format review timestamp:', error);
    return value;
  }
};

const formatStatusLabel = (status?: string | null) => {
  if (!status) {
    return 'không xác định';
  }

  switch (status) {
    case 'in_progress':
      return 'Đang làm';
    case 'awaiting_ai':
      return 'Đang chấm điểm';
    case 'completed':
      return 'Đã hoàn thành';
    case 'not_started':
      return 'Chưa bắt đầu';
    default:
      return status.replace(/_/g, ' ');
  }
};

const ReviewAttemptScreen: React.FC<ReviewAttemptScreenProps> = ({ attempt, result, answers, onBack }) => {
  const answeredCount =
    typeof attempt.answeredCount === 'number' ? attempt.answeredCount : '—';
  const totalQuestions =
    typeof attempt.totalQuestions === 'number' ? attempt.totalQuestions : '—';
  const cheatingCount =
    typeof attempt.cheatingCount === 'number' ? attempt.cheatingCount : 0;

  return (
    <motion.div
      key={attempt.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="apple-card p-6 md:p-10 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Chi tiết bài làm</h2>
            <p className="text-sm text-muted-foreground mt-1">Vai trò: {attempt.role ?? 'Chưa xác định'}</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            Quay lại kết quả
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Trạng thái</p>
            <p className="text-lg font-semibold text-gray-800 mt-2">{formatStatusLabel(attempt.status)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bắt đầu</p>
            <p className="text-lg font-semibold text-gray-800 mt-2">
              {formatDateTime(attempt.startedAt ?? attempt.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Hoàn thành</p>
            <p className="text-lg font-semibold text-gray-800 mt-2">
              {formatDateTime(attempt.completedAt ?? attempt.submittedAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Số câu đã trả lời</p>
            <p className="text-lg font-semibold text-gray-800 mt-2">
              {answeredCount}/{totalQuestions}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cheating</p>
            <p className="text-lg font-semibold text-gray-800 mt-2">
              {cheatingCount > 0 ? `${cheatingCount} lần chuyển tab` : 'Không ghi nhận'}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Điểm tổng quan</p>
            <p className="text-lg font-semibold text-primary mt-2">
              {result ? result.score : 'Đang cập nhật'}
            </p>
          </div>
        </div>

        {result ? (
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 space-y-3">
            <h3 className="text-lg font-semibold text-primary">Tóm tắt từ AI</h3>
            <p className="text-sm text-primary/80 leading-relaxed">
              {result.summary ?? 'Hệ thống chưa ghi nhận tóm tắt cho lần làm bài này.'}
            </p>
          </div>
        ) : null}
      </div>

      <div className="apple-card p-6 md:p-10 space-y-5">
        <h3 className="text-xl font-semibold">Câu trả lời đã nộp</h3>
        <div className="space-y-4">
          {answers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không tìm thấy câu trả lời cho lần làm bài này.</p>
          ) : (
            answers.map((answer, index) => (
              <div key={answer.id} className="rounded-2xl border border-border/60 bg-white/90 p-5 space-y-3">
                <p className="text-sm font-semibold text-gray-800">
                  Câu {index + 1}: {answer.questionText}
                </p>
                {answer.format === 'multiple_choice' ? (
                  <p className="text-sm text-muted-foreground">
                    Câu trả lời đã chọn: {answer.selectedOptionText ?? 'Chưa chọn'}
                  </p>
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Câu trả lời</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {answer.userAnswerText && answer.userAnswerText.trim().length > 0
                        ? answer.userAnswerText
                        : 'Chưa có câu trả lời'}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ReviewAttemptScreen;
