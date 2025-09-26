// src/components/AssessmentScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import {
  getAssessment,
  getAnswersForAttempt,
  upsertAnswer,
  submitAssessmentAttempt,
  completeAssessmentAttempt,
} from '../lib/api';
import { Role, UserAnswers, Question, AnswerValue, AssessmentResult, AssessmentAttempt } from '../types/assessment';
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
import { generateAssessmentResult } from '@/lib/resultGenerator';

interface AssessmentCompletePayload {
  result: AssessmentResult;
  attempt: AssessmentAttempt | null;
}

type LoadedAssessment = {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  questions: Question[];
};

interface AssessmentScreenProps {
  role: Role;
  onFinish: (payload: AssessmentCompletePayload) => void;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ role, onFinish }) => {
  const { activeAttempt, updateActiveAttempt } = useAssessment();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState<LoadedAssessment | null>(null);
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
  const [isFinishing, setIsFinishing] = useState(false);

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

  const computeAnsweredCount = useCallback(() => {
    return questions.reduce((count, question, index) => {
      const value = userAnswers[index];

      if (typeof value === 'number') {
        return count + 1;
      }

      if (typeof value === 'string' && value.trim().length > 0) {
        return count + 1;
      }

      return count;
    }, 0);
  }, [questions, userAnswers]);

  useEffect(() => {
    if (!activeAttempt || questions.length === 0) {
      return;
    }

    const answeredCount = computeAnsweredCount();
    const progressPercent = questions.length
      ? Math.min(100, Math.round((answeredCount / questions.length) * 100))
      : 0;

    updateActiveAttempt({ answeredCount, progressPercent });
  }, [activeAttempt, computeAnsweredCount, questions.length, updateActiveAttempt]);

  useEffect(() => {
    if (!activeAttempt) {
      return;
    }

    updateActiveAttempt({ cheatingCount: tabViolations });
  }, [activeAttempt, tabViolations, updateActiveAttempt]);

  const finishAssessment = useCallback(async () => {
    if (!activeAttempt) {
      console.warn('Attempt not found when trying to finish assessment');
      return;
    }

    if (!user) {
      console.warn('User must be authenticated to complete assessment');
      return;
    }

    const totalDuration = assessment?.duration ?? 0;
    const durationSpent = totalDuration > 0 ? Math.max(0, totalDuration - timeLeft) : undefined;
    const totalQuestions = questions.length;

    setIsFinishing(true);

    await persistAllAnswers();

    const answeredCount = computeAnsweredCount();

    try {
      const submittedAttempt = await submitAssessmentAttempt({
        attemptId: activeAttempt.id,
        answeredCount,
        totalQuestions,
        cheatingCount: tabViolations,
      });
      updateActiveAttempt(submittedAttempt);
    } catch (error) {
      console.error('Failed to submit attempt for processing:', error);
    }

    let generatedResult: AssessmentResult;

    try {
      generatedResult = await generateAssessmentResult({
        attemptId: activeAttempt.id,
        role,
        questions,
        answers: userAnswers,
        durationSeconds: durationSpent,
        cheatingCount: tabViolations,
      });
    } catch (error) {
      console.error('Failed to generate assessment result:', error);
      const fallbackCompletedAt = new Date().toISOString();
      generatedResult = {
        id: `${Date.now()}`,
        score: 0,
        strengths: ['Bạn đã hoàn thành đầy đủ bài đánh giá.'],
        weaknesses: ['Hệ thống chưa thể tính toán điểm số, vui lòng thử lại sau.'],
        summary: 'Hệ thống gặp sự cố khi tính toán điểm số của bạn.',
        recommendedRoles: [role.name],
        completedAt: fallbackCompletedAt,
        hrMessage:
          'Kết quả của bạn đã được gửi về cho HR xem xét, bạn sẽ nhận được thông báo qua email hoặc trực tiếp trên giao diện.',
        aiSummary: null,
        metrics: {
          totalQuestions,
          answeredQuestions: answeredCount,
          correctAnswers: 0,
          durationSeconds: durationSpent,
          cheatingCount: tabViolations,
        },
        analysisModel: 'rule-based',
        analysisVersion: 'fallback',
      };
    }

    try {
      const linkedAnswerIds = Object.values(answerRecords)
        .map((record) => record.id)
        .filter(Boolean);

      const completion = await completeAssessmentAttempt({
        attemptId: activeAttempt.id,
        profileId: user.id,
        assessmentId: activeAttempt.assessmentId ?? assessment?.id ?? null,
        result: generatedResult,
        answeredCount,
        totalQuestions,
        durationSeconds: durationSpent,
        cheatingCount: tabViolations,
        answerIds: linkedAnswerIds,
      });

      onFinish({
        result: completion.result,
        attempt: completion.attempt,
      });
    } catch (error) {
      console.error('Failed to persist final assessment result:', error);
      const fallbackAttempt: AssessmentAttempt = {
        ...activeAttempt,
        status: 'completed',
        answeredCount,
        totalQuestions,
        completedAt: generatedResult.completedAt ?? new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        progressPercent: totalQuestions ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 100,
      };

      onFinish({
        result: generatedResult,
        attempt: fallbackAttempt,
      });
    } finally {
      setIsFinishing(false);
    }
  }, [
    activeAttempt,
    answerRecords,
    assessment,
    computeAnsweredCount,
    onFinish,
    persistAllAnswers,
    questions,
    role,
    tabViolations,
    timeLeft,
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

  // Fetch assessment data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const assessmentData = await getAssessment(role.name);
        if (!assessmentData) {
          throw new Error('No assessment data returned');
        }

        const formattedQuestions: Question[] = (assessmentData.questions ?? []).map((q: any) => {
          const formattedQuestion: Question = {
            id: q.id,
            text: q.text,
            type: q.type,
            format: q.format,
            required: q.required,
            points: q.points ?? 0,
          };

          if (q.format === 'multiple_choice' && q.options) {
            formattedQuestion.options = q.options.map((opt: any) => ({
              id: opt.id,
              text: opt.option_text,
            }));
            formattedQuestion.correctAnswer = q.options.find((opt: any) => opt.is_correct)?.id;
          }

          return formattedQuestion;
        });

        setQuestions(formattedQuestions);

        if (activeAttempt) {
          try {
            const persistedAnswers = await getAnswersForAttempt(activeAttempt.id);
            if (persistedAnswers.length > 0) {
              const restoredAnswers: UserAnswers = {};
              const restoredRecords: Record<string, { id: string; value: string }> = {};
              const questionIndexById = new Map<string, number>(
                formattedQuestions.map((question, index) => [question.id, index]),
              );

              persistedAnswers.forEach((answer) => {
                const questionIndex = questionIndexById.get(answer.question_id);
                if (questionIndex == null) {
                  return;
                }

                const question = formattedQuestions[questionIndex];

                if (question.format === 'multiple_choice' && answer.selected_option_id) {
                  const optionIndex = question.options?.findIndex(
                    (option) => option.id === answer.selected_option_id,
                  );
                  if (optionIndex != null && optionIndex >= 0) {
                    restoredAnswers[questionIndex] = optionIndex;
                    restoredRecords[question.id] = { id: answer.id, value: answer.selected_option_id };
                  }
                } else if (answer.user_answer_text) {
                  restoredAnswers[questionIndex] = answer.user_answer_text;
                  restoredRecords[question.id] = { id: answer.id, value: answer.user_answer_text };
                }
              });

              if (Object.keys(restoredRecords).length > 0) {
                setAnswerRecords((prev) => ({ ...prev, ...restoredRecords }));
              }

              if (Object.keys(restoredAnswers).length > 0) {
                setUserAnswers((prev) => ({ ...prev, ...restoredAnswers }));
                const firstIncompleteIndex = formattedQuestions.findIndex((_, index) => {
                  const value = restoredAnswers[index];
                  if (typeof value === 'number') {
                    return false;
                  }
                  if (typeof value === 'string') {
                    return value.trim().length === 0;
                  }
                  return true;
                });

                if (firstIncompleteIndex >= 0) {
                  setCurrentQuestionIndex(firstIncompleteIndex);
                }
              }
            }
          } catch (answerError) {
            console.error('Failed to restore answers for attempt:', answerError);
          }
        }

        if (formattedQuestions.length === 0) {
          setError(t('assessmentScreen.noQuestions'));
        }

        setAssessment({
          id: assessmentData.id,
          title: assessmentData.title,
          description: assessmentData.description ?? null,
          duration: assessmentData.duration ?? 0,
          questions: formattedQuestions,
        });

        setTimeLeft(assessmentData.duration ?? 0);
      } catch (err) {
        setError(t('assessmentScreen.errorFetching'));
        console.error('Error fetching assessment data:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [activeAttempt, role, t]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
            question.options?.map((option, index) => (
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
                  }`}
                  onClick={() => handleOptionSelect(index)}
                >
                  <span className="flex-1 text-left text-sm">{option.text}</span>
                </div>
              </motion.div>
            ))
          ) : (
            <Textarea
              placeholder={t('assessmentScreen.typeYourAnswer')}
              value={typeof userAnswers[currentQuestionIndex] === 'string' ? (userAnswers[currentQuestionIndex] as string) : ''}
              onChange={(e) => saveAnswer(currentQuestionIndex, e.target.value)}
              onBlur={() => void ensureAnswerPersisted(currentQuestionIndex)}
              className="min-h-[150px] p-4 border-2 rounded-2xl focus:border-blue-500 focus:ring-blue-500 transition-all duration-300"
            />
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center p-8">Äang táº£i bÃ i Ä‘Ã¡nh giÃ¡...</div>;
  }
  
  if (!assessment) {
    return <div className="text-center p-8 text-red-500">Không có bài đánh giá nào cho vai trò này.</div>;
  }

  if (!activeAttempt) {
    return (
      <div className="text-center p-8 space-y-4">
        <p className="text-muted-foreground">Không tìm thấy phiên làm bài hợp lệ. Vui lòng quay lại bước trước để bắt đầu lại.</p>
        <Button onClick={() => window.history.back()} className="apple-button">Quay lại</Button>
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
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <div className="flex justify-between items-center mb-4">
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
                <Clock className="w-5 h-5" />
                <span>{formatTime(timeLeft)}</span>
              </motion.div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
              <span>CÃ¢u {currentQuestionIndex + 1}/{questions.length}</span>
              <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
            </div>
          </motion.div>

          {/* Question Card */}
          <motion.div
            className="bg-white rounded-3xl shadow-xl p-8"
          >
            {renderQuestion()}
          </motion.div>
        </div>
      </div>

      {/* Fixed Navigation */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky bottom-0 bg-white shadow-lg border-t"
      >
        <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <Button
            onClick={() => void navigateQuestion(-1)}
            disabled={currentQuestionIndex === 0 || isFinishing}
            variant="outline"
            className="flex items-center gap-2 px-6 py-3 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('assessmentScreen.previousBtn')}</span>
          </Button>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button
              onClick={() => void finishAssessment()}
              disabled={!hasAnsweredCurrent || isFinishing}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                hasAnsweredCurrent && !isFinishing
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                  : 'bg-gray-300'
              }`}
            >
              <span>{isFinishing ? 'Đang gửi kết quả...' : t('assessmentScreen.finishBtn')}</span>
              <CheckCircle className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={() => void navigateQuestion(1)}
              disabled={!hasAnsweredCurrent || isFinishing}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                hasAnsweredCurrent && !isFinishing
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  : 'bg-gray-300'
              }`}
            >
              <span>{t('assessmentScreen.nextBtn')}</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          )}
        </div>
      </motion.div>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#EA3323">
                <path d="m40-120 440-760 440 760H40Zm115.33-66.67h649.34L480-746.67l-324.67 560ZM482.78-238q14.22 0 23.72-9.62 9.5-9.61 9.5-23.83 0-14.22-9.62-23.72-9.5-14.22 0-23.72 9.62-9.62 9.5 23.83 0 14.22 9.62 23.72 9.62 9.5 23.83 9.5Zm-33.45-114H516v-216h-66.67v216ZM480-466.67Z"/>
              </svg>
              <AlertDialogTitle>Cáº£nh bÃ¡o Gian láº­n!</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Báº¡n Ä‘Ã£ chuyá»ƒn tab trong khi lÃ m bÃ i. BÃ i kiá»ƒm tra cá»§a báº¡n sáº½ bá»‹ há»§y náº¿u báº¡n vi pháº¡m thÃªm {3 - tabViolations} láº§n ná»¯a.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsAlertOpen(false)}>Quay láº¡i bÃ i lÃ m</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AssessmentScreen;






















