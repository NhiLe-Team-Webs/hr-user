import { motion } from 'framer-motion';
import { ArrowRight, Lightbulb, Sparkles, Target, Trophy, UserCheck } from 'lucide-react';

import type { AssessmentResult } from '@/types/assessment';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';

interface ResultScreenProps {
  result: AssessmentResult;
  onTryoutClick: () => void;
}

const clampPercentage = (value: number): number => Math.max(0, Math.min(100, value));

const formatCompletedAt = (value: string | null, locale: string): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  } catch (error) {
    console.warn('Failed to format completed date:', error);
    return null;
  }
};

const ResultScreen = ({ result, onTryoutClick }: ResultScreenProps) => {
  const { t, lang } = useLanguage();

  const score = typeof result.score === 'number' && Number.isFinite(result.score)
    ? Math.round(result.score)
    : null;
  const completedLabel = formatCompletedAt(result.completedAt, lang);
  const summaryText = result.summary && result.summary.trim().length > 0
    ? result.summary
    : t('resultScreen.summaryFallback');
  const strengths = result.strengths;
  const developmentAreas = result.developmentAreas;
  const skillScores = result.skillScores;
  const recommendedRoles = result.recommendedRoles;
  const developmentSuggestions = result.developmentSuggestions;
  const hrApprovalStatus = result.hrApprovalStatus ?? 'pending';
  const isHrApproved = hrApprovalStatus === 'approved';
  const isHrRejected = hrApprovalStatus === 'rejected';
  const tryoutMessage = isHrApproved
    ? t('resultScreen.tryoutApprovedText')
    : isHrRejected
      ? t('resultScreen.tryoutRejectedText')
      : t('resultScreen.tryoutPendingText');
  const statusLabel = isHrApproved
    ? t('resultScreen.hrStatusApproved')
    : isHrRejected
      ? t('resultScreen.hrStatusRejected')
      : t('resultScreen.hrStatusPending');
  const statusPillClass = isHrApproved
    ? 'bg-white/90 text-emerald-600 shadow-lg shadow-emerald-200/40'
    : isHrRejected
      ? 'bg-white/10 text-red-100 border border-white/30'
      : 'bg-white/10 text-emerald-50 border border-white/30';
  const showTryoutButton = isHrApproved;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 py-12">
      <motion.div
        key="result"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="mx-auto flex w-full max-w-5xl flex-col gap-8"
      >
        <div className="rounded-3xl border border-emerald-100 bg-white/90 p-8 shadow-xl shadow-emerald-100/50 backdrop-blur-sm md:p-12">
          <div className="flex flex-col gap-10 md:flex-row md:items-center">
            <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-3">
              <div className="relative h-40 w-40">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-300/40" />
                <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-5xl font-black text-emerald-600">
                    {score !== null ? `${score}` : '—'}
                  </span>
                  <span className="text-sm font-medium text-emerald-500">
                    {t('resultScreen.overallScoreLabel')}
                  </span>
                </div>
              </div>
              {completedLabel && (
                <div className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-600 shadow-sm">
                  {t('resultScreen.completedAtLabel', { date: completedLabel })}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 text-left">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-500" />
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-500">
                  {t('resultScreen.summaryTitle')}
                </p>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                {t('resultScreen.title')}
              </h2>
              <p className="leading-relaxed text-slate-600 md:text-lg">
                {summaryText}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-lg shadow-emerald-100/40">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-emerald-500" />
              <h3 className="text-xl font-semibold text-slate-900">
                {t('resultScreen.strengthsTitle')}
              </h3>
            </div>
            <p className="mt-2 text-sm text-slate-500">{t('resultScreen.strengthsDescription')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {strengths.length > 0 ? (
                strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm"
                  >
                    {strength}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">{t('resultScreen.strengthsEmpty')}</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-lg shadow-amber-100/40">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-amber-500" />
              <h3 className="text-xl font-semibold text-slate-900">
                {t('resultScreen.developmentAreasTitle')}
              </h3>
            </div>
            <p className="mt-2 text-sm text-slate-500">{t('resultScreen.developmentAreasDescription')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {developmentAreas.length > 0 ? (
                developmentAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm"
                  >
                    {area}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">{t('resultScreen.developmentAreasEmpty')}</p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/80 bg-white/90 p-8 shadow-lg shadow-sky-100/40">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-sky-500" />
            <h3 className="text-xl font-semibold text-slate-900">
              {t('resultScreen.skillScoresTitle')}
            </h3>
          </div>
          <p className="mt-2 text-sm text-slate-500">{t('resultScreen.skillScoresDescription')}</p>
          {skillScores.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {skillScores.map((skill) => {
                const value = clampPercentage(skill.score);
                return (
                  <div
                    key={`${skill.name}-${value}`}
                    className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>{skill.name}</span>
                      <span className="text-sky-600">{value}%</span>
                    </div>
                    <div className="mt-3 h-2.5 rounded-full bg-sky-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">{t('resultScreen.skillScoresEmpty')}</p>
          )}
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-lg shadow-purple-100/40">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-6 w-6 text-purple-500" />
              <h3 className="text-xl font-semibold text-slate-900">
                {t('resultScreen.developmentSuggestionsTitle')}
              </h3>
            </div>
            <p className="mt-2 text-sm text-slate-500">{t('resultScreen.developmentSuggestionsDescription')}</p>
            {developmentSuggestions.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {developmentSuggestions.map((suggestion) => (
                  <li
                    key={suggestion}
                    className="flex items-start gap-2 rounded-2xl bg-purple-50/80 px-4 py-3 text-left shadow-sm"
                  >
                    <span className="mt-1 h-2 w-2 rounded-full bg-purple-400" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">{t('resultScreen.developmentSuggestionsEmpty')}</p>
            )}
          </section>

          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-lg shadow-emerald-100/40">
            <div className="flex items-center gap-3">
              <UserCheck className="h-6 w-6 text-emerald-500" />
              <h3 className="text-xl font-semibold text-slate-900">
                {t('resultScreen.recommendedRolesTitle')}
              </h3>
            </div>
            <p className="mt-2 text-sm text-slate-500">{t('resultScreen.recommendedRolesDescription')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {recommendedRoles.length > 0 ? (
                recommendedRoles.map((role) => (
                  <span
                    key={role}
                    className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm"
                  >
                    {role}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">{t('resultScreen.recommendedRolesEmpty')}</p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-500 to-sky-500 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-bold">{t('resultScreen.nextStepsTitle')}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${statusPillClass}`}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm text-emerald-50 md:text-base">
                {tryoutMessage}
              </p>
            </div>
            {showTryoutButton && (
              <Button
                onClick={onTryoutClick}
                className="group flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-semibold text-emerald-600 shadow-lg shadow-emerald-300 transition hover:-translate-y-1 hover:shadow-xl"
              >
                {t('resultScreen.tryoutCta')}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Button>
            )}
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default ResultScreen;
