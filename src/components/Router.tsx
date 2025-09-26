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
import type { AssessmentAttempt } from '@/types/assessment';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useLanguage } from '@/hooks/useLanguage';
import ErrorPage from '../pages/ErrorPage';
import { finalizeAssessmentAttempt } from '@/lib/api';

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
  const { assessmentStatus, activeAttempt, assessmentResult, selectedRole } = useAssessment();

  if (user) {
    if (assessmentStatus === 'completed' && assessmentResult) {
      return <Navigate to="/result" replace />;
    }

    if (assessmentStatus === 'awaiting_ai' || (activeAttempt && assessmentStatus !== 'idle')) {
      return <Navigate to="/assessment" replace />;
    }

    if (selectedRole) {
      return <Navigate to="/pre-assessment" replace />;
    }

    return <Navigate to="/role-selection" replace />;
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
  const { assessmentStatus, assessmentResult, activeAttempt, selectedRole } = useAssessment();

  if (user) {
    if (assessmentStatus === 'completed' && assessmentResult) {
      return <Navigate to="/result" replace />;
    }

    if (assessmentStatus === 'awaiting_ai' || (activeAttempt && assessmentStatus !== 'idle')) {
      return <Navigate to="/assessment" replace />;
    }

    if (selectedRole) {
      return <Navigate to="/pre-assessment" replace />;
    }

    return <Navigate to="/role-selection" replace />;
  }

  return <LoginScreen />;
};

const RoleSelectionRoute = () => {
  const navigate = useNavigate();
  const { setSelectedRole, assessmentStatus, assessmentResult, activeAttempt } = useAssessment();

  if (assessmentStatus === 'completed' && assessmentResult) {
    return <Navigate to="/result" replace />;
  }

  if (activeAttempt && assessmentStatus !== 'completed') {
    return <Navigate to="/assessment" replace />;
  }

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
  const { selectedRole, assessmentStatus, assessmentResult, activeAttempt } = useAssessment();

  if (!selectedRole) {
    return <Navigate to="/role-selection" replace />;
  }

  if (assessmentStatus === 'completed' && assessmentResult) {
    return <Navigate to="/result" replace />;
  }

  if (activeAttempt && assessmentStatus !== 'completed') {
    return <Navigate to="/assessment" replace />;
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
  const { user } = useAuth();
  const {
    selectedRole,
    activeAttempt,
    assessmentResult,
    assessmentStatus,
    setAssessmentResult,
    setAssessmentStatus,
    appendAttemptHistory,
    setActiveAttempt,
  } = useAssessment();

  if (!selectedRole) {
    return <Navigate to="/role-selection" replace />;
  }

  if (assessmentStatus === 'completed' && assessmentResult) {
    return <Navigate to="/result" replace />;
  }

  if (!activeAttempt) {
    return <Navigate to="/pre-assessment" replace />;
  }

  return (
    <AssessmentScreen
      role={selectedRole}
      onFinish={async ({ result, attempt }) => {
        let nextResult = result;
        let nextAttempt = attempt ?? activeAttempt;

        if (user && activeAttempt?.id) {
          try {
            const { attempt: persistedAttempt, result: persistedResult } = await finalizeAssessmentAttempt({
              attemptId: activeAttempt.id,
              assessmentId: activeAttempt.assessmentId ?? null,
              profileId: user.id,
              result,
            });
            nextAttempt = persistedAttempt;
            nextResult = persistedResult;
          } catch (error) {
            console.error('Failed to finalise assessment attempt remotely:', error);
          }
        }

        const completedAtIso = nextResult.completedAt ?? new Date().toISOString();

        if (nextAttempt) {
          const normalisedAttempt: AssessmentAttempt = {
            ...nextAttempt,
            status: 'completed',
            completedAt: completedAtIso,
            lastActivityAt: completedAtIso,
          };
          setActiveAttempt(normalisedAttempt);
          appendAttemptHistory({
            id: normalisedAttempt.id,
            role: normalisedAttempt.role ?? selectedRole.name,
            assessmentId: normalisedAttempt.assessmentId ?? null,
            status: normalisedAttempt.status,
            startedAt: normalisedAttempt.startedAt,
            submittedAt: normalisedAttempt.submittedAt,
            completedAt: normalisedAttempt.completedAt,
            overallScore: nextResult.score,
          });
        }

        setAssessmentResult(nextResult);
        setAssessmentStatus('completed');
        navigate('/result');
      }}
    />
  );
};

const ResultRoute = () => {
  const navigate = useNavigate();
  const { assessmentResult, assessmentStatus, activeAttempt, attemptHistory, resetAssessment } = useAssessment();
  const { t } = useLanguage();

  if (!assessmentResult) {
    if (assessmentStatus !== 'completed' && activeAttempt) {
      return <Navigate to="/assessment" replace />;
    }

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
      history={attemptHistory}
      onTryoutClick={() => {
        navigate('/tryout');
      }}
      onRetake={() => {
        resetAssessment();
        navigate('/role-selection');
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


