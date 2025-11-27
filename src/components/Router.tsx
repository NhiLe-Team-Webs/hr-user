import React, { useCallback, useEffect, useState } from 'react';
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
import { resolveAssessmentState, getLatestResult, ensureProfile } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import type { Role } from '@/types/assessment';

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
  const { assessmentResult } = useAssessment();
  const location = useLocation();
  const { status: resolutionStatus, nextRoute } = useAssessmentResolution(user?.id);

  console.log('[ProtectedRoute]', {
    pathname: location.pathname,
    assessmentResult: !!assessmentResult,
    nextRoute,
    resolutionStatus,
  });

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (resolutionStatus !== 'ready') {
    return <FullScreenLoader />;
  }

  // Only redirect to result if user has actual assessment result
  // Don't block navigation to pre-assessment or role-selection
  const shouldRedirectToResult =
    assessmentResult &&
    location.pathname !== '/result' &&
    location.pathname !== '/tryout' &&
    location.pathname !== '/role-selection' &&
    location.pathname !== '/pre-assessment';

  if (shouldRedirectToResult) {
    console.log('[ProtectedRoute] Redirecting to /result');
    return <Navigate to="/result" replace />;
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
  const { user } = useAuth();
  const [status, setStatus] = useState<ResolutionStatus>(userId ? 'loading' : 'idle');
  const [nextRoute, setNextRoute] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!userId || !user) {
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
        // Ensure profile exists in database
        await ensureProfile({
          id: userId,
          email: user.email ?? null,
          name: user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
        });

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
  }, [userId, user]);

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
        console.log('[RoleSelectionRoute] Role selected:', role);
        setSelectedRole(role);
        console.log('[RoleSelectionRoute] Navigating to /pre-assessment');
        // Navigate with state to ensure role is available immediately
        navigate('/pre-assessment', { state: { role } });
      }}
    />
  );
};

const PreAssessmentRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedRole } = useAssessment();
  
  // Try to get role from navigation state first, then from context
  const role = (location.state as { role?: Role })?.role || selectedRole;

  console.log('[PreAssessmentRoute] role from state:', (location.state as { role?: Role })?.role);
  console.log('[PreAssessmentRoute] selectedRole from context:', selectedRole);
  console.log('[PreAssessmentRoute] final role:', role);

  if (!role) {
    console.log('[PreAssessmentRoute] No role, redirecting to /role-selection');
    return <Navigate to="/role-selection" replace />;
  }

  return (
    <PreAssessmentScreen
      role={role}
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
  const { assessmentResult, setAssessmentResult, activeAttempt } = useAssessment();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestResult = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const latest = await getLatestResult(user.id, activeAttempt?.assessmentId);
      if (latest) {
        setAssessmentResult({
          score: latest.score,
          summary: latest.summary,
          strengths: latest.strengths,
          developmentAreas: latest.developmentAreas,
          skillScores: latest.skillScores,
          recommendedRoles: latest.recommendedRoles,
          developmentSuggestions: latest.developmentSuggestions,
          completedAt: latest.completedAt ?? latest.createdAt,
          hrApprovalStatus: latest.hrApprovalStatus,
        });
      } else {
        setAssessmentResult(null);
      }
    } catch (err) {
      console.error('Failed to load latest assessment result:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [activeAttempt?.assessmentId, setAssessmentResult, user?.id]);

  useEffect(() => {
    void fetchLatestResult();
  }, [fetchLatestResult]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (error) {
    return (
      <ErrorPage
        title={t('resultScreen.aiFailedTitle')}
        description={t('resultScreen.aiFailedDescriptionWithError', { error })}
        ctaLabel={t('resultScreen.aiRetryCta')}
        onRetry={() => {
          void fetchLatestResult();
        }}
      />
    );
  }

  if (assessmentResult) {
    return (
      <ResultScreen
        result={assessmentResult}
        onTryoutClick={() => {
          navigate('/tryout');
        }}
      />
    );
  }

  const aiStatus = activeAttempt?.aiStatus ?? null;
  const lastAiError = activeAttempt?.lastAiError ?? null;

  if (aiStatus === 'processing') {
    return (
      <ErrorPage
        title={t('resultScreen.aiPendingTitle')}
        description={t('resultScreen.aiPendingDescription')}
        ctaLabel={t('resultScreen.aiPendingCta')}
        onRetry={() => {
          void fetchLatestResult();
        }}
      />
    );
  }

  if (aiStatus === 'failed') {
    const description = lastAiError
      ? t('resultScreen.aiFailedDescriptionWithError', { error: lastAiError })
      : t('resultScreen.aiFailedDescription');

    return (
      <ErrorPage
        title={t('resultScreen.aiFailedTitle')}
        description={description}
        ctaLabel={t('resultScreen.aiRetryCta')}
        onRetry={() => {
          void fetchLatestResult();
        }}
      />
    );
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



