import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type {
  AssessmentAttempt,
  AssessmentHistoryEntry,
  AssessmentLifecycleStatus,
  AssessmentResult,
  Role,
} from '@/types/assessment';
import { useAuth } from './AuthContext';
import { getAssessmentSnapshot } from '@/lib/api';

interface AssessmentState {
  selectedRole: Role | null;
  assessmentResult: AssessmentResult | null;
  activeAttempt: AssessmentAttempt | null;
  attemptHistory: AssessmentHistoryEntry[];
  assessmentStatus: AssessmentLifecycleStatus;
}

interface AssessmentContextValue extends AssessmentState {
  isHydrated: boolean;
  setSelectedRole: (role: Role | null) => void;
  setAssessmentResult: (result: AssessmentResult | null) => void;
  setActiveAttempt: (attempt: AssessmentAttempt | null) => void;
  updateActiveAttempt: (update: Partial<AssessmentAttempt>) => void;
  setAttemptHistory: (history: AssessmentHistoryEntry[]) => void;
  appendAttemptHistory: (entry: AssessmentHistoryEntry) => void;
  setAssessmentStatus: (status: AssessmentLifecycleStatus) => void;
  resetAssessment: () => void;
}

const STORAGE_KEY = 'hr-assessment-state';

const initialState: AssessmentState = {
  selectedRole: null,
  assessmentResult: null,
  activeAttempt: null,
  attemptHistory: [],
  assessmentStatus: 'idle',
};

const AssessmentContext = createContext<AssessmentContextValue | undefined>(undefined);

const mapAttemptStatus = (status: string | null | undefined): AssessmentLifecycleStatus => {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'awaiting_ai':
      return 'awaiting_ai';
    case 'in_progress':
      return 'in_progress';
    default:
      return 'idle';
  }
};

const ensureRole = (attempt?: AssessmentAttempt | null, current?: Role | null): Role | null => {
  if (attempt?.role) {
    return { name: attempt.role, title: attempt.role };
  }
  return current ?? null;
};

export const AssessmentProvider = ({ children }: PropsWithChildren<unknown>) => {
  const [state, setState] = useState<AssessmentState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const { status: authStatus, user } = useAuth();

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AssessmentState>;
        setState({
          selectedRole: parsed.selectedRole ?? null,
          assessmentResult: parsed.assessmentResult ?? null,
          activeAttempt: parsed.activeAttempt ?? null,
          attemptHistory: parsed.attemptHistory ?? [],
          assessmentStatus: parsed.assessmentStatus ?? 'idle',
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

  useEffect(() => {
    if (!isHydrated || authStatus !== 'ready') {
      return;
    }

    if (!user) {
      setState(initialState);
      return;
    }

    let isCancelled = false;

    const hydrateFromSupabase = async () => {
      try {
        const snapshot = await getAssessmentSnapshot(user.id);
        if (isCancelled) {
          return;
        }

        setState((prev) => ({
          selectedRole: snapshot.selectedRole ?? prev.selectedRole,
          assessmentResult: snapshot.assessmentResult ?? prev.assessmentResult,
          activeAttempt: snapshot.activeAttempt ?? null,
          attemptHistory: snapshot.history,
          assessmentStatus: snapshot.status,
        }));
      } catch (error) {
        console.error('Failed to hydrate assessment state from Supabase:', error);
      }
    };

    void hydrateFromSupabase();

    return () => {
      isCancelled = true;
    };
  }, [authStatus, isHydrated, user]);

  const setSelectedRole = (role: Role | null) => {
    setState((prev) => ({
      ...prev,
      selectedRole: role,
      assessmentResult: role ? prev.assessmentResult : null,
      activeAttempt: role ? prev.activeAttempt : null,
      assessmentStatus: role ? prev.assessmentStatus : 'idle',
    }));
  };

  const setAssessmentResult = (result: AssessmentResult | null) => {
    setState((prev) => ({
      ...prev,
      assessmentResult: result,
      assessmentStatus: result ? 'completed' : prev.assessmentStatus === 'completed' ? 'idle' : prev.assessmentStatus,
    }));
  };

  const setActiveAttempt = (attempt: AssessmentAttempt | null) => {
    setState((prev) => ({
      ...prev,
      activeAttempt: attempt,
      selectedRole: ensureRole(attempt, prev.selectedRole),
      assessmentStatus: prev.assessmentResult ? 'completed' : attempt ? mapAttemptStatus(attempt.status) : 'idle',
    }));
  };

  const updateActiveAttempt = (update: Partial<AssessmentAttempt>) => {
    setState((prev) => {
      if (!prev.activeAttempt) {
        return prev;
      }

      const nextAttempt: AssessmentAttempt = {
        ...prev.activeAttempt,
        ...update,
      };

      return {
        ...prev,
        activeAttempt: nextAttempt,
        selectedRole: ensureRole(nextAttempt, prev.selectedRole),
        assessmentStatus: prev.assessmentResult ? 'completed' : mapAttemptStatus(update.status ?? nextAttempt.status),
      };
    });
  };

  const setAttemptHistory = (history: AssessmentHistoryEntry[]) => {
    setState((prev) => ({
      ...prev,
      attemptHistory: history,
    }));
  };

  const appendAttemptHistory = (entry: AssessmentHistoryEntry) => {
    setState((prev) => {
      const existingIndex = prev.attemptHistory.findIndex((item) => item.id === entry.id);
      if (existingIndex >= 0) {
        const nextHistory = [...prev.attemptHistory];
        nextHistory[existingIndex] = { ...nextHistory[existingIndex], ...entry };
        return { ...prev, attemptHistory: nextHistory };
      }

      return {
        ...prev,
        attemptHistory: [entry, ...prev.attemptHistory],
      };
    });
  };

  const setAssessmentStatus = (status: AssessmentLifecycleStatus) => {
    setState((prev) => ({
      ...prev,
      assessmentStatus: status,
    }));
  };

  const resetAssessment = () => {
    setState((prev) => ({
      ...prev,
      selectedRole: null,
      assessmentResult: null,
      activeAttempt: null,
      assessmentStatus: 'idle',
    }));
  };

  const value = useMemo(
    () => ({
      ...state,
      isHydrated,
      setSelectedRole,
      setAssessmentResult,
      setActiveAttempt,
      updateActiveAttempt,
      setAttemptHistory,
      appendAttemptHistory,
      setAssessmentStatus,
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
