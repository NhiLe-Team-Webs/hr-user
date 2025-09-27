// src/components/AssessmentScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { GeminiApiError } from '../lib/api/gemini';
import {
  getAssessment,
  upsertAnswer,
  submitAssessmentAttempt,
  finaliseAssessmentAttempt,
  getLatestResult,
  type FinaliseAssessmentOptions,
} from '../lib/api';
import { Role, UserAnswers, Question, AnswerValue, Assessment } from '../types/assessment';
import { useLanguage } from '../hooks/useLanguage';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ role, onFinish }) => {
  const { activeAttempt, updateActiveAttempt, setAssessmentResult } = useAssessment();
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [answerRecords, setAnswerRecords] = useState<Record<string, { id: string; value: string }>>({});
  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = userAnswers[currentQuestionIndex];
  const hasAnsweredCurrent = currentQuestion?.format === 'multiple_choice'
    ? typeof currentAnswer !== 'undefined'
    : typeof currentAnswer === 'string' && currentAnswer.trim().length > 0;
  const [tabViolations, setTabViolations] = useState(0);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [isFinalising, setIsFinalising] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const finalisePayloadRef = useRef<FinaliseAssessmentOptions | null>(null);
  const isMountedRef = useRef(true);

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
      } catch (error) {
        console.error('Failed to persist answer for question', question.id, error);
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

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      finalisePayloadRef.current = null;
    };
  }, []);

  const runAiAnalysis = useCallback(async () => {
    const payload = finalisePayloadRef.current;
    if (!payload) {
      throw new Error('Khong the phan tich bai lam do thieu du lieu.');
    }

    const result = await finaliseAssessmentAttempt(payload);
    finalisePayloadRef.current = null;

    updateActiveAttempt(result.attempt);

    if (!isMountedRef.current) {
      return;
    }

    try {
      const latest = await getLatestResult(payload.profileId, payload.assessmentId);

      if (!isMountedRef.current) {
        return;
      }

      if (latest) {
        setAssessmentResult({
          score: latest.score,
          summary: latest.summary,
          strengths: latest.strengths,
          developmentAreas: latest.developmentAreas,
          skillScores: latest.skillScores,
          recommendedRoles: latest.recommendedRoles,
          developmentSuggestions: latest.developmentSuggestions,
          completedAt: latest.completedAt ?? latest.createdAt,
        });
      } else {
        setAssessmentResult(result.result);
      }
    } catch (error) {
      console.error('Failed to refresh latest assessment result:', error);
      if (isMountedRef.current) {
        setAssessmentResult(result.result);
      }
    }

    if (isMountedRef.current) {
      onFinish();
    }
  }, [onFinish, setAssessmentResult, updateActiveAttempt]);

  const getAiErrorMessage = useCallback(
    (error: unknown) => {
      if (error instanceof GeminiApiError) {
        if (error.status === 429) {
          return t('assessmentScreen.aiRateLimitError');
        }
        if (error.status === 503) {
          return t('assessmentScreen.aiServiceUnavailableError');
        }
        return t('assessmentScreen.aiErrorDescription');
      }

      if (error instanceof Error && error.message) {
        return error.message;
      }

      return t('assessmentScreen.aiErrorDescription');
    },
    [t],
  );

  const retryAnalysis = useCallback(async () => {
    if (!finalisePayloadRef.current) {
      if (isMountedRef.current) {
        setSubmissionError(null);
      }
      return;
    }

    if (isMountedRef.current) {
      setSubmissionError(null);
      setIsFinalising(true);
    }

    try {
      await runAiAnalysis();
    } catch (error) {
      console.error('Failed to retry AI analysis:', error);
      if (isMountedRef.current) {
        setSubmissionError(getAiErrorMessage(error));
      }
      updateActiveAttempt({
        aiStatus: 'failed',
        lastAiError: error instanceof Error ? error.message : null,
      });
    } finally {
      if (isMountedRef.current) {
        setIsFinalising(false);
      }
    }
  }, [getAiErrorMessage, runAiAnalysis, updateActiveAttempt]);


  const finishAssessment = useCallback(async () => {
    if (!activeAttempt || !assessment || !assessment.id || !user) {
      onFinish();
      return;
    }

    await persistAllAnswers();

    if (isMountedRef.current) {
      setSubmissionError(null);
      setIsFinalising(true);
    }

    try {
      const updatedAttempt = await submitAssessmentAttempt(activeAttempt.id);
      updateActiveAttempt(updatedAttempt);

      const answersForGemini = questions
        .map<FinaliseAssessmentOptions['answers'][number] | null>((question, index) => {
          const rawValue = userAnswers[index];
          if (typeof rawValue === 'undefined' || rawValue === null) {
            return null;
          }

          const common = {
            questionId: question.id,
            questionText: question.text,
            format: question.format,
            options: question.options?.map((option) => option.text ?? option.optionText ?? '') ?? [],
          } satisfies Omit<FinaliseAssessmentOptions['answers'][number], 'answerText'>;

          if (question.format === 'multiple_choice') {
            const optionIndex = Number(rawValue);
            const option = question.options?.[optionIndex];
            if (!option) {
              return null;
            }
            return {
              ...common,
              answerText: option.text ?? option.optionText ?? '',
            };
          }

          const textValue = String(rawValue).trim();
          if (!textValue) {
            return null;
          }

          return {
            ...common,
            answerText: textValue,
          };
        })
        .filter(
          (item): item is FinaliseAssessmentOptions['answers'][number] => item !== null,
        );

      const rawName =
        (typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : undefined) ?? user.email ?? null;

      finalisePayloadRef.current = {
        attemptId: updatedAttempt.id,
        assessmentId: assessment.id,
        profileId: user.id,
        role: role.name,
        candidateName: rawName ? rawName.trim() : null,
        language: lang,
        answers: answersForGemini,
      } satisfies FinaliseAssessmentOptions;

      await runAiAnalysis();
    } catch (error) {
      console.error('Failed to finalise assessment attempt:', error);
      if (isMountedRef.current) {
        setSubmissionError(getAiErrorMessage(error));
      }
      updateActiveAttempt({
        aiStatus: 'failed',
        lastAiError: error instanceof Error ? error.message : null,
      });
    } finally {
      if (isMountedRef.current) {
        setIsFinalising(false);
      }
    }
  }, [
    activeAttempt,
    assessment,
    getAiErrorMessage,
    lang,
    onFinish,
    persistAllAnswers,
    questions,
    role.name,
    runAiAnalysis,
    updateActiveAttempt,
    user,
    userAnswers,
  ]);


  // Timer logic
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

  const isAttemptSubmitted = Boolean(activeAttempt?.submittedAt);

  useEffect(() => {
    if (isFinalising || isAttemptSubmitted) {
      return;
    }

    const handleVisibilityChange = () => {
      if (!document.hidden || isFinalising || isAttemptSubmitted) {
        return;
      }

      setTabViolations((prev) => prev + 1);
      setIsAlertOpen(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isFinalising, isAttemptSubmitted]);

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

  // Fetch assessment data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const assessmentData = await getAssessment(role.name);
        if (!assessmentData) {
          throw new Error('No assessment data returned');
        }
        setAssessment(assessmentData);
        setTimeLeft(assessmentData.duration);

        if (assessmentData.questions?.length > 0) {
          const formattedQuestions: Question[] = assessmentData.questions.map((q: Question) => {
            const options = q.options?.map((opt) => ({
              ...opt,
              text: opt.text ?? opt.optionText ?? '',
            }));

            const correctAnswer =
              q.correctAnswer ?? options?.find((opt) => opt.isCorrect)?.id;

            return {
              ...q,
              points: q.points ?? 0,
              options,
              correctAnswer,
            };
          });

          setQuestions(formattedQuestions);
        } else {
          setQuestions([]);
          setError(t('assessmentScreen.noQuestions'));
        }
      } catch (err) {
        setError(t('assessmentScreen.errorFetching'));
        console.error('Error fetching assessment data:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [role, t]);



  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const canRetryAnalysis = Boolean(finalisePayloadRef.current);

  const renderQuestion = () => {
    if (!questions || questions.length === 0) return <p>{t('assessmentScreen.noAssessment')}</p>;
    const question = questions[currentQuestionIndex];

    return (
      <div className="space-y-8">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <h3 className="text-2xl font-bold mb-8 text-gray-800 leading-relaxed">
            {question.text}
          </h3>
        </motion.div>
        
        <div className="space-y-4">
          {question.format === 'multiple_choice' ? (
            question.options && question.options.length > 0 ? (
              question.options.map((option, index) => (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={`relative flex items-center p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 font-medium text-lg min-h-[70px]
                    ${userAnswers[currentQuestionIndex] === index
                        ? 'bg-blue-100 border-blue-500 text-blue-800 shadow-lg shadow-blue-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md'
                    } ${isFinalising ? 'pointer-events-none opacity-60' : ''}`}
                    onClick={() => {
                      if (!isFinalising) {
                        handleOptionSelect(index);
                      }
                    }}
                    aria-disabled={isFinalising}
                    data-disabled={isFinalising ? 'true' : undefined}
                  >
                    <span className="flex-1 text-left text-sm">{option.text}</span>
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t('assessmentScreen.noOptionsAvailable')}</p>
            )
          ) : (
            <Textarea
              placeholder={t('assessmentScreen.typeYourAnswer')}
              value={
                typeof userAnswers[currentQuestionIndex] === 'string'
                  ? (userAnswers[currentQuestionIndex] as string)
                  : ''
              }
              onChange={(event) => {
                if (!isFinalising) {
                  saveAnswer(currentQuestionIndex, event.target.value);
                }
              }}
              onBlur={() => {
                if (!isFinalising) {
                  void ensureAnswerPersisted(currentQuestionIndex);
                }
              }}
              disabled={isFinalising}
              className="min-h-[150px] p-4 border-2 rounded-2xl focus:border-blue-500 focus:ring-blue-500 transition-all duration-300"
            />
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center p-8">{t('assessmentScreen.loadingAssessment')}</div>;
  }
  
  if (!assessment) {
    return <div className="text-center p-8 text-red-500">{t('assessmentScreen.noAssessmentForRole')}</div>;
  }

  if (!activeAttempt) {
    return (
      <div className="text-center p-8 space-y-4">
        <p className="text-muted-foreground">{t('assessmentScreen.noValidAttemptMessage')}</p>
        <Button onClick={() => window.history.back()} className="apple-button">
          {t('assessmentScreen.backButton')}
        </Button>
      </div>
    );
  }
  return (
    <>
      {isFinalising && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white px-8 py-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {t('assessmentScreen.aiProcessingTitle')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('assessmentScreen.aiProcessingDescription')}
            </p>
          </div>
        </div>
      )}

      <motion.div
        key="assessment"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="flex min-h-screen flex-col bg-gradient-to-br from-green-50 via-blue-50 to-purple-50"
      >
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6">
            {/* Header */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mb-6 rounded-2xl bg-white p-6 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  {t('assessmentScreen.assessmentTitle')}: {role.name}
                </h2>
                {/* Timer Display */}
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
                  <Clock className="h-5 w-5" />
                  <span>{formatTime(timeLeft)}</span>
                </motion.div>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <motion.div
                  className="h-3 rounded-full bg-gradient-to-r from-green-400 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                <span>
                  {t('assessmentScreen.questionProgress', {
                    current: currentQuestionIndex + 1,
                    total: questions.length,
                  })}
                </span>
                <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
              </div>
            </motion.div>

            {/* Question Card */}
            <motion.div className="rounded-3xl bg-white p-8 shadow-xl">
              {renderQuestion()}
            </motion.div>
          </div>
        </div>

        {/* Fixed Navigation */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky bottom-0 border-t bg-white shadow-lg"
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
            <Button
              onClick={() => void navigateQuestion(-1)}
              disabled={currentQuestionIndex === 0 || isFinalising}
              variant="outline"
              className="flex items-center gap-2 rounded-xl px-6 py-3"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{t('assessmentScreen.previousBtn')}</span>
            </Button>

            {currentQuestionIndex === questions.length - 1 ? (
              <Button
                onClick={() => void finishAssessment()}
                disabled={!hasAnsweredCurrent || isFinalising}
                className={`flex items-center gap-2 rounded-xl px-6 py-3 transition-colors ${
                  hasAnsweredCurrent
                    ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                    : 'bg-gray-300'
                }`}
              >
                <span>{t('assessmentScreen.finishBtn')}</span>
                <CheckCircle className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                onClick={() => void navigateQuestion(1)}
                disabled={!hasAnsweredCurrent || isFinalising}
                className={`flex items-center gap-2 rounded-xl px-6 py-3 transition-colors ${
                  hasAnsweredCurrent
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                    : 'bg-gray-300'
                }`}
              >
                <span>{t('assessmentScreen.nextBtn')}</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}
          </div>
        </motion.div>

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mb-2 flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#EA3323">
                  <path d="m40-120 440-760 440 760H40Zm115.33-66.67h649.34L480-746.67l-324.67 560ZM482.78-238q14.22 0 23.72-9.62 9.5-9.61 9.5-23.83 0-14.22-9.62-23.72-9.5-14.22 0-23.72 9.62-9.62 9.5 23.83 0 14.22 9.62 23.72 9.62 9.5 23.83 9.5Zm-33.45-114H516v-216h-66.67v216ZM480-466.67Z" />
                </svg>
                <AlertDialogTitle>{t('assessmentScreen.tabWarningTitle')}</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                {t('assessmentScreen.tabWarningDescription', { remaining: 3 - tabViolations })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setIsAlertOpen(false)}>
                {t('assessmentScreen.tabWarningAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>

      <AlertDialog
        open={Boolean(submissionError)}
        onOpenChange={(open) => {
          if (!open) {
            setSubmissionError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('assessmentScreen.aiErrorTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {submissionError ?? t('assessmentScreen.aiErrorDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isFinalising}>
              {t('assessmentScreen.aiDismissButton')}
            </AlertDialogCancel>
            {canRetryAnalysis ? (
              <AlertDialogAction
                disabled={isFinalising}
                onClick={() => {
                  void retryAnalysis();
                }}
              >
                {t('assessmentScreen.aiRetryButton')}
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AssessmentScreen;






















