import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AssessmentAttempt, AssessmentResult, AssessmentSkillScore, Role } from '@/types/assessment';

interface AssessmentState {
  selectedRole: Role | null;
  assessmentResult: AssessmentResult | null;
  activeAttempt: AssessmentAttempt | null;
}

interface AssessmentContextValue extends AssessmentState {
  isHydrated: boolean;
  setSelectedRole: (role: Role | null) => void;
  setAssessmentResult: (result: AssessmentResult | null) => void;
  setActiveAttempt: (attempt: AssessmentAttempt | null) => void;
  updateActiveAttempt: (update: Partial<AssessmentAttempt>) => void;
  resetAssessment: () => void;
}

const STORAGE_KEY = 'hr-assessment-state';

const normaliseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const normaliseSkillScores = (value: unknown): AssessmentSkillScore[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }
      const record = entry as { name?: unknown; score?: unknown };
      if (typeof record.name !== 'string') {
        return null;
      }
      const score = typeof record.score === 'number' && Number.isFinite(record.score)
        ? record.score
        : typeof record.score === 'string'
          ? Number.parseFloat(record.score)
          : null;
      if (score === null || Number.isNaN(score)) {
        return null;
      }
      const name = record.name.trim();
      if (!name) {
        return null;
      }
      return { name, score };
    })
    .filter((entry): entry is AssessmentSkillScore => entry !== null);
};

const hydrateAssessmentResult = (value: unknown): AssessmentResult | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawScore = record.score;
  let score: number | null = null;
  if (typeof rawScore === 'number' && Number.isFinite(rawScore)) {
    score = rawScore;
  } else if (typeof rawScore === 'string') {
    const parsed = Number.parseFloat(rawScore);
    score = Number.isFinite(parsed) ? parsed : null;
  }

  const summary = typeof record.summary === 'string' ? record.summary : null;
  const completedAt = typeof record.completedAt === 'string' ? record.completedAt : null;

  return {
    score,
    summary,
    strengths: normaliseStringArray(record.strengths),
    developmentAreas: normaliseStringArray(record.developmentAreas ?? record.weaknesses),
    skillScores: normaliseSkillScores(record.skillScores),
    recommendedRoles: normaliseStringArray(record.recommendedRoles),
    developmentSuggestions: normaliseStringArray(record.developmentSuggestions),
    completedAt,
  };
};

const initialState: AssessmentState = {
  selectedRole: null,
  assessmentResult: null,
  activeAttempt: null,
};

const AssessmentContext = createContext<AssessmentContextValue | undefined>(undefined);

export const AssessmentProvider = ({ children }: PropsWithChildren<unknown>) => {
  const [state, setState] = useState<AssessmentState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AssessmentState;
        setState({
          selectedRole: parsed.selectedRole ?? null,
          assessmentResult: hydrateAssessmentResult(parsed.assessmentResult) ?? null,
          activeAttempt: parsed.activeAttempt ?? null,
        });
      }
    } catch (error) {
      console.error('Failed to restore assessment state from sessionStorage:', error);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to persist assessment state:', error);
    }
  }, [state, isHydrated]);

  const setSelectedRole = useCallback((role: Role | null) => {
    setState((prev) => ({
      ...prev,
      selectedRole: role,
      assessmentResult: role ? prev.assessmentResult : null,
      activeAttempt: role ? prev.activeAttempt : null,
    }));
  }, []);

  const setAssessmentResult = useCallback((result: AssessmentResult | null) => {
    setState((prev) => ({
      ...prev,
      assessmentResult: result,
    }));
  }, []);

  const setActiveAttempt = useCallback((attempt: AssessmentAttempt | null) => {
    setState((prev) => ({
      ...prev,
      activeAttempt: attempt,
    }));
  }, []);

  const updateActiveAttempt = useCallback((update: Partial<AssessmentAttempt>) => {
    setState((prev) => {
      if (!prev.activeAttempt) {
        return prev;
      }
      return {
        ...prev,
        activeAttempt: {
          ...prev.activeAttempt,
          ...update,
        },
      };
    });
  }, []);

  const resetAssessment = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isHydrated,
      setSelectedRole,
      setAssessmentResult,
      setActiveAttempt,
      updateActiveAttempt,
      resetAssessment,
    }),
    [state, isHydrated, setSelectedRole, setAssessmentResult, setActiveAttempt, updateActiveAttempt, resetAssessment],
  );

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
};

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};

