// src/components/AssessmentScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  updateAssessmentAttemptMeta,
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
  questionIndexParam?: number;
  onFinish: () => void;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ role, questionIndexParam, onFinish }) => {
  const navigate = useNavigate();
  const { activeAttempt, updateActiveAttempt, setAssessmentResult } = useAssessment();
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Derive index from URL param (1-based) or default to 0
  const currentQuestionIndex = (questionIndexParam ? questionIndexParam : 1) - 1;

  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [answerRecords, setAnswerRecords] = useState<Record<string, { id: string; value: string }>>({});

  useEffect(() => {
    console.log('[AssessmentScreen] Mounted. activeAttempt:', activeAttempt?.id, 'role:', role.name);
  }, [activeAttempt, role]);

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = userAnswers[currentQuestionIndex];
  const hasAnsweredCurrent = currentQuestion?.format === 'multiple_choice'
    ? typeof currentAnswer !== 'undefined'
    : typeof currentAnswer === 'string' && currentAnswer.trim().length > 0;
  const [tabViolations, setTabViolations] = useState(0);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasTimerStarted, setHasTimerStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [isFinalising, setIsFinalising] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const finalisePayloadRef = useRef<FinaliseAssessmentOptions | null>(null);
  const isMountedRef = useRef(true);
  const [hasStoredState, setHasStoredState] = useState(false);
  
  // Cheating detection state
  interface CheatingEvent {
    type: 'tab_switch' | 'copy_paste';
    questionId: string;
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }
  const [cheatingEvents, setCheatingEvents] = useState<CheatingEvent[]>([]);

  const ensureAnswerPersisted = useCallback(
    async (
      questionIndex: number,
      options?: { overrideRawValue?: AnswerValue; timeSpentSeconds?: number | null },
    ) => {
      const question = questions[questionIndex];
      if (!question || !activeAttempt) {
        return;
      }

      const rawValue =
        typeof options?.overrideRawValue !== 'undefined'
          ? options.overrideRawValue
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

      const storedTime = questionTimeSpentRef.current[question.id];
      const timeSpentOverride =
        typeof options?.timeSpentSeconds === 'number'
          ? options.timeSpentSeconds
          : typeof storedTime === 'number'
            ? storedTime
            : null;
      const normalisedTimeSpent =
        typeof timeSpentOverride === 'number'
          ? Math.max(0, Math.round(timeSpentOverride))
          : null;

      const existingRecord = answerRecords[question.id];
      const shouldUpdateTime =
        typeof normalisedTimeSpent === 'number' &&
        normalisedTimeSpent !== (existingRecord?.timeSpentSeconds ?? null);

      if (existingRecord && existingRecord.value === persistedValue && !shouldUpdateTime) {
        return;
      }

      try {
        const result = await upsertAnswer({
          id: existingRecord?.id,
          attemptId: activeAttempt.id,
          questionId: question.id,
          selectedOptionId,
          userAnswerText,
          timeSpentSeconds:
            typeof normalisedTimeSpent === 'number' ? normalisedTimeSpent : undefined,
        });

        if (result?.id) {
          setAnswerRecords((prev) => ({
            ...prev,
            [question.id]: {
              id: result.id,
              value: persistedValue,
              timeSpentSeconds:
                typeof result.time_spent_seconds === 'number'
                  ? result.time_spent_seconds
                  : typeof normalisedTimeSpent === 'number'
                    ? normalisedTimeSpent
                    : existingRecord?.timeSpentSeconds ?? null,
            },
          }));
          updateActiveAttempt({ lastActivityAt: new Date().toISOString() });
        }
      } catch (error) {
        console.error('Failed to persist answer for question', question.id, error);
      }
    },
    [activeAttempt, answerRecords, questions, updateActiveAttempt, userAnswers],
  );
  const getTimeSpentForQuestion = useCallback(
    (questionIndex: number): number | null => {
      const question = questions[questionIndex];
      if (!question) {
        return null;
      }
      const stored = questionTimeSpentRef.current[question.id];
      return typeof stored === 'number' ? stored : null;
    },
    [questions],
  );

  const accumulateTimeForQuestion = useCallback(
    (questionIndex: number): number | null => {
      const question = questions[questionIndex];
      if (!question) {
        return null;
      }

      const startTimestamp = questionStartTimeRef.current;
      if (typeof startTimestamp !== 'number') {
        return getTimeSpentForQuestion(questionIndex);
      }

      const elapsedSeconds = Math.max(0, Math.round((Date.now() - startTimestamp) / 1000));
      const previousTotal = questionTimeSpentRef.current[question.id] ?? 0;
      const newTotal = previousTotal + elapsedSeconds;
      questionTimeSpentRef.current[question.id] = newTotal;
      questionStartTimeRef.current = null;
      return newTotal;
    },
    [getTimeSpentForQuestion, questions],
  );

  const calculateTotalDuration = useCallback(() => {
    return Object.values(questionTimeSpentRef.current).reduce((sum, value) => {
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  }, []);

  const persistAllAnswers = useCallback(async () => {
    if (!activeAttempt) {
      return;
    }

    await Promise.all(
      questions.map((_, index) => {
        const timeSpent = getTimeSpentForQuestion(index);
        return ensureAnswerPersisted(index, {
          timeSpentSeconds: typeof timeSpent === 'number' ? timeSpent : undefined,
        });
      }),
    );
  }, [activeAttempt, ensureAnswerPersisted, getTimeSpentForQuestion, questions]);

  const persistCheatingCount = useCallback(
    async (count: number) => {
      if (!activeAttempt) {
        return;
      }

      if (activeAttempt.cheatingCount === count) {
        return;
      }

      try {
        await updateAssessmentAttemptMeta(activeAttempt.id, { cheatingCount: count });
        updateActiveAttempt({ cheatingCount: count });
      } catch (error) {
        console.error('Failed to update cheating count for attempt', activeAttempt.id, error);
      }
    },
    [activeAttempt, updateActiveAttempt],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      finalisePayloadRef.current = null;
    };
  }, []);

  useEffect(() => {
    setTabViolations(activeAttempt?.cheatingCount ?? 0);
  }, [activeAttempt?.cheatingCount]);

  useEffect(() => {
    setHasTimerStarted(false);
  }, [activeAttempt?.id]);

  useEffect(() => {
    questionTimeSpentRef.current = {};
    questionStartTimeRef.current = null;
    activeQuestionIdRef.current = null;
  }, [activeAttempt?.id]);

  useEffect(() => {
    const question = questions[currentQuestionIndex];
    if (!question) {
      activeQuestionIdRef.current = null;
      questionStartTimeRef.current = null;
      return;
    }

    if (activeQuestionIdRef.current !== question.id) {
      activeQuestionIdRef.current = question.id;
      questionStartTimeRef.current = Date.now();
    } else if (questionStartTimeRef.current === null) {
      questionStartTimeRef.current = Date.now();
    }
  }, [currentQuestionIndex, questions]);

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
      const latest = await getLatestResult(payload.userId, payload.assessmentId);

      if (!isMountedRef.current) {
        return;
      }

      if (latest) {
        setAssessmentResult({
          summary: latest.summary,
          strengths: latest.strengths,
          developmentAreas: latest.developmentAreas,
          skillScores: latest.skillScores,
          recommendedRoles: latest.recommendedRoles,
          developmentSuggestions: latest.developmentSuggestions,
          completedAt: latest.completedAt ?? latest.createdAt,
          hrApprovalStatus: latest.hrApprovalStatus,
          teamFit: latest.teamFit,
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


  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>({});
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<number>(Date.now());
  const [totalStartTime] = useState<number>(Date.now());

  // Ref to hold the latest state for event handlers
  const stateRef = useRef({
    currentQuestionIndex,
    userAnswers,
    timeLeft,
    questionTimings,
    totalStartTime,
    currentQuestionStartTime,
    tabViolations,
  });

  // Update stateRef whenever state changes
  useEffect(() => {
    stateRef.current = {
      currentQuestionIndex,
      userAnswers,
      timeLeft,
      questionTimings,
      totalStartTime,
      currentQuestionStartTime,
      tabViolations,
    };
  }, [
    currentQuestionIndex,
    userAnswers,
    timeLeft,
    questionTimings,
    totalStartTime,
    currentQuestionStartTime,
    tabViolations,
  ]);

  // Track time for current question when switching questions or finishing
  const updateQuestionTiming = useCallback(() => {
    const now = Date.now();
    const timeSpent = (now - currentQuestionStartTime) / 1000; // seconds
    const questionId = questions[currentQuestionIndex]?.id;

    if (questionId) {
      setQuestionTimings((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || 0) + timeSpent,
      }));
    }
    setCurrentQuestionStartTime(now);
  }, [currentQuestionIndex, currentQuestionStartTime, questions]);

  // Update timing when question changes
  useEffect(() => {
    setCurrentQuestionStartTime(Date.now());
  }, [currentQuestionIndex]);

  const finishAssessment = useCallback(async () => {
    console.log('[AssessmentScreen] finishAssessment called. activeAttempt:', !!activeAttempt, 'assessment:', !!assessment);
    if (!activeAttempt || !assessment || !assessment.id || !user) {
      console.warn('[AssessmentScreen] Missing required data for finishAssessment, redirecting to RoleSelection');
      navigate('/role-selection');
      return;
    }

    // Update timing for the last question
    updateQuestionTiming();

    await persistAllAnswers();
    await persistCheatingCount(tabViolations);

    const totalDurationSeconds = Math.max(0, Math.round(calculateTotalDuration()));
    const totalQuestions = questions.length || activeAttempt.totalQuestions || 0;
    const averageSecondsPerQuestion =
      totalQuestions > 0 ? totalDurationSeconds / totalQuestions : null;

    if (isMountedRef.current) {
      setSubmissionError(null);
      setIsFinalising(true);
    }

    try {
      const updatedAttempt = await submitAssessmentAttempt(activeAttempt.id, {
        durationSeconds: totalDurationSeconds,
        averageSecondsPerQuestion,
        cheatingCount: tabViolations,
      });
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

      // Create detailed answers snapshot for dashboard display
      const answersSnapshot = questions
        .map((question, index) => {
          const rawValue = userAnswers[index];
          if (typeof rawValue === 'undefined' || rawValue === null) {
            return null;
          }

          const allOptions = question.options?.map((option) => option.text ?? option.optionText ?? '') ?? [];

          if (question.format === 'multiple_choice') {
            const optionIndex = Number(rawValue);
            const option = question.options?.[optionIndex];
            if (!option) {
              return null;
            }
            return {
              questionId: question.id,
              questionText: question.text,
              questionFormat: question.format,
              userAnswer: option.text ?? option.optionText ?? '',
              selectedOptionIndex: optionIndex,
              allOptions,
              answeredAt: new Date().toISOString(),
            };
          }

          const textValue = String(rawValue).trim();
          if (!textValue) {
            return null;
          }

          return {
            questionId: question.id,
            questionText: question.text,
            questionFormat: question.format,
            userAnswer: textValue,
            allOptions: [],
            answeredAt: new Date().toISOString(),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const rawName =
        (typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : undefined) ?? user.email ?? null;

      // Calculate final timings
      const now = Date.now();
      // Add the last bit of time for the current question to the record before sending
      const finalQuestionId = questions[currentQuestionIndex]?.id;
      const finalTimeSpent = (now - currentQuestionStartTime) / 1000;
      const finalQuestionTimings = {
        ...questionTimings,
        ...(finalQuestionId ? { [finalQuestionId]: (questionTimings[finalQuestionId] || 0) + finalTimeSpent } : {}),
      };

      const durationSeconds = Math.floor((now - totalStartTime) / 1000);
      const averageSecondsPerQuestion = questions.length > 0 ? durationSeconds / questions.length : 0;

      finalisePayloadRef.current = {
        attemptId: updatedAttempt.id,
        assessmentId: assessment.id,
        userId: user.id,
        role: role.name,
        candidateName: rawName ? rawName.trim() : null,
        language: lang,
        answers: answersForGemini,
        answersSnapshot,
        questionTimings: finalQuestionTimings,
        durationSeconds,
        averageSecondsPerQuestion,
        cheatingCount: cheatingEvents.length,
        cheatingEvents: cheatingEvents.map(event => ({
          type: event.type,
          questionId: event.questionId,
          occurredAt: event.occurredAt,
          metadata: event.metadata,
        })),
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
    accumulateTimeForQuestion,
    calculateTotalDuration,
    currentQuestionIndex,
    ensureAnswerPersisted,
    persistAllAnswers,
    persistCheatingCount,
    questions,
    role.name,
    runAiAnalysis,
    tabViolations,
    updateActiveAttempt,
    user,
    userAnswers,
    currentQuestionIndex,
    currentQuestionStartTime,
    questionTimings,
    totalStartTime,
    updateQuestionTiming,
  ]);


  // Restore state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('assessmentState');
    console.log('[AssessmentScreen] Checking for saved state on mount:', !!savedState, 'hasStoredState:', hasStoredState);
    if (savedState && !hasStoredState) {
      // Wait for activeAttempt to be resolved before restoring state
      if (!activeAttempt) {
        console.log('[AssessmentScreen] Waiting for activeAttempt before restoring state...');
        return;
      }

      try {
        const parsedState = JSON.parse(savedState);
        console.log('[AssessmentScreen] Restoring state:', parsedState);

        if (parsedState.roleName && parsedState.roleName !== role.name) {
          console.log('[AssessmentScreen] Saved state belongs to different role, ignoring.');
          sessionStorage.removeItem('assessmentState');
          return;
        }

        if (activeAttempt && parsedState.attemptId && parsedState.attemptId !== activeAttempt.id) {
          console.log('[AssessmentScreen] Saved state belongs to different attempt, ignoring.');
          sessionStorage.removeItem('assessmentState');
          return;
        }

        // currentQuestionIndex is now handled by URL
        setUserAnswers(parsedState.userAnswers || {});
        setTimeLeft(parsedState.timeLeft || 0);
        setQuestionTimings(parsedState.questionTimings || {});
        setTabViolations(parsedState.tabViolations || 0);
        setHasStoredState(true);

        // Calculate the time spent while away and adjust currentQuestionStartTime
        if (parsedState.currentQuestionStartTime) {
          const timeAway = Date.now() - parsedState.currentQuestionStartTime;
          setCurrentQuestionStartTime(Date.now() - timeAway);
        }
      } catch (error) {
        console.error('Failed to restore assessment state:', error);
      }
    }
  }, [hasStoredState, activeAttempt, role.name]);

  // Tab change detection and state persistence
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[AssessmentScreen] Tab hidden detected. Violations:', stateRef.current.tabViolations + 1);

        // User switched tabs or minimized window
        setTabViolations((prev) => prev + 1);
        setIsAlertOpen(true);

        // Record cheating event
        const currentQuestion = questions[stateRef.current.currentQuestionIndex];
        if (currentQuestion) {
          setCheatingEvents((prev) => [
            ...prev,
            {
              type: 'tab_switch',
              questionId: currentQuestion.id,
              occurredAt: new Date().toISOString(),
            },
          ]);
        }

        // Save current state to sessionStorage using ref
        const currentState = stateRef.current;
        const stateToSave = {
          ...currentState,
          roleName: role.name, // Add role name to verify ownership
          attemptId: activeAttempt?.id, // Add attempt ID to verify ownership
          currentQuestionStartTime: Date.now(),
          tabViolations: currentState.tabViolations + 1,
        };
        sessionStorage.setItem('assessmentState', JSON.stringify(stateToSave));
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Save state before page unload using ref
      const currentState = stateRef.current;
      sessionStorage.setItem('assessmentState', JSON.stringify(currentState));

      // Show warning if user tries to close/refresh during assessment
      if (!isFinalising) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Clean up event listeners
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isFinalising]);

  // Clean up sessionStorage when assessment is completed
  useEffect(() => {
    if (isFinalising) {
      sessionStorage.removeItem('assessmentState');
    }
  }, [isFinalising]);

  // Enforce tab violation limit
  useEffect(() => {
    if (tabViolations > 3 && !isFinalising && assessment) {
      console.log('[AssessmentScreen] Tab violations exceeded limit, finishing assessment');
      void finishAssessment();
    }
  }, [tabViolations, isFinalising, finishAssessment, assessment]);

  // Timer logic
  useEffect(() => {
    if (timeLeft <= 0 && timeLeft !== 0) {
      console.log('[AssessmentScreen] Timer expired, finishing assessment');
      void finishAssessment();
      return;
    }

    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, finishAssessment]);

  const handleOptionSelect = (optionIndex: number) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: optionIndex
    }));
    void ensureAnswerPersisted(currentQuestionIndex, optionIndex);
  };

  const navigateQuestion = useCallback(
    async (direction: number) => {
      updateQuestionTiming();
      await ensureAnswerPersisted(currentQuestionIndex);
      const newIndex = currentQuestionIndex + direction;
      if (newIndex >= 0 && newIndex < questions.length) {
        navigate(`/assessment/${role.name}/q/${newIndex + 1}`);
      }
    },
    [currentQuestionIndex, questions.length, ensureAnswerPersisted, updateQuestionTiming, navigate, role.name],
  );

  // Fetch assessment data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const assessmentData = await getAssessment(role.name, role.id);
        if (!assessmentData) {
          throw new Error('No assessment data returned');
        }
        setAssessment(assessmentData as unknown as Assessment);

        // Only set timeLeft if we don't have a saved state
        if (!hasStoredState) {
          setTimeLeft(assessmentData.duration * 60);
        }

        if (assessmentData.questions?.length > 0) {
          const formattedQuestions: Question[] = assessmentData.questions.map((q) => {
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
              format: q.format === 'single' ? 'multiple_choice' : q.format,
            } as Question;
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

    // Check for saved state before fetching
    const savedState = sessionStorage.getItem('assessmentState');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        setHasStoredState(true);
        // currentQuestionIndex is now handled by URL
        setUserAnswers(parsedState.userAnswers || {});
        setTimeLeft(parsedState.timeLeft || 0);
        setQuestionTimings(parsedState.questionTimings || {});
        setTabViolations(parsedState.tabViolations || 0);

        // Calculate the time spent while away and adjust currentQuestionStartTime
        const timeAway = Date.now() - parsedState.currentQuestionStartTime;
        setCurrentQuestionStartTime(Date.now() - timeAway);
      } catch (error) {
        console.error('Failed to restore assessment state:', error);
      }
    }

    void fetchData();
  }, [role, t, hasStoredState]);



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
    if (!question) {
      return (
        <div className="text-center p-8">
          <p className="text-red-500 mb-4">{t('assessmentScreen.questionNotFound')}</p>
          <Button onClick={() => navigate(`/assessment/${role.name}/q/1`)}>
            {t('assessmentScreen.backToStart')}
          </Button>
        </div>
      );
    }

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
                  setUserAnswers(prev => ({
                    ...prev,
                    [currentQuestionIndex]: event.target.value
                  }));
                }
              }}
              onPaste={(event) => {
                if (!isFinalising && currentQuestion) {
                  const pastedText = event.clipboardData.getData('text');
                  setCheatingEvents((prev) => [
                    ...prev,
                    {
                      type: 'copy_paste',
                      questionId: currentQuestion.id,
                      occurredAt: new Date().toISOString(),
                      metadata: { pastedLength: pastedText.length },
                    },
                  ]);
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
                    current: String(currentQuestionIndex + 1),
                    total: String(questions.length),
                  })}
                </span>
                <span>{String(Math.round(((currentQuestionIndex + 1) / questions.length) * 100))}%</span>
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
                className={`flex items-center gap-2 rounded-xl px-6 py-3 transition-colors ${hasAnsweredCurrent
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
                className={`flex items-center gap-2 rounded-xl px-6 py-3 transition-colors ${hasAnsweredCurrent
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
                {t('assessmentScreen.tabWarningDescription', { remaining: String(Math.max(0, 3 - tabViolations)) })}
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
