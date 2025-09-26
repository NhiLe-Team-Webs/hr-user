// src/components/AssessmentScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { getAssessment, upsertAnswer, submitAssessmentAttempt, getAttemptAnswerDetails } from '../lib/api';
import { saveAssessmentResultAnalysis } from '../lib/api';
import { analyzeWithGemini } from '../lib/api/gemini';
import { renderQuestion } from './assessment/renderQuestion';
import type { Assessment, Role, UserAnswers, AnswerValue } from '../types/assessment';
import type { Question } from '@/types/question';
import { useLanguage } from '../hooks/useLanguage';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface AssessmentScreenProps {
  role: Role;
  onFinish: () => void;
}

interface AnswerRecord {
  id: string;
  value: string;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ role, onFinish }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { activeAttempt, updateActiveAttempt, setAssessmentResult } = useAssessment();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [answerRecords, setAnswerRecords] = useState<Record<string, AnswerRecord>>({});
  const [hasLoadedPersistedAnswers, setHasLoadedPersistedAnswers] = useState(false);
  const [tabViolations, setTabViolations] = useState(0);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = userAnswers[currentQuestionIndex];
  const hasAnsweredCurrent = currentQuestion?.format === 'multiple_choice'
    ? typeof currentAnswer !== 'undefined'
    : typeof currentAnswer === 'string' && currentAnswer.trim().length > 0;

  const ensureAnswerPersisted = useCallback(
    async (questionIndex: number, overrideRawValue?: AnswerValue) => {
      const question = questions[questionIndex];
      if (!question || !activeAttempt) {
        return;
      }

      const rawValue =
        typeof overrideRawValue !== 'undefined'
          ? overrideRawValue
          : userAnswers[questionIndex];

      if (
        typeof rawValue === 'undefined' ||
        rawValue === null ||
        (question.format !== 'multiple_choice' &&
          typeof rawValue === 'string' &&
          rawValue.trim() === '')
      ) {
        return;
      }

      let selectedOptionId: string | null = null;
      let userAnswerText: string | null = null;
      let persistedValue = '';

      if (question.format === 'multiple_choice') {
        const optionIndex = Number(rawValue);
        const selectedOption = question.options?.[optionIndex];
        if (!selectedOption) {
          return;
        }
        selectedOptionId = selectedOption.id;
        persistedValue = selectedOptionId;
      } else {
        const textValue = String(rawValue);
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
  }, [activeAttempt, questions, ensureAnswerPersisted]);

  const finishAssessment = useCallback(async () => {
    if (!activeAttempt) {
      onFinish();
      return;
    }

    await persistAllAnswers();

    try {
      const updatedAttempt = await submitAssessmentAttempt(activeAttempt.id, tabViolations);
      updateActiveAttempt(updatedAttempt);

      const { details, completedCount } = await getAttemptAnswerDetails(updatedAttempt.id);
      if (completedCount > 0) {
        updateActiveAttempt({ answeredCount: completedCount });
      }

      const answersPayload = details.map((detail) => ({
        questionId: detail.answer.question_id,
        questionText: detail.question?.text ?? 'Câu hỏi không xác định',
        format: detail.question?.format ?? 'text',
        answer: detail.resolvedAnswer,
      }));

      const analysis = await analyzeWithGemini({
        answers: answersPayload,
        cheatingCount: Math.max(tabViolations, updatedAttempt.cheatingCount),
        completedCount,
        role: updatedAttempt.role ?? role.name,
        assessmentTitle: assessment?.title ?? null,
      });

      const savedResult = await saveAssessmentResultAnalysis({
        attemptId: updatedAttempt.id,
        assessmentId: updatedAttempt.assessmentId ?? assessment?.id ?? null,
        profileId: user?.id ?? null,
        overallScore: analysis.overallScore,
        strengths: analysis.strengths ?? [],
        weaknesses: analysis.weaknesses ?? [],
        summary: analysis.summary,
        aiSummary: analysis.aiSummary ?? analysis.summary ?? null,
        skillScores: analysis.skillScores,
        completedCount,
        cheatingCount: Math.max(tabViolations, updatedAttempt.cheatingCount),
      });

      setAssessmentResult(savedResult);
    } catch (analysisError) {
      console.error('Failed to finalise assessment attempt:', analysisError);
    }

    onFinish();
  }, [
    activeAttempt,
    assessment,
    onFinish,
    persistAllAnswers,
    role.name,
    setAssessmentResult,
    tabViolations,
    updateActiveAttempt,
    user?.id,
  ]);

  useEffect(() => {
    if (timeLeft <= 0 && timeLeft !== 0) {
      void finishAssessment();
      return;
    }

    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }

    return undefined;
  }, [timeLeft, finishAssessment]);

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
  }, [role]);

  useEffect(() => {
    if (tabViolations >= 3) {
      void finishAssessment();
    }
  }, [tabViolations, finishAssessment]);

  const saveAnswer = (questionIndex: number, answer: AnswerValue) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const handleOptionSelect = (optionIndex: number) => {
    saveAnswer(currentQuestionIndex, optionIndex);
    void ensureAnswerPersisted(currentQuestionIndex, optionIndex);
  };

  const navigateQuestion = useCallback(
    async (direction: number) => {
      await ensureAnswerPersisted(currentQuestionIndex);
      const newIndex = currentQuestionIndex + direction;
      if (newIndex >= 0 && newIndex < questions.length) {
        setCurrentQuestionIndex(newIndex);
      }
    },
    [currentQuestionIndex, questions.length, ensureAnswerPersisted],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const assessmentData = await getAssessment(role.name);
        if (!assessmentData) {
          throw new Error('No assessment data returned');
        }

        setAssessment(assessmentData);
        setQuestions(assessmentData.questions);
        setTimeLeft(assessmentData.duration);
        setError(null);
      } catch (fetchError) {
        setQuestions([]);
        setError(t('assessmentScreen.errorLoading'));
        console.error('Error fetching assessment data:', fetchError);
      } finally {
        setLoading(false);
      }
    };

    fetchData().catch((err) => {
      console.error('Unexpected error loading assessment:', err);
      setLoading(false);
    });
  }, [role, t]);

  useEffect(() => {
    if (!activeAttempt || hasLoadedPersistedAnswers || questions.length === 0) {
      return;
    }

    const loadPersistedAnswers = async () => {
      try {
        const { details, completedCount } = await getAttemptAnswerDetails(activeAttempt.id);
        if (details.length === 0) {
          setHasLoadedPersistedAnswers(true);
          return;
        }

        const nextUserAnswers: UserAnswers = {};
        const nextRecords: Record<string, AnswerRecord> = {};

        details.forEach((detail) => {
          const questionId = detail.answer.question_id;
          const questionIndex = questions.findIndex((question) => question.id === questionId);

          if (questionIndex === -1) {
            return;
          }

          if (detail.question?.format === 'multiple_choice' && detail.answer.selected_option_id) {
            const optionIndex = detail.question.options?.findIndex(
              (option) => option.id === detail.answer.selected_option_id,
            );
            if (optionIndex != null && optionIndex >= 0) {
              nextUserAnswers[questionIndex] = optionIndex;
              nextRecords[questionId] = {
                id: detail.answer.id,
                value: detail.answer.selected_option_id,
              };
            }
          } else if (detail.answer.user_answer_text) {
            nextUserAnswers[questionIndex] = detail.answer.user_answer_text;
            nextRecords[questionId] = {
              id: detail.answer.id,
              value: detail.answer.user_answer_text,
            };
          }
        });

        if (completedCount > 0) {
          updateActiveAttempt({ answeredCount: completedCount });
        }

        setUserAnswers((prev) => ({ ...prev, ...nextUserAnswers }));
        setAnswerRecords((prev) => ({ ...prev, ...nextRecords }));
      } catch (loadError) {
        console.error('Failed to load persisted answers:', loadError);
      } finally {
        setHasLoadedPersistedAnswers(true);
      }
    };

    loadPersistedAnswers().catch((err) => {
      console.error('Unexpected error loading persisted answers:', err);
      setHasLoadedPersistedAnswers(true);
    });
  }, [activeAttempt, hasLoadedPersistedAnswers, questions, updateActiveAttempt]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderActiveQuestion = () => {
    if (!questions || questions.length === 0) {
      return <p>{t('assessmentScreen.noAssessment')}</p>;
    }

    const question = questions[currentQuestionIndex];

    return (
      <div className="space-y-8">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center"
        >
          <h3 className="text-2xl font-bold mb-8 text-gray-800 leading-relaxed">
            {question.text}
          </h3>
        </motion.div>

        <div className="space-y-4">
          {renderQuestion(question, {
            currentAnswer,
            onOptionSelect: handleOptionSelect,
            onTextChange: (value) => saveAnswer(currentQuestionIndex, value),
            onTextBlur: () => void ensureAnswerPersisted(currentQuestionIndex),
            t,
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center p-8">Đang tải bài đánh giá...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">{error}</div>;
  }

  if (!assessment) {
    return <div className="text-center p-8 text-red-500">{t('assessmentScreen.noAssessment')}</div>;
  }

  if (!activeAttempt) {
    return (
      <div className="text-center p-8 space-y-4">
        <p className="text-muted-foreground">
          Không tìm thấy phiên làm bài hợp lệ. Vui lòng quay lại bước trước để bắt đầu lại.
        </p>
        <Button onClick={() => window.history.back()} className="apple-button">
          Quay lại
        </Button>
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
      className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex flex-col"
    >
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {t('assessmentScreen.assessmentTitle')}: {role.name}
              </h2>
              <motion.div
                className="flex items-center gap-2 text-lg font-semibold text-gray-800"
                animate={{
                  scale: timeLeft <= 300 ? [1, 1.1, 1] : 1,
                  color: timeLeft <= 300 ? '#EA3323' : '#374151',
                }}
                transition={{
                  repeat: timeLeft <= 300 ? Infinity : 0,
                  duration: 0.8,
                }}
              >
                <Clock className="w-5 h-5" />
                <span>{formatTime(timeLeft)}</span>
              </motion.div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${questions.length ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
              <span>
                Câu {currentQuestionIndex + 1}/{questions.length}
              </span>
              <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-3xl shadow-xl p-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {renderActiveQuestion()}

            <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{t('assessmentScreen.progressLabel')}</p>
                  <p className="text-sm text-gray-500">
                    {activeAttempt.answeredCount}/{activeAttempt.totalQuestions} câu đã trả lời
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="px-6 py-3 rounded-full text-sm font-medium"
                  onClick={() => navigateQuestion(-1)}
                  disabled={currentQuestionIndex === 0}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('assessmentScreen.previousBtn')}
                </Button>

                {currentQuestionIndex < questions.length - 1 ? (
                  <Button
                    className="apple-button px-6 py-3 rounded-full text-sm font-medium"
                    onClick={() => navigateQuestion(1)}
                    disabled={!hasAnsweredCurrent}
                  >
                    {t('assessmentScreen.nextBtn')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    className="apple-button px-6 py-3 rounded-full text-sm font-medium"
                    onClick={() => void finishAssessment()}
                    disabled={!hasAnsweredCurrent}
                  >
                    {t('assessmentScreen.finishBtn')}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isAlertOpen && (
          <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bạn vừa rời khỏi cửa sổ làm bài</AlertDialogTitle>
                <AlertDialogDescription>
                  Mỗi lần rời khỏi cửa sổ làm bài sẽ bị tính là một lần vi phạm. Tổng số lần hiện tại:{' '}
                  <strong>{tabViolations}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsAlertOpen(false)}>
                  Tôi hiểu
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AssessmentScreen;
