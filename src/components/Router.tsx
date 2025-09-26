import React, { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useLanguage } from '@/hooks/useLanguage';
import { getCandidateProgress } from '@/lib/api';
import ErrorPage from '../pages/ErrorPage';

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
    activeAttempt,
    assessmentResult,
    setActiveAttempt,
    setAssessmentResult,
  } = useAssessment();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (status !== 'ready' || !isHydrated) {
      return;
    }

    if (!user) {
      setActiveAttempt(null);
      setAssessmentResult(null);
      return;
    }

    let cancelled = false;
    setIsSyncing(true);

    getCandidateProgress(user.id)
      .then(({ attempt, result }) => {
        if (cancelled) {
          return;
        }
        setActiveAttempt(attempt);
        setAssessmentResult(result);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to synchronise assessment state:', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSyncing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isHydrated, setActiveAttempt, setAssessmentResult, status, user]);

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

const useDefaultPath = () => {
  const { assessmentResult, activeAttempt } = useAssessment();

  return useMemo(() => {
    if (assessmentResult) {
      return '/result';
    }

    if (activeAttempt && activeAttempt.status !== 'completed' && activeAttempt.status !== 'awaiting_ai') {
      return '/assessment';
    }

    return '/role-selection';
  }, [assessmentResult, activeAttempt]);
};

const LandingRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultPath = useDefaultPath();

  if (user) {
    return <Navigate to={defaultPath} replace />;
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
  const defaultPath = useDefaultPath();

  if (user) {
    return <Navigate to={defaultPath} replace />;
  }

  return <LoginScreen />;
};

const RoleSelectionRoute = () => {
  const navigate = useNavigate();
  const { setSelectedRole, setAssessmentResult, setActiveAttempt } = useAssessment();

  return (
    <RoleSelectionScreen
      onRoleSelect={(role) => {
        setAssessmentResult(null);
        setActiveAttempt(null);
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
  const { selectedRole, activeAttempt, assessmentResult } = useAssessment();

  if (!selectedRole) {
    return <Navigate to="/role-selection" replace />;
  }

  if (assessmentResult) {
    return <Navigate to="/result" replace />;
  }

  if (!activeAttempt || (activeAttempt.status !== 'in_progress' && activeAttempt.status !== 'not_started')) {
    return <Navigate to="/pre-assessment" replace />;
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
  const { assessmentResult, activeAttempt } = useAssessment();
  const { t } = useLanguage();

  if (!assessmentResult) {
    return (
      <ErrorPage
        title={t('resultScreen.missingTitle')}
        description={t('resultScreen.missingDescription')}
        ctaLabel={t('resultScreen.backToSelection')}
        onRetry={() => {
          if (activeAttempt && activeAttempt.status === 'in_progress') {
            navigate('/assessment');
          } else {
            navigate('/role-selection');
          }
        }}
      />
    );
  }

  return (
    <ResultScreen
      result={assessmentResult}
      onScheduleInterview={() => {
        navigate('/tryout');
      }}
    />
  );
};

const TryoutRoute = () => (
  <TryoutScreen
    onStartTask={() => {
      console.log('Starting a tryout task...');
    }}
  />
);

export default Router;
