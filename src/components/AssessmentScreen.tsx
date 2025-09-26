import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { useToast } from './ui/use-toast';
import { getAssessment, upsertAnswer, submitAssessmentAttempt } from '../lib/api';
import type { Role, UserAnswers, Question, AnswerValue, Assessment } from '../types/assessment';
import { useLanguage } from '../hooks/useLanguage';
import { useAssessment } from '@/contexts/AssessmentContext';
import { renderQuestion } from '@/lib/questions/renderQuestion';
import { analyzeWithGemini } from '@/lib/ai/analyzeWithGemini';

interface AssessmentScreenProps {
  role: Role;
  onFinish: () => void;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ role, onFinish }) => {
  const { toast } = useToast();
  const { activeAttempt, updateActiveAttempt, setAssessmentResult } = useAssessment();
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [answerRecords, setAnswerRecords] = useState<Record<string, { id: string; value: string }>>({});
  const [tabViolations, setTabViolations] = useState(0);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = userAnswers[currentQuestionIndex];

  const hasAnsweredCurrent = useMemo(() => {
    if (!currentQuestion) {
      return false;
    }

    if (currentQuestion.format === 'multiple_choice') {
      if (typeof currentAnswer === 'string') {
        return currentAnswer.trim().length > 0;
      }
      if (typeof currentAnswer === 'number') {
        return Number.isFinite(currentAnswer);
      }
      return false;
    }

    if (typeof currentAnswer === 'string') {
      return currentAnswer.trim().length > 0;
    }

    return false;
  }, [currentAnswer, currentQuestion]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const assessmentData = await getAssessment(role.name);
        if (!assessmentData) {
          setError(t('assessmentScreen.noAssessment'));
          setQuestions([]);
          setAssessment(null);
          return;
        }
        setAssessment(assessmentData);
        setQuestions(assessmentData.questions ?? []);
        setTimeLeft(Math.max(0, assessmentData.duration ?? 0));
      } catch (err) {
        console.error(err);
        setError(t('assessmentScreen.errorLoading'));
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [role.name, t]);

  const ensureAnswerPersisted = useCallback(
    async (questionIndex: number, overrideRawValue?: AnswerValue) => {
      const question = questions[questionIndex];
      if (!question || !activeAttempt) {
        return;
      }

      const rawValue =
        typeof overrideRawValue !== 'undefined' ? overrideRawValue : userAnswers[questionIndex];

      if (typeof rawValue === 'undefined' || rawValue === null) {
        return;
      }

      let selectedOptionId: string | null = null;
      let userAnswerText: string | null = null;
      let persistedValue = '';

      if (question.format === 'multiple_choice') {
        if (typeof rawValue === 'string') {
          selectedOptionId = rawValue;
        } else if (typeof rawValue === 'number' && question.options?.[rawValue]) {
          selectedOptionId = question.options?.[rawValue]?.id ?? null;
        }

        if (!selectedOptionId) {
          return;
        }
        persistedValue = selectedOptionId;
      } else {
        const textValue = String(rawValue).trim();
        if (!textValue) {
          return;
        }
        userAnswerText = textValue;
        persistedValue = textValue;
      }

      const existingRecord = answerRecords[question.id];
      if (existingRecord && existingRecord.value === persistedValue) {
        return;
      }

      try {
        const result = await upsertAnswer({
          id: existingRecord?.id,
          attemptId: activeAttempt.id,
          questionId: question.id,
          selectedOptionId,
          userAnswerText,
        });

        if (result?.id) {
          setAnswerRecords((prev) => ({
            ...prev,
            [question.id]: { id: result.id, value: persistedValue },
          }));
          updateActiveAttempt({ lastActivityAt: new Date().toISOString() });
        }
      } catch (persistError) {
        console.error('Failed to persist answer for question', question.id, persistError);
      }
    },
    [activeAttempt, answerRecords, questions, updateActiveAttempt, userAnswers],
  );

  const persistAllAnswers = useCallback(async () => {
    if (!activeAttempt) {
      return;
    }
    await Promise.all(questions.map((_, index) => ensureAnswerPersisted(index)));
  }, [activeAttempt, ensureAnswerPersisted, questions]);

  const handleOptionSelect = (optionId: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionId,
    }));
    void ensureAnswerPersisted(currentQuestionIndex, optionId);
  };

  const saveAnswer = (questionIndex: number, answer: AnswerValue) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const navigateQuestion = useCallback(
    async (direction: number) => {
      await ensureAnswerPersisted(currentQuestionIndex);
      const newIndex = currentQuestionIndex + direction;
      if (newIndex >= 0 && newIndex < questions.length) {
        setCurrentQuestionIndex(newIndex);
      }
    },
    [currentQuestionIndex, ensureAnswerPersisted, questions.length],
  );

  const finishAssessment = useCallback(async () => {
    if (!activeAttempt || !assessment || isSubmitting) {
      onFinish();
      return;
    }

    setIsSubmitting(true);

    try {
      await persistAllAnswers();
      const updatedAttempt = await submitAssessmentAttempt({
        attemptId: activeAttempt.id,
        cheatingCount: tabViolations,
      });
      updateActiveAttempt(updatedAttempt);

      const analysis = await analyzeWithGemini({
        attemptId: updatedAttempt.id,
        assessmentId: assessment.id,
        role: role.name,
        questions,
        cheatingCount: tabViolations,
      });

      setAssessmentResult(analysis);
    } catch (submitError) {
      console.error('Failed to submit assessment:', submitError);
      toast({
        title: 'Có lỗi xảy ra khi xử lý bài đánh giá.',
        description: 'Vui lòng thử lại sau vài phút.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      onFinish();
    }
  }, [
    activeAttempt,
    assessment,
    isSubmitting,
    onFinish,
    persistAllAnswers,
    role.name,
    questions,
    tabViolations,
    toast,
    updateActiveAttempt,
    setAssessmentResult,
  ]);

  useEffect(() => {
    if (timeLeft <= 0 && !loading) {
      void finishAssessment();
      return;
    }

    if (timeLeft > 0) {
      const timer = window.setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => window.clearInterval(timer);
    }

    return undefined;
  }, [finishAssessment, loading, timeLeft]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabViolations((prev) => prev + 1);
        setIsAlertOpen(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (tabViolations >= 3) {
      void finishAssessment();
    }
  }, [finishAssessment, tabViolations]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderCurrentQuestion = () => {
    if (!questions || questions.length === 0) {
      return <p>{t('assessmentScreen.noAssessment')}</p>;
    }

    const question = questions[currentQuestionIndex];
    const selectedOptionId =
      question.format === 'multiple_choice'
        ? typeof userAnswers[currentQuestionIndex] === 'string'
          ? (userAnswers[currentQuestionIndex] as string)
          : typeof userAnswers[currentQuestionIndex] === 'number'
            ? question.options?.[Number(userAnswers[currentQuestionIndex])]?.id ?? null
            : null
        : null;

    const textValue =
      question.format === 'multiple_choice'
        ? undefined
        : typeof userAnswers[currentQuestionIndex] === 'string'
          ? (userAnswers[currentQuestionIndex] as string)
          : '';

    return (
      <div className="space-y-8">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center"
        >
          <h3 className="text-2xl font-semibold mb-6 text-foreground leading-relaxed">
            {question.text}
          </h3>
        </motion.div>

        <div className="space-y-4">
          {renderQuestion({
            question,
            selectedOptionId,
            onSelectOption: handleOptionSelect,
            textValue,
            onTextChange: (value) => saveAnswer(currentQuestionIndex, value),
            onTextBlur: () => void ensureAnswerPersisted(currentQuestionIndex),
            t,
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center p-8">{t('assessmentScreen.loading')}</div>;
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          {t('preAssessmentScreen.retryButton')}
        </Button>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        {t('assessmentScreen.noAssessment')}
      </div>
    );
  }

  if (!activeAttempt) {
    return (
      <div className="text-center p-8 space-y-4">
        <p className="text-muted-foreground">
          Không tìm thấy phiên làm bài hợp lệ. Vui lòng quay lại bước trước để bắt đầu lại.
        </p>
        <Button onClick={() => window.history.back()}>{t('resultScreen.backToSelection')}</Button>
      </div>
    );
  }

  return (
    <motion.div
      key="assessment"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-3xl bg-white shadow-xl overflow-hidden">
          <div className="px-6 py-5 border-b">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">
                  {t('assessmentScreen.assessmentTitle')}
                </p>
                <h2 className="text-2xl font-semibold text-foreground">{assessment.title}</h2>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-5 h-5 text-primary" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>
                  {t('assessmentScreen.questionLabel')} {currentQuestionIndex + 1}/{questions.length}
                </span>
                <span>{Math.round(((currentQuestionIndex + 1) / Math.max(1, questions.length)) * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-primary to-primary/70 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentQuestionIndex + 1) / Math.max(1, questions.length)) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-8">{renderCurrentQuestion()}</div>
        </div>

        <AnimatePresence>
          {tabViolations > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-3 rounded-2xl border border-amber-500/60 bg-amber-50 px-4 py-3 text-amber-700"
            >
              <ShieldAlert className="w-5 h-5" />
              <p className="text-sm">
                Bạn đã chuyển tab {tabViolations} lần. Vi phạm từ 3 lần trở lên sẽ tự động kết thúc bài đánh giá.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sticky bottom-0 bg-white border-t border-border">
          <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
            <Button
              onClick={() => void navigateQuestion(-1)}
              disabled={currentQuestionIndex === 0 || isSubmitting}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('assessmentScreen.previousBtn')}</span>
            </Button>

            {currentQuestionIndex === questions.length - 1 ? (
              <Button
                onClick={() => void finishAssessment()}
                disabled={!hasAnsweredCurrent || isSubmitting}
                className="flex items-center gap-2 px-6"
              >
                <span>{isSubmitting ? t('assessmentScreen.loading') : t('assessmentScreen.finishBtn')}</span>
                <CheckCircle className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                onClick={() => void navigateQuestion(1)}
                disabled={!hasAnsweredCurrent || isSubmitting}
                className="flex items-center gap-2 px-6"
              >
                <span>{t('assessmentScreen.nextBtn')}</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cảnh báo gian lận</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đã chuyển tab trong khi làm bài. Bài kiểm tra sẽ bị kết thúc nếu bạn rời tab thêm {Math.max(
                0,
                3 - tabViolations,
              )}{' '}
              lần nữa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsAlertOpen(false)}>Tiếp tục làm bài</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AssessmentScreen;
