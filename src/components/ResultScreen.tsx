// src/components/ResultScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';
import type { AssessmentHistoryEntry, AssessmentResult } from '@/types/assessment';

interface ResultScreenProps {
  result: AssessmentResult;
  history: AssessmentHistoryEntry[];
  onTryoutClick: () => void;
  onRetake: () => void;
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

const ResultScreen: React.FC<ResultScreenProps> = ({ result, history, onTryoutClick, onRetake }) => {
  const { t } = useLanguage();
  const {
    score,
    strengths,
    weaknesses = [],
    summary,
    recommendedRoles = [],
    hrMessage,
    metrics,
  } = result;
  const isAPlayer = score >= 80;

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="apple-card p-6 md:p-12 space-y-10"
    >
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t('resultScreen.title')}</h2>
        <p className="text-muted-foreground text-lg">
          {summary ?? t('resultScreen.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white/80 backdrop-blur border border-border/60 rounded-3xl p-6 shadow-sm text-left">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Điểm số tổng</p>
          <p className="text-5xl font-bold text-primary mt-2">{score}</p>
          {metrics ? (
            <p className="text-sm text-muted-foreground mt-2">
              {metrics.correctAnswers}/{metrics.totalQuestions} câu trả lời chính xác
            </p>
          ) : null}
          {recommendedRoles.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-600">Vai trò phù hợp</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {recommendedRoles.map((role) => (
                  <span
                    key={role}
                    className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 text-left">
          <h3 className="text-xl font-semibold text-primary mb-3">Thông báo từ HR</h3>
          <p className="text-primary/80 leading-relaxed">
            {hrMessage ?? 'Kết quả của bạn đã được gửi về cho HR xem xét, bạn sẽ nhận được thông báo qua email hoặc trực tiếp trên giao diện.'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 text-left">
        <div className="bg-white/80 backdrop-blur border border-emerald-100 rounded-3xl p-6 shadow-sm">
          <h3 className="font-semibold text-emerald-600 mb-4 text-lg">{t('resultScreen.strengthsTitle')}</h3>
          <div className="space-y-2">
            {strengths.map((strength, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-sm text-gray-700">{strength}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur border border-rose-100 rounded-3xl p-6 shadow-sm">
          <h3 className="font-semibold text-rose-600 mb-4 text-lg">Điểm cần cải thiện</h3>
          <div className="space-y-2">
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
        <Button variant="outline" onClick={onRetake} className="px-6 py-3 text-base font-semibold">
          Làm lại bài kiểm tra
        </Button>
        <Button onClick={onTryoutClick} className="apple-button px-6 py-3 text-base font-semibold">
          {isAPlayer ? t('resultScreen.successCta') : t('resultScreen.tryoutCta')}
        </Button>
      </div>

      <div className="text-left">
        <h3 className="text-xl font-semibold mb-4">Lịch sử làm bài</h3>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu lịch sử.</p>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white/80 border border-border/60 rounded-2xl px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-gray-800">{entry.role}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(entry.completedAt ?? entry.submittedAt ?? entry.startedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="capitalize">{entry.status ? entry.status.replace(/_/g, ' ') : 'không xác định'}</span>
                  {typeof entry.overallScore === 'number' ? (
                    <span className="text-lg font-semibold text-primary">{Math.round(entry.overallScore)}</span>
                  ) : null}
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