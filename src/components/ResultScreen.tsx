// src/components/ResultScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';
import type { AssessmentResult } from '@/types/assessment';

interface ResultScreenProps {
  result: AssessmentResult;
  onScheduleInterview: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ result, onScheduleInterview }) => {
  const { t } = useLanguage();

  const overallScore = result.overallScore ?? 0;
  const adjustedScore = result.adjustedScore;
  const hasCheating = result.cheatingCount > 0;
  const scoreToDisplay = hasCheating ? adjustedScore : overallScore;
  const summary = result.summary ?? result.aiSummary ?? '';
  const strengths = result.strengths ?? [];
  const weaknesses = result.weaknesses ?? [];
  const skillEntries = Object.entries(result.skillScores ?? {});

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 md:p-12"
    >
      <h2 className="text-3xl font-bold mb-3 tracking-tight">{t('resultScreen.title')}</h2>
      <p className="text-muted-foreground mb-8">{t('resultScreen.subtitle')}</p>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="bg-blue-50 text-blue-800 rounded-2xl p-4">
          <p className="text-sm font-semibold mb-1">{t('resultScreen.completedQuestions')}</p>
          <p className="text-3xl font-bold">{result.completedCount}</p>
        </div>
        <div className="bg-green-50 text-green-800 rounded-2xl p-4">
          <p className="text-sm font-semibold mb-1">
            {hasCheating ? t('resultScreen.adjustedScore') : t('resultScreen.overallScore')}
          </p>
          <p className="text-3xl font-bold">{scoreToDisplay}</p>
          {hasCheating ? (
            <p className="text-xs mt-2 text-green-700">
              {t('resultScreen.adjustedScoreNotice', { base: overallScore, adjusted: adjustedScore })}
            </p>
          ) : null}
        </div>
        <div className="bg-purple-50 text-purple-800 rounded-2xl p-4">
          <p className="text-sm font-semibold mb-1">{t('resultScreen.cheatingCount')}</p>
          <p className="text-3xl font-bold">{result.cheatingCount}</p>
        </div>
      </div>

      {hasCheating ? (
        <div className="mb-8 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700">
          {t('resultScreen.cheatingWarning', { count: result.cheatingCount })}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 mb-8 text-left">
        <div>
          <h3 className="font-semibold text-lg mb-3">{t('resultScreen.strengthsTitle')}</h3>
          <div className="flex flex-wrap gap-3">
            {strengths.length > 0
              ? strengths.map((strength, index) => (
                  <span key={index} className="bg-green-100 text-green-800 font-medium px-4 py-2 rounded-full">
                    {strength}
                  </span>
                ))
              : (
                <p className="text-sm text-muted-foreground">{t('resultScreen.noStrengths')}</p>
                )}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-lg mb-3">{t('resultScreen.weaknessesTitle')}</h3>
          <div className="flex flex-wrap gap-3">
            {weaknesses.length > 0
              ? weaknesses.map((weakness, index) => (
                  <span key={index} className="bg-orange-100 text-orange-800 font-medium px-4 py-2 rounded-full">
                    {weakness}
                  </span>
                ))
              : (
                <p className="text-sm text-muted-foreground">{t('resultScreen.noWeaknesses')}</p>
                )}
          </div>
        </div>
      </div>

      {skillEntries.length > 0 ? (
        <div className="mb-8 text-left">
          <h3 className="font-semibold text-lg mb-3">{t('resultScreen.skillScoresTitle')}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {skillEntries.map(([skill, score]) => (
              <div
                key={skill}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3"
              >
                <span className="font-medium text-gray-700">{skill}</span>
                <span className="text-gray-900 font-semibold">{score}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="text-left mb-8">
        <h3 className="font-semibold text-lg mb-3">{t('resultScreen.analysisSummaryTitle')}</h3>
        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{summary}</p>
      </div>

      <div className="mb-8 p-5 rounded-2xl bg-blue-50 text-blue-800 font-semibold">
        {t('resultScreen.resultNotice')}
      </div>

      <Button className="apple-button mt-4" onClick={onScheduleInterview}>
        {t('resultScreen.scheduleInterviewCta')}
      </Button>
    </motion.div>
  );
};

export default ResultScreen;
