import React, { useEffect, useState } from 'react';
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
import type { AssessmentResult } from '@/types/assessment';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useLanguage } from '@/hooks/useLanguage';
import ErrorPage from '../pages/ErrorPage';
import { getLatestAttemptForProfile, getResultByAttempt, getAnswersByAttempt } from '@/lib/api';

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
  const { status } = useAuth();
  const { isHydrated } = useAssessment();

  if (status !== 'ready' || !isHydrated) {
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
  const { selectedRole } = useAssessment();

  if (!selectedRole) {
    return <Navigate to="/role-selection" replace />;
  }

  return (
    <AssessmentScreen
      role={selectedRole}
      onFinish={() => {
        navigate('/result');
      }}
    />
  );
};

const ResultRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { setAssessmentResult } = useAssessment();
  const [state, setState] = useState<{ loading: boolean; error: string | null; result: AssessmentResult | null }>({
    loading: true,
    error: null,
    result: null,
  });

  useEffect(() => {
    let isMounted = true;

    const loadResult = async () => {
      if (!user) {
        return;
      }

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const attempt = await getLatestAttemptForProfile(user.id);

        if (!attempt) {
          if (!isMounted) {
            return;
          }
          setState({ loading: false, error: t('resultScreen.missingDescription'), result: null });
          return;
        }

        const [answers, storedResult] = await Promise.all([
          getAnswersByAttempt(attempt.id),
          getResultByAttempt(attempt.id),
        ]);

        const completedCount = answers.length;
        const cheatingCount = attempt.cheatingCount ?? 0;

        const resolvedResult: AssessmentResult = storedResult
          ? {
              ...storedResult,
              completedCount: storedResult.completedCount || completedCount,
              cheatingCount: storedResult.cheatingCount ?? cheatingCount,
            }
          : {
              overallScore: null,
              adjustedScore: null,
              strengths: [],
              weaknesses: [],
              summary: '',
              completedCount,
              cheatingCount,
              skillScores: undefined,
              rawSummary: null,
            };

        if (!isMounted) {
          return;
        }

        setAssessmentResult(resolvedResult);
        setState({ loading: false, error: null, result: resolvedResult });
      } catch (error) {
        console.error('Failed to load result data:', error);
        if (!isMounted) {
          return;
        }
        setState({ loading: false, error: t('resultScreen.errorLoading'), result: null });
      }
    };

    void loadResult();

    return () => {
      isMounted = false;
    };
  }, [setAssessmentResult, t, user]);

  if (state.loading) {
    return <FullScreenLoader />;
  }

  if (state.error || !state.result) {
    return (
      <ErrorPage
        title={t('resultScreen.missingTitle')}
        description={state.error ?? t('resultScreen.missingDescription')}
        ctaLabel={t('resultScreen.backToSelection')}
        onRetry={() => {
          navigate('/role-selection');
        }}
      />
    );
  }

  return (
    <ResultScreen
      result={state.result}
      onScheduleInterview={() => {
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
