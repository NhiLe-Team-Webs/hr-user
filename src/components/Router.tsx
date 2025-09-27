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
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useLanguage } from '@/hooks/useLanguage';
import ErrorPage from '../pages/ErrorPage';
import { resolveAssessmentState } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

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

type ResolutionStatus = 'idle' | 'loading' | 'ready';

const useAssessmentResolution = (userId: string | undefined) => {
  const { setSelectedRole, setActiveAttempt, setAssessmentResult } = useAssessment();
  const [status, setStatus] = useState<ResolutionStatus>(userId ? 'loading' : 'idle');
  const [nextRoute, setNextRoute] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      setStatus('idle');
      setNextRoute(null);
      setSelectedRole(null);
      setActiveAttempt(null);
      setAssessmentResult(null);
      return () => {
        isMounted = false;
      };
    }

    setStatus('loading');
    setNextRoute(null);

    const resolve = async () => {
      try {
        const resolution = await resolveAssessmentState({ profileId: userId, client: supabase });

        if (!isMounted) {
          return;
        }

        setSelectedRole(resolution.selectedRole);
        setActiveAttempt(resolution.activeAttempt);
        setAssessmentResult(resolution.assessmentResult);
        setNextRoute(resolution.nextRoute);
        setStatus('ready');
      } catch (error) {
        console.error('Failed to resolve assessment state:', error);
        if (!isMounted) {
          return;
        }
        setSelectedRole(null);
        setActiveAttempt(null);
        setAssessmentResult(null);
        setNextRoute('/role-selection');
        setStatus('ready');
      }
    };

    void resolve();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { status, nextRoute };
};

const LandingRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status, nextRoute } = useAssessmentResolution(user?.id);

  if (user) {
    if (status !== 'ready' || !nextRoute) {
      return <FullScreenLoader />;
    }
    return <Navigate to={nextRoute} replace />;
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
  const { status, nextRoute } = useAssessmentResolution(user?.id);

  if (user) {
    if (status !== 'ready' || !nextRoute) {
      return <FullScreenLoader />;
    }
    return <Navigate to={nextRoute} replace />;
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


