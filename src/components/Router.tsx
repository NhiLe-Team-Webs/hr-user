import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { resolveAssessmentState, getLatestResult, ensureUser } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { oauth, triggerAuthStateChange } from '@/lib/authClient';
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
  const { assessmentResult, resolutionStatus } = useAssessment();
  const location = useLocation();

  console.log('[ProtectedRoute]', {
    pathname: location.pathname,
    user: user ? { id: user.id, email: user.email } : null,
    assessmentResult: !!assessmentResult,
    resolutionStatus,
  });

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to /login');
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

const AuthCallbackRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(location.hash.substring(1)); // Handle hash params too

        // Check for errors first
        const error = params.get('error') || hashParams.get('error');
        const errorDescription = params.get('error_description') || hashParams.get('error_description');

        if (error) {
          console.error('[AuthCallbackRoute] Auth error:', error, errorDescription);
          navigate(`/login?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`);
          return;
        }

        // Check if we have tokens in the URL (from OAuth redirect)
        const accessToken = params.get('access_token') || hashParams.get('access_token');
        const refreshToken = params.get('refresh_token') || hashParams.get('refresh_token');
        const expiresAt = params.get('expires_at') || hashParams.get('expires_at');

        if (accessToken) {
          console.log('[AuthCallbackRoute] OAuth successful, extracting tokens from URL...');

          // Get user details to ensure account exists
          // We need to do this BEFORE triggering auth state change,
          // because AuthContext might try to validate against backend immediately
          const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

          if (userError || !user) {
            console.error('[AuthCallbackRoute] Failed to get user from token:', userError);
            navigate('/login?error=invalid_token');
            return;
          }

          // Ensure user exists in backend
          await ensureUser({
            auth_id: user.id,
            email: user.email || '',
            full_name: user.user_metadata.full_name || user.user_metadata.name || user.email || '',
            token: accessToken,
          });

          // Store tokens directly from URL parameters
          localStorage.setItem('access_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
          }

          // Create session object for auth state change
          const session = {
            access_token: accessToken,
            refresh_token: refreshToken || '',
            user: {
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata.full_name,
              role: 'candidate', // Default role
              created_at: user.created_at
            },
            expires_at: expiresAt ? Number(expiresAt) : undefined,
          };

          triggerAuthStateChange('SIGNED_IN', session);
          navigate('/');
          return;
        }

        // Fallback to code exchange if no direct tokens
        const code = params.get('code');
        const state = params.get('state');

        if (!code) {
          console.warn('[AuthCallbackRoute] No code or tokens found in URL');
          navigate('/login');
          return;
        }

        console.log('[AuthCallbackRoute] Handling OAuth callback with code exchange...');
        const session = await oauth.handleCallback(code, state || '');

        if (session) {
          console.log('[AuthCallbackRoute] OAuth successful, updating session...');
          localStorage.setItem('access_token', session.access_token);
          localStorage.setItem('refresh_token', session.refresh_token || '');

          triggerAuthStateChange('SIGNED_IN', session);
          navigate('/');
        }
      } catch (error) {
        console.error('[AuthCallbackRoute] OAuth error:', error);
        navigate('/login?error=oauth_failed');
      }
    };

    void handleCallback();
  }, [location.search, location.hash, navigate]);

  return <FullScreenLoader />;
};

const Router = () => {
  const location = useLocation();
  const { status } = useAuth();
  const { isHydrated, resolutionStatus } = useAssessment();

  // Call resolution hook once at the Router level
  useGlobalAssessmentResolution();

  if (status !== 'ready' || !isHydrated || resolutionStatus === 'loading') {
    return <FullScreenLoader />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/auth/callback" element={<AuthCallbackRoute />} />
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
          path="/assessment/:roleName/q/:questionIndex"
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

// Global resolution hook - called once at the Router level
const useGlobalAssessmentResolution = () => {
  const { user } = useAuth();
  const { setSelectedRole, setActiveAttempt, setAssessmentResult, setResolutionStatus, setNextRoute } = useAssessment();
  const userId = user?.id;

  const userRef = React.useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      console.log('[useGlobalAssessmentResolution] No userId, setting idle');
      setResolutionStatus('idle');
      setNextRoute(null);
      setSelectedRole(null);
      setActiveAttempt(null);
      setAssessmentResult(null);
      return () => {
        isMounted = false;
      };
    }

    setResolutionStatus('loading');
    setNextRoute(null);

    const resolve = async () => {
      try {
        const currentUser = userRef.current;
        // Ensure user exists in database
        console.log('[useGlobalAssessmentResolution] Ensuring user...');
        await ensureUser({
          auth_id: userId,
          email: currentUser?.email ?? null,
          full_name: currentUser?.full_name ?? null,
        });

        console.log('[useGlobalAssessmentResolution] User ensured, resolving state...');
        const resolution = await resolveAssessmentState({ userId });

        if (!isMounted) {
          return;
        }

        console.log('[useGlobalAssessmentResolution] Resolution complete:', {
          nextRoute: resolution.nextRoute,
          hasRole: !!resolution.selectedRole,
          hasResult: !!resolution.assessmentResult,
          hasAttempt: !!resolution.activeAttempt,
        });

        // Validate nextRoute to prevent loops
        let validNextRoute = resolution.nextRoute;
        if (!validNextRoute || validNextRoute === '/' || validNextRoute === '/login') {
          console.warn('[useGlobalAssessmentResolution] Invalid nextRoute, defaulting to /role-selection:', validNextRoute);
          validNextRoute = '/role-selection';
        }

        setSelectedRole(resolution.selectedRole);
        setActiveAttempt(resolution.activeAttempt);
        setAssessmentResult(resolution.assessmentResult);
        setNextRoute(validNextRoute);
        setResolutionStatus('ready');
      } catch (error) {
        console.error('[useGlobalAssessmentResolution] Failed to resolve assessment state:', error);
        if (!isMounted) {
          return;
        }
        // Default to role-selection on error for new users
        setSelectedRole(null);
        setActiveAttempt(null);
        setAssessmentResult(null);
        setNextRoute('/role-selection');
        setResolutionStatus('ready');
      }
    };

    void resolve();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
};

const LandingRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resolutionStatus, nextRoute } = useAssessment();

  if (user) {
    if (resolutionStatus !== 'ready' || !nextRoute) {
      return <FullScreenLoader />;
    }
    // Prevent infinite loop - don't redirect to / or invalid routes
    if (nextRoute === '/' || window.location.pathname === nextRoute) {
      console.warn('[LandingRoute] Invalid nextRoute, defaulting to /role-selection:', nextRoute);
      return <Navigate to="/role-selection" replace />;
    }
    console.log('[LandingRoute] Redirecting to:', nextRoute);
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
  const { resolutionStatus, nextRoute } = useAssessment();

  if (user) {
    if (resolutionStatus !== 'ready' || !nextRoute) {
      return <FullScreenLoader />;
    }
    // Prevent infinite loop - don't redirect to /login or /
    if (nextRoute === '/login' || nextRoute === '/' || window.location.pathname === nextRoute) {
      console.warn('[LoginRoute] Invalid nextRoute, defaulting to /role-selection:', nextRoute);
      return <Navigate to="/role-selection" replace />;
    }
    console.log('[LoginRoute] Redirecting to:', nextRoute);
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
        navigate(`/assessment/${role.name}/q/1`);
      }}
    />
  );
};

const AssessmentRoute = () => {
  const navigate = useNavigate();
  const { roleName, questionIndex } = useParams();
  const { selectedRole, setSelectedRole } = useAssessment();

  useEffect(() => {
    if (roleName && (!selectedRole || selectedRole.name !== roleName)) {
      // If URL has role but context doesn't (e.g. direct link), try to set it or fetch it?
      // For now, we rely on AssessmentScreen to handle data fetching based on roleName.
      // But AssessmentScreen takes `role` object.
      // We might need to fetch role details if not in context.
      // However, AssessmentScreen only needs role.name for fetching assessment.
      // Let's construct a minimal role object if needed, or update AssessmentScreen to take roleName string.
    }
  }, [roleName, selectedRole]);

  if (!roleName || !questionIndex) {
    // Legacy route /assessment
    if (selectedRole) {
      return <Navigate to={`/assessment/${selectedRole.name}/q/1`} replace />;
    }
    return <Navigate to="/role-selection" replace />;
  }

  // If we have params, render screen.
  // We pass roleName to AssessmentScreen.
  // Note: AssessmentScreen currently takes `role: Role`.
  // We should update AssessmentScreen to take `roleName` or construct a dummy role.
  // Since AssessmentScreen fetches assessment by role.name, a dummy object with name is enough?
  // Or better: Update AssessmentScreen to accept roleName.

  const roleObj = selectedRole || { id: roleName || '', name: roleName || '', title: roleName || '' };

  return (
    <AssessmentScreen
      role={roleObj}
      questionIndexParam={Number(questionIndex)}
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



