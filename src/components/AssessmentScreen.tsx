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
import { Role, UserAnswers, Question, AnswerValue, Assessment, AssessmentResult } from '../types/assessment';
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
  const [answerRecords, setAnswerRecords] = useState<Record<string, { id: string; value: string; timeSpentSeconds?: number | null }>>({});

  // Refs for tracking question timing
  const questionTimeSpentRef = useRef<Record<string, number>>({});
  const questionStartTimeRef = useRef<number | null>(null);
  const activeQuestionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Component mounted
  }, [activeAttempt, role]);

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = userAnswers[currentQuestionIndex];
  const hasAnsweredCurrent = currentQuestion?.format === 'multiple_choice'
    ? (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : typeof currentAnswer !== 'undefined')
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
        // Early return - no question or attempt
        return;
      }

      const rawValue =
        typeof options?.overrideRawValue !== 'undefined'
          ? options.overrideRawValue
          : userAnswers[questionIndex];

      // Processing answer persistence

      if (
        typeof rawValue === 'undefined' ||
        rawValue === null ||
        (question.format !== 'multiple_choice' &&
          typeof rawValue === 'string' &&
          rawValue.trim() === '')
      ) {
        // Early return - empty value
        return;
      }

      let selectedOptionId: string | null = null;
      let userAnswerText: string | null = null;
      let persistedValue = '';

      if (question.format === 'multiple_choice') {
        // Handle both single selection (number) and multi-selection (number[])
        if (Array.isArray(rawValue)) {
          // Multi-selection: store as comma-separated option IDs
          const selectedIds = rawValue
            .map(idx => question.options?.[idx]?.id)
            .filter(Boolean);
          if (selectedIds.length === 0) {
            return;
          }
          persistedValue = selectedIds.join(',');
          userAnswerText = selectedIds.join(',');
        } else {
          // Single selection (backward compatibility)
          const optionIndex = Number(rawValue);
          const selectedOption = question.options?.[optionIndex];
          if (!selectedOption) {
            return;
          }
          selectedOptionId = selectedOption.id;
          persistedValue = selectedOptionId;
        }
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
        // Failed to persist answer
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
        const rawValue = userAnswers[index];

        // Persisting all answers

        return ensureAnswerPersisted(index, {
          overrideRawValue: rawValue, // Explicitly pass the value
          timeSpentSeconds: typeof timeSpent === 'number' ? timeSpent : undefined,
        });
      }),
    );
  }, [activeAttempt, ensureAnswerPersisted, getTimeSpentForQuestion, questions, userAnswers]);

  const persistCheatingCount = useCallback(
    async (count: number) => {
      if (!activeAttempt) {
        return;
      }

      if (activeAttempt.cheatingCount === count) {
        return;
      }

      try {
        await updateAssessmentAttemptMeta(activeAttempt.id, { cheating_count: count });
        updateActiveAttempt({ cheatingCount: count });
      } catch (error) {
        // Failed to update cheating count
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

    if (!user || !assessment) {
      throw new Error('Khong the phan tich bai lam do thieu du lieu.');
    }

    console.log('[runAiAnalysis] Calling finaliseAssessmentAttempt with payload:', payload);
    const result = await finaliseAssessmentAttempt(payload);
    console.log('[runAiAnalysis] Finalize result:', result);
    finalisePayloadRef.current = null;

    updateActiveAttempt(result.attempt);

    if (!isMountedRef.current) {
      return;
    }

    // Handle different AI statuses appropriately
    if (result.aiStatus === 'completed') {
      // AI processing completed successfully
      try {
        const latest = await getLatestResult(user.id, assessment.id);

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
        } else if (result.result) {
          setAssessmentResult(result.result);
        } else {
          console.warn('[runAiAnalysis] AI status completed but no result found in response or DB.');
        }
      } catch (error) {
        // Failed to refresh latest assessment result
        if (isMountedRef.current) {
          if (result.result) {
            setAssessmentResult(result.result);
          } else {
            console.error('[runAiAnalysis] Failed to fetch latest result and no result in response:', error);
          }
        }
      }

      if (isMountedRef.current) {
        onFinish(); // Only navigate when AI is truly completed
      }
    } else if (result.aiStatus === 'processing') {
      // AI is currently processing, show loading state but don't navigate yet
      console.log('[runAiAnalysis] AI is processing, waiting for completion...');
      // Don't call onFinish, keep user on assessment screen
      // Could show a processing indicator here
    } else if (result.aiStatus === 'failed') {
      // AI processing failed, show error but don't navigate
      console.error('[runAiAnalysis] AI processing failed:', result.attempt.lastAiError);
      // Don't call onFinish, keep user on assessment screen
      // Could show error state here
    } else {
      // Fallback for any other status
      console.warn('[runAiAnalysis] Unexpected AI status:', result.aiStatus);
      if (isMountedRef.current) {
        onFinish();
      }
    }
  }, [onFinish, setAssessmentResult, updateActiveAttempt, user, assessment]);

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
      // Failed to retry AI analysis

      // Check if this is a GeminiApiError with retry information
      const isGeminiError = error instanceof GeminiApiError;
      const retryCount = isGeminiError && error.payload && typeof error.payload === 'object'
        ? (error.payload as { retryCount?: number }).retryCount
        : 0;

      // Update attempt status to indicate AI failure
      updateActiveAttempt({
        aiStatus: 'failed',
        lastAiError: error instanceof Error ? error.message : null,
      });

      // If we've exhausted retries (3 attempts), redirect to results screen
      if (retryCount >= 3) {
        // Retry limit reached in retry, redirecting to results screen

        // Create a partial result without AI analysis
        const partialResult: AssessmentResult = {
          summary: null,
          strengths: [],
          developmentAreas: [],
          skillScores: [],
          recommendedRoles: [],
          developmentSuggestions: [],
          completedAt: new Date().toISOString(),
          hrApprovalStatus: 'pending',
          teamFit: null,
          aiAnalysisAvailable: false,
        };

        setAssessmentResult(partialResult);

        if (isMountedRef.current) {
          setIsFinalising(false);
          onFinish(); // Navigate to results screen
        }
      } else {
        // Show error dialog for retry
        if (isMountedRef.current) {
          setSubmissionError(getAiErrorMessage(error));
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsFinalising(false);
      }
    }
  }, [getAiErrorMessage, runAiAnalysis, updateActiveAttempt, setAssessmentResult, onFinish]);


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
    isFinalising,
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
      isFinalising,
    };
  }, [
    currentQuestionIndex,
    userAnswers,
    timeLeft,
    questionTimings,
    totalStartTime,
    currentQuestionStartTime,
    tabViolations,
    isFinalising,
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
    // finishAssessment called
    if (!activeAttempt || !assessment || !assessment.id || !user) {
      // Missing required data for finishAssessment, redirecting to RoleSelection
      navigate('/role-selection');
      return;
    }

    // Update timing for the last question
    updateQuestionTiming();

    // Ensure current question's answer is persisted with latest value
    // This handles the case where user types but doesn't blur before clicking Finish
    const currentAnswer = userAnswers[currentQuestionIndex];
    if (currentAnswer !== undefined && currentAnswer !== null) {
      // Persisting current question answer
      await ensureAnswerPersisted(currentQuestionIndex, { overrideRawValue: currentAnswer });
    }

    await persistAllAnswers();
    await persistCheatingCount(tabViolations);

    const totalDurationSeconds = Math.max(0, Math.round(calculateTotalDuration()));
    const totalQuestions = questions.length || activeAttempt.totalQuestions || 0;

    if (isMountedRef.current) {
      setSubmissionError(null);
      setIsFinalising(true);
    }

    const averageSecondsPerQuestion =
      totalQuestions > 0 ? totalDurationSeconds / totalQuestions : null;

    try {
      const updatedAttempt = await submitAssessmentAttempt(activeAttempt.id, {
        durationSeconds: totalDurationSeconds,
        averageSecondsPerQuestion,
        cheatingCount: tabViolations,
      });
      updateActiveAttempt(updatedAttempt);

      const now = Date.now();
      const durationSeconds = Math.floor((now - totalStartTime) / 1000);

      // Build answers snapshot from userAnswers
      const answersSnapshot = questions.map((question, index) => {
        const rawValue = userAnswers[index];
        let userAnswer: string | null = null;
        let selectedOptionIndex: number | null = null;

        if (question.format === 'multiple_choice') {
          if (Array.isArray(rawValue)) {
            // Multi-selection
            selectedOptionIndex = null; // Not applicable for multi-select
            const selectedTexts = rawValue.map(idx => {
              const option = question.options?.[idx];
              return option?.text || option?.optionText || '';
            }).filter(Boolean);
            userAnswer = selectedTexts.join(', ');
          } else if (typeof rawValue === 'number') {
            // Single selection (backward compatibility)
            selectedOptionIndex = rawValue;
            const option = question.options?.[rawValue];
            userAnswer = option?.text || option?.optionText || null;
          }
        } else {
          userAnswer = typeof rawValue === 'string' ? rawValue : null;
        }

        return {
          questionNumber: index + 1,
          questionId: question.id,
          questionText: question.text,
          questionFormat: question.format,
          userAnswer,
          selectedOptionIndex,
          allOptions: (question.options || []).map(opt => opt.text || opt.optionText || ''),
          correctAnswer: question.correctAnswer || null,
          isCorrect: null,
          answeredAt: new Date().toISOString(),
        };
      });

      console.log('[handleSubmit] Built answersSnapshot:', answersSnapshot.length, 'answers');

      finalisePayloadRef.current = {
        attemptId: updatedAttempt.id,
        durationSeconds,
        answersSnapshot,
      } satisfies FinaliseAssessmentOptions;

      // finalisePayloadRef.current set

      await runAiAnalysis();
    } catch (error) {
      // Failed to finalise assessment attempt

      // Check if this is a GeminiApiError with retry information
      const isGeminiError = error instanceof GeminiApiError;
      const retryCount = isGeminiError && error.payload && typeof error.payload === 'object'
        ? (error.payload as { retryCount?: number }).retryCount
        : 0;

      // Update attempt status to indicate AI failure
      updateActiveAttempt({
        aiStatus: 'failed',
        lastAiError: error instanceof Error ? error.message : null,
      });

      // If we've exhausted retries (3 attempts), redirect to results screen
      // with a partial result (no AI analysis)
      if (retryCount >= 3) {
        // Retry limit reached, redirecting to results screen

        // Create a partial result without AI analysis
        const partialResult: AssessmentResult = {
          summary: null,
          strengths: [],
          developmentAreas: [],
          skillScores: [],
          recommendedRoles: [],
          developmentSuggestions: [],
          completedAt: new Date().toISOString(),
          hrApprovalStatus: 'pending',
          teamFit: null,
          aiAnalysisAvailable: false,
        };

        setAssessmentResult(partialResult);

        if (isMountedRef.current) {
          setIsFinalising(false);
          onFinish(); // Navigate to results screen
        }
      } else {
        // Show error dialog for retry
        if (isMountedRef.current) {
          setSubmissionError(getAiErrorMessage(error));
        }
      }
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
    setAssessmentResult,
  ]);


  // Restore state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('assessmentState');
    // Checking for saved state on mount
    if (savedState && !hasStoredState) {
      // Wait for activeAttempt to be resolved before restoring state
      if (!activeAttempt) {
        // Waiting for activeAttempt before restoring state...
        return;
      }

      try {
        const parsedState = JSON.parse(savedState);
        // Restoring state

        if (parsedState.roleName && parsedState.roleName !== role.name) {
          sessionStorage.removeItem('assessmentState');
          return;
        }

        if (activeAttempt && parsedState.attemptId && parsedState.attemptId !== activeAttempt.id) {
          // Saved state belongs to different attempt, ignoring.
          sessionStorage.removeItem('assessmentState');
          return;
        }

        // currentQuestionIndex is now handled by URL

        // Calculate the time spent while away and adjust currentQuestionStartTime
        if (parsedState.currentQuestionStartTime) {
          const timeAway = Date.now() - parsedState.currentQuestionStartTime;
          setCurrentQuestionStartTime(Date.now() - timeAway);
        }
      } catch (error) {
        // Failed to restore assessment state
      }
    }
  }, [hasStoredState, activeAttempt, role.name]);

  // Tab change detection and state persistence
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Don't track tab violations when finalising (AI is processing)
      // Use stateRef to get the current value of isFinalising
      if (document.hidden && !stateRef.current.isFinalising) {
        // Tab hidden detected

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
      } else if (document.hidden && stateRef.current.isFinalising) {
        // Tab hidden during AI processing - not counting as violation
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
      // Tab violations exceeded limit, finishing assessment
      void finishAssessment();
    }
  }, [tabViolations, isFinalising, finishAssessment, assessment]);

  // Timer logic
  useEffect(() => {
    if (timeLeft <= 0 && timeLeft !== 0) {
      // Timer expired, finishing assessment
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
    // handleOptionSelect called - toggle selection
    setUserAnswers(prev => {
      const currentSelections = prev[currentQuestionIndex];
      let newSelections: number[];

      if (Array.isArray(currentSelections)) {
        // Already an array - toggle the option
        if (currentSelections.includes(optionIndex)) {
          // Remove from selection
          newSelections = currentSelections.filter(idx => idx !== optionIndex);
        } else {
          // Add to selection
          newSelections = [...currentSelections, optionIndex].sort((a, b) => a - b);
        }
      } else if (typeof currentSelections === 'number') {
        // Convert single selection to array and toggle
        if (currentSelections === optionIndex) {
          newSelections = [];
        } else {
          newSelections = [currentSelections, optionIndex].sort((a, b) => a - b);
        }
      } else {
        // No previous selection - start with this option
        newSelections = [optionIndex];
      }

      return {
        ...prev,
        [currentQuestionIndex]: newSelections
      };
    });
  };

  // Save state to sessionStorage whenever important state changes
  useEffect(() => {
    if (isFinalising) return;

    const stateToSave = {
      currentQuestionIndex,
      userAnswers,
      timeLeft,
      questionTimings,
      totalStartTime,
      currentQuestionStartTime,
      tabViolations,
      roleName: role.name,
      attemptId: activeAttempt?.id,
    };
    sessionStorage.setItem('assessmentState', JSON.stringify(stateToSave));
  }, [
    currentQuestionIndex,
    userAnswers,
    timeLeft,
    questionTimings,
    totalStartTime,
    currentQuestionStartTime,
    tabViolations,
    role.name,
    activeAttempt?.id,
    isFinalising
  ]);

  const navigateQuestion = useCallback(
    async (direction: number) => {
      updateQuestionTiming();

      // Persist current question's answer before navigating
      const currentAnswer = userAnswers[currentQuestionIndex];
      // Persisting current answer

      await ensureAnswerPersisted(currentQuestionIndex, {
        overrideRawValue: currentAnswer,
      });

      // Explicitly save state before navigation (redundant but safe)
      const stateToSave = {
        currentQuestionIndex,
        userAnswers,
        timeLeft,
        questionTimings,
        totalStartTime,
        currentQuestionStartTime,
        tabViolations,
        roleName: role.name,
        attemptId: activeAttempt?.id,
      };
      sessionStorage.setItem('assessmentState', JSON.stringify(stateToSave));

      const newIndex = currentQuestionIndex + direction;
      if (newIndex >= 0 && newIndex < questions.length) {
        navigate(`/assessment/${role.name}/q/${newIndex + 1}`);
      }
    },
    [
      currentQuestionIndex,
      questions.length,
      ensureAnswerPersisted,
      updateQuestionTiming,
      navigate,
      role.name,
      userAnswers,
      timeLeft,
      questionTimings,
      totalStartTime,
      currentQuestionStartTime,
      tabViolations,
      activeAttempt?.id
    ],
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
        // Error fetching assessment data
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
        // Failed to restore assessment state
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

    // Rendering question

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
                    className={`relative flex items-center gap-4 p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 font-medium text-lg min-h-[70px]
                    ${(() => {
                        const currentSelections = userAnswers[currentQuestionIndex];
                        const isSelected = Array.isArray(currentSelections)
                          ? currentSelections.includes(index)
                          : currentSelections === index;
                        return isSelected
                          ? 'bg-blue-100 border-blue-500 text-blue-800 shadow-lg shadow-blue-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md';
                      })()} ${isFinalising ? 'pointer-events-none opacity-60' : ''}`}
                    onClick={() => {
                      if (!isFinalising) {
                        handleOptionSelect(index);
                      }
                    }}
                    aria-disabled={isFinalising}
                    data-disabled={isFinalising ? 'true' : undefined}
                  >
                    {/* Checkbox indicator */}
                    <div className={`flex-shrink-0 w-6 h-6 rounded border-2 transition-all duration-200 flex items-center justify-center
                      ${(() => {
                        const currentSelections = userAnswers[currentQuestionIndex];
                        const isSelected = Array.isArray(currentSelections)
                          ? currentSelections.includes(index)
                          : currentSelections === index;
                        return isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-300';
                      })()}`}
                    >
                      {(() => {
                        const currentSelections = userAnswers[currentQuestionIndex];
                        const isSelected = Array.isArray(currentSelections)
                          ? currentSelections.includes(index)
                          : currentSelections === index;
                        return isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        );
                      })()}
                    </div>
                    <span className="flex-1 text-left text-sm">{option.text || option.optionText || ''}</span>
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
                  const newValue = event.target.value;
                  // Textarea onChange
                  setUserAnswers(prev => {
                    const updated = {
                      ...prev,
                      [currentQuestionIndex]: newValue
                    };
                    // Updated userAnswers
                    return updated;
                  });

                  // Auto-persist after typing (debounced by ensureAnswerPersisted logic)
                  void ensureAnswerPersisted(currentQuestionIndex, { overrideRawValue: newValue });
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
