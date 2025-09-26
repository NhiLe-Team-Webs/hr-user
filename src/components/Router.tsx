import React from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import LandingScreen from './LandingScreen';
import LoginScreen from './LoginScreen';
import RoleSelectionScreen from './RoleSelectionScreen';
import AssessmentScreen from './AssessmentScreen';
import ResultScreen from './ResultScreen';
import TryoutScreen from './TryoutScreen';
import NotFound from '../pages/NotFound';
import PreAssessmentScreen from './PreAssessmentScreen';
import type { AssessmentResult, AssessmentAttempt } from '@/types/assessment';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useLanguage } from '@/hooks/useLanguage';
import ErrorPage from '../pages/ErrorPage';
import { supabase } from '@/lib/supabaseClient';
import type { AssessmentAttemptRow } from '@/lib/api/types';

type SupabaseAttemptWithResult = AssessmentAttemptRow & {
  role: string | null;
  result?:
    | null
    | {
        id?: string;
        total_score?: number | null;
        score?: number | null;
        strengths?: unknown;
      }
    | Array<{
        id?: string;
        total_score?: number | null;
        score?: number | null;
        strengths?: unknown;
      }>;
};

const FullScreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-4 text-gray-600">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
      <span>Đang tải dữ liệu...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const Router = () => {
  const location = useLocation();
  const { status, user } = useAuth();
  const {
    isHydrated,
    setSelectedRole,
    setAssessmentResult,
    setActiveAttempt,
    resetAssessment,
  } = useAssessment();
  const [isSyncing, setIsSyncing] = React.useState(false);

  React.useEffect(() => {
    if (status !== 'ready' || !isHydrated) {
      return;
    }

    if (!user) {
      resetAssessment();
      return;
    }

    let isMounted = true;

    const syncProgress = async () => {
      setIsSyncing(true);

      try {
        const { data, error } = await supabase
          .from('assessment_attempts')
          .select(
            `
              id,
              role,
              status,
              answered_count,
              total_questions,
              progress_percent,
              started_at,
              submitted_at,
              completed_at,
              last_activity_at,
              result:results(
                id,
                total_score,
                score,
                strengths
              )
            `,
          )
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<SupabaseAttemptWithResult>();

        if (!isMounted) {
          return;
        }

        if (error) {
          throw error;
        }

        if (!data) {
          resetAssessment();
          return;
        }

        setSelectedRole(
          data.role
            ? {
                name: data.role,
                title: data.role,
              }
            : null,
        );

        const mapAttemptRow = (row: SupabaseAttemptWithResult): AssessmentAttempt => ({
          id: row.id,
          status: row.status,
          answeredCount: row.answered_count ?? 0,
          totalQuestions: row.total_questions ?? 0,
          progressPercent: Number(row.progress_percent ?? 0),
          startedAt: row.started_at,
          submittedAt: row.submitted_at,
          completedAt: row.completed_at,
          lastActivityAt: row.last_activity_at,
        });

        setActiveAttempt(mapAttemptRow(data));

        const normaliseStrengths = (value: unknown): string[] => {
          if (Array.isArray(value)) {
            return value.filter((item): item is string => typeof item === 'string');
          }
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value) as unknown;
              if (Array.isArray(parsed)) {
                return parsed.filter((item): item is string => typeof item === 'string');
              }
            } catch (parseError) {
              console.warn('Unable to parse strengths payload:', parseError);
            }
            return [value];
          }
          return [];
        };

        const resolveResultPayload = (attempt: SupabaseAttemptWithResult) => {
          if (!attempt.result) {
            return null;
          }

          const payload = Array.isArray(attempt.result) ? attempt.result[0] : attempt.result;

          if (!payload) {
            return null;
          }

          const rawScore =
            typeof payload.total_score === 'number'
              ? payload.total_score
              : typeof payload.score === 'number'
              ? payload.score
              : null;

          if (rawScore == null) {
            return null;
          }

          return {
            score: rawScore,
            strengths: normaliseStrengths(payload.strengths ?? []),
          } satisfies AssessmentResult;
        };

        const result = resolveResultPayload(data);
        setAssessmentResult(result);
      } catch (syncError) {
        if (isMounted) {
          console.error('Failed to sync assessment progress:', syncError);
          resetAssessment();
        }
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    };

    void syncProgress();

    return () => {
      isMounted = false;
      setIsSyncing(false);
    };
  }, [
    status,
    isHydrated,
    user,
    setSelectedRole,
    setAssessmentResult,
    setActiveAttempt,
    resetAssessment,
  ]);

  if (status !== 'ready' || !isHydrated || isSyncing) {
    return <FullScreenLoader />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/role-selection"
          element={(
            <ProtectedRoute>
              <RoleSelectionRoute />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/pre-assessment"
          element={(
            <ProtectedRoute>
              <PreAssessmentRoute />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/assessment"
          element={(
            <ProtectedRoute>
              <AssessmentRoute />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/result"
          element={(
            <ProtectedRoute>
              <ResultRoute />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/tryout"
          element={(
            <ProtectedRoute>
              <TryoutRoute />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const LandingRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/result" replace />;
  }

  return (
    <LandingScreen
      onLoginClick={() => {
        navigate('/login');
      }}
    />
  );
};

const LoginRoute = () => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/result" replace />;
  }

  return <LoginScreen />;
};

const RoleSelectionRoute = () => {
  const navigate = useNavigate();
  const { setSelectedRole } = useAssessment();

  return (
    <RoleSelectionScreen
      onRoleSelect={(role) => {
        setSelectedRole(role);
        navigate('/pre-assessment');
      }}
    />
  );
};

const PreAssessmentRoute = () => {
  const navigate = useNavigate();
  const { selectedRole } = useAssessment();

  if (!selectedRole) {
    return <Navigate to="/role-selection" replace />;
  }

  return (
    <PreAssessmentScreen
      role={selectedRole}
      onStartAssessment={() => {
        navigate('/assessment');
      }}
    />
  );
};

const AssessmentRoute = () => {
  const navigate = useNavigate();
  const { selectedRole, setAssessmentResult } = useAssessment();
  const { t } = useLanguage();

  if (!selectedRole) {
    return <Navigate to="/role-selection" replace />;
  }

  const fallbackResult: AssessmentResult = {
    score: 80,
    strengths: [
      t('strengths.strength1'),
      t('strengths.strength3'),
      t('strengths.strength5'),
    ],
  };

  return (
    <AssessmentScreen
      role={selectedRole}
      onFinish={() => {
        setAssessmentResult(fallbackResult);
        navigate('/result');
      }}
    />
  );
};

const ResultRoute = () => {
  const navigate = useNavigate();
  const { assessmentResult } = useAssessment();
  const { t } = useLanguage();

  if (!assessmentResult) {
    return (
      <ErrorPage
        title={t('resultScreen.missingTitle')}
        description={t('resultScreen.missingDescription')}
        ctaLabel={t('resultScreen.backToSelection')}
        onRetry={() => {
          navigate('/role-selection');
        }}
      />
    );
  }

  return (
    <ResultScreen
      result={assessmentResult}
      onTryoutClick={() => {
        navigate('/tryout');
      }}
    />
  );
};

const TryoutRoute = () => {
  return (
    <TryoutScreen
      onStartTask={() => {
        console.log('Starting a tryout task...');
      }}
    />
  );
};

export default Router;


