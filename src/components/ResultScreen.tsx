import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';
import type { AssessmentResult } from '@/types/assessment';
import { cn } from '@/lib/utils';

interface ResultScreenProps {
  result: AssessmentResult;
  onScheduleInterview: () => void;
}

const formatScore = (value: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value)} / 100`;
};

const ResultScreen: React.FC<ResultScreenProps> = ({ result, onScheduleInterview }) => {
  const { t } = useLanguage();
  const hasCheating = (result.cheatingCount ?? 0) > 0;
  const displayScore = hasCheating ? result.adjustedScore ?? result.overallScore : result.overallScore;

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="rounded-3xl bg-white shadow-xl p-8 md:p-12 space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold tracking-tight">{t('resultScreen.title')}</h2>
          <p className="text-muted-foreground">{t('resultScreen.subtitle')}</p>
          <p className="mt-4 rounded-2xl bg-primary/5 px-4 py-3 text-primary font-medium">
            {t('resultScreen.sentToHrNotice')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('resultScreen.overallScore')}</p>
            <p className="mt-2 text-2xl font-semibold">{formatScore(displayScore)}</p>
            {hasCheating && (
              <p className="mt-2 text-xs text-destructive font-medium">
                {t('resultScreen.adjustedScoreNote', {
                  original: formatScore(result.overallScore ?? null),
                  adjusted: formatScore(result.adjustedScore ?? null),
                })}
              </p>
            )}
          </div>
          <div className="rounded-2xl border p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('resultScreen.completedCount')}</p>
            <p className="mt-2 text-2xl font-semibold">{result.completedCount}</p>
          </div>
          <div
            className={cn(
              'rounded-2xl border p-4 text-center',
              hasCheating ? 'border-destructive bg-destructive/5 text-destructive' : 'text-emerald-600 border-emerald-200',
            )}
          >
            <p className="text-sm text-muted-foreground">{t('resultScreen.cheatingCount')}</p>
            <p className="mt-2 text-2xl font-semibold">{result.cheatingCount}</p>
            {hasCheating ? (
              <p className="mt-2 text-xs font-medium">{t('resultScreen.cheatingDetected')}</p>
            ) : (
              <p className="mt-2 text-xs text-emerald-600">{t('resultScreen.cheatingClear')}</p>
            )}
          </div>
        </div>

        {result.skillScores && Object.keys(result.skillScores).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('resultScreen.skillScoresTitle')}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(result.skillScores).map(([skill, score]) => (
                <div key={skill} className="rounded-2xl border p-4 flex justify-between items-center">
                  <span className="font-medium capitalize">{skill}</span>
                  <span className="text-sm text-muted-foreground">{formatScore(score)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('resultScreen.strengthsTitle')}</h3>
            {result.strengths.length > 0 ? (
              <ul className="space-y-2 text-left">
                {result.strengths.map((strength, index) => (
                  <li key={`${strength}-${index}`} className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700 text-sm">
                    {strength}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('resultScreen.emptyStrengths')}</p>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('resultScreen.weaknessesTitle')}</h3>
            {result.weaknesses.length > 0 ? (
              <ul className="space-y-2 text-left">
                {result.weaknesses.map((weakness, index) => (
                  <li key={`${weakness}-${index}`} className="rounded-xl bg-amber-50 px-4 py-3 text-amber-700 text-sm">
                    {weakness}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('resultScreen.emptyWeaknesses')}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">{t('resultScreen.summaryTitle')}</h3>
          <p className="rounded-2xl border px-5 py-4 text-sm leading-relaxed text-left text-muted-foreground">
            {result.summary || t('resultScreen.emptySummary')}
          </p>
        </div>

        <div className="pt-4 border-t border-border/60 text-center space-y-4">
          <p className="text-muted-foreground text-sm md:text-base">{t('resultScreen.nextStepsTitle')}</p>
          <Button onClick={onScheduleInterview} size="lg" className="px-8">
            {t('resultScreen.scheduleCta')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ResultScreen;
