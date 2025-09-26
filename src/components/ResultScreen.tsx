// src/components/ResultScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';
import type { AssessmentHistoryEntry, AssessmentResult } from '@/types/assessment';

interface ResultScreenProps {
  result: AssessmentResult;
  history: AssessmentHistoryEntry[];
  onReviewAttempt: (attemptId: string) => void;
  onRetakeAttempt: (entry: AssessmentHistoryEntry) => void;
  onTryoutClick: () => void;
  onReset: () => void;
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
    console.warn('Failed to format date time:', error);
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

const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  history,
  onReviewAttempt,
  onRetakeAttempt,
  onTryoutClick,
  onReset,
}) => {
  const { t } = useLanguage();
  const { score, strengths, weaknesses = [], summary, hrMessage, metrics } = result;
  const resolvedScore = typeof score === 'number' && Number.isFinite(score) ? score : '—';

  const latestAttempt = history.find((entry) => entry.status === 'completed') ?? history[0] ?? null;
  const answeredQuestions =
    typeof metrics?.answeredQuestions === 'number'
      ? metrics.answeredQuestions
      : typeof latestAttempt?.answeredCount === 'number'
      ? latestAttempt.answeredCount
      : null;
  const totalQuestions =
    typeof metrics?.totalQuestions === 'number'
      ? metrics.totalQuestions
      : typeof latestAttempt?.totalQuestions === 'number'
      ? latestAttempt.totalQuestions
      : null;
  const cheatingCount =
    typeof metrics?.cheatingCount === 'number'
      ? metrics.cheatingCount
      : typeof latestAttempt?.cheatingCount === 'number'
      ? latestAttempt.cheatingCount
      : null;

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      <div className="apple-card p-6 md:p-12 space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('resultScreen.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
            {summary ?? t('resultScreen.subtitle')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 text-left">
          <div className="bg-white/90 backdrop-blur border border-border/60 rounded-3xl p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Điểm tổng quan</p>
            <p className="text-5xl font-bold text-primary mt-3">{resolvedScore}</p>
            {typeof answeredQuestions === 'number' && typeof totalQuestions === 'number' ? (
              <p className="text-sm text-muted-foreground mt-2">
                Đã trả lời {answeredQuestions}/{totalQuestions} câu hỏi
              </p>
            ) : null}
            {typeof cheatingCount === 'number' && cheatingCount > 0 ? (
              <p className="text-sm text-amber-600 mt-2">Ghi nhận {cheatingCount} lần chuyển tab</p>
            ) : null}
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 md:col-span-2">
            <h3 className="text-xl font-semibold text-primary mb-3">Thông báo từ HR</h3>
            <p className="text-primary/80 leading-relaxed">
              {hrMessage ??
                'Kết quả của bạn đã được gửi về cho HR xem xét, bạn sẽ nhận được thông báo qua email hoặc trực tiếp trên giao diện.'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 text-left">
          <div className="bg-white/90 backdrop-blur border border-emerald-100 rounded-3xl p-6 shadow-sm">
            <h3 className="font-semibold text-emerald-600 mb-4 text-lg">{t('resultScreen.strengthsTitle')}</h3>
            <div className="space-y-3">
              {strengths.map((strength, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="text-sm text-gray-700">{strength}</p>
                </div>
              ))}
              {strengths.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có dữ liệu điểm mạnh.</p>
              ) : null}
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur border border-rose-100 rounded-3xl p-6 shadow-sm">
            <h3 className="font-semibold text-rose-600 mb-4 text-lg">Điểm cần cải thiện</h3>
            <div className="space-y-3">
              {weaknesses.length > 0 ? (
                weaknesses.map((weakness, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" />
                    <p className="text-sm text-gray-700">{weakness}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Không có điểm yếu đáng kể trong lần đánh giá này.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button variant="secondary" onClick={onReset} className="px-6 py-3 text-base font-semibold">
            Chọn lại vai trò
          </Button>
          <Button onClick={onTryoutClick} className="apple-button px-6 py-3 text-base font-semibold">
            {t('resultScreen.tryoutCta')}
          </Button>
        </div>
      </div>

      <div className="apple-card p-6 md:p-10 space-y-6 text-left">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-xl font-semibold">Lịch sử làm bài</h3>
          <Button variant="outline" onClick={onReset} className="px-4">
            Làm bài mới
          </Button>
        </div>
        <div className="space-y-4">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu lịch sử.</p>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-white/90 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-800">{entry.role || 'Chưa xác định'}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(entry.completedAt ?? entry.submittedAt ?? entry.startedAt)}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Trạng thái: {formatStatusLabel(entry.status)}
                  </p>
                  {typeof entry.overallScore === 'number' ? (
                    <p className="text-sm text-primary font-semibold mt-1">Điểm: {Math.round(entry.overallScore)}</p>
                  ) : null}
                  {typeof entry.answeredCount === 'number' && typeof entry.totalQuestions === 'number' ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.answeredCount}/{entry.totalQuestions} câu đã trả lời
                    </p>
                  ) : null}
                  {typeof entry.cheatingCount === 'number' && entry.cheatingCount > 0 ? (
                    <p className="text-xs text-amber-600 mt-1">
                      Ghi nhận {entry.cheatingCount} lần chuyển tab
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => onReviewAttempt(entry.id)}
                    disabled={entry.status !== 'completed'}
                  >
                    Xem lại
                  </Button>
                  <Button onClick={() => onRetakeAttempt(entry)}>Làm lại</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ResultScreen;
