import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Role, AssessmentResult } from '@/types/assessment';

interface AssessmentState {
  selectedRole: Role | null;
  assessmentResult: AssessmentResult | null;
}

interface AssessmentContextValue extends AssessmentState {
  isHydrated: boolean;
  setSelectedRole: (role: Role | null) => void;
  setAssessmentResult: (result: AssessmentResult | null) => void;
  resetAssessment: () => void;
}

const STORAGE_KEY = 'hr-assessment-state';

const initialState: AssessmentState = {
  selectedRole: null,
  assessmentResult: null,
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
          assessmentResult: parsed.assessmentResult ?? null,
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

  const setSelectedRole = (role: Role | null) => {
    setState((prev) => ({
      ...prev,
      selectedRole: role,
      assessmentResult: role ? prev.assessmentResult : null,
    }));
  };

  const setAssessmentResult = (result: AssessmentResult | null) => {
    setState((prev) => ({
      ...prev,
      assessmentResult: result,
    }));
  };

  const resetAssessment = () => {
    setState(initialState);
  };

  const value = useMemo(
    () => ({
      ...state,
      isHydrated,
      setSelectedRole,
      setAssessmentResult,
      resetAssessment,
    }),
    [state, isHydrated],
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
