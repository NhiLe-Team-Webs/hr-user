import React, { useEffect, useState } from 'react';
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
import ReviewAttemptScreen from './ReviewAttemptScreen';
import type { Assessment, AssessmentHistoryEntry } from '@/types/assessment';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useLanguage } from '@/hooks/useLanguage';
import ErrorPage from '../pages/ErrorPage';
import { ensureProfile, getAssessment, getAttemptReview, startAssessmentAttempt } from '@/lib/api';
import { useToast } from './ui/use-toast';
import type { AttemptReview } from '@/types/assessment';

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
        <Route
          path="/attempts/:attemptId/review"
          element={(
            <ProtectedRoute>
              <ReviewAttemptRoute />
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
  const { assessmentStatus, activeAttempt, assessmentResult } = useAssessment();

  if (user) {
    if (assessmentStatus === 'completed' && assessmentResult) {
      return <Navigate to="/result" replace />;
    }

    if (activeAttempt && assessmentStatus !== 'idle') {
      return <Navigate to="/assessment" replace />;
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
  const { assessmentStatus, assessmentResult, activeAttempt } = useAssessment();

  if (user) {
    if (assessmentStatus === 'completed' && assessmentResult) {
      return <Navigate to="/result" replace />;
    }

    if (activeAttempt && assessmentStatus !== 'idle') {
      return <Navigate to="/assessment" replace />;
    }

    return <Navigate to="/role-selection" replace />;
  }

  return <LoginScreen />;
};

const RoleSelectionRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    setSelectedRole,
    assessmentStatus,
    assessmentResult,
    activeAttempt,
    setActiveAttempt,
    setAssessmentResult,
    setAssessmentStatus,
    appendAttemptHistory,
  } = useAssessment();

  if (assessmentStatus === 'completed' && assessmentResult) {
    return <Navigate to="/result" replace />;
  }

  if (activeAttempt && assessmentStatus !== 'completed') {
    return <Navigate to="/assessment" replace />;
  }

  return (
    <RoleSelectionScreen
      onRoleSelect={async (role) => {
        setSelectedRole(role);

        if (!user) {
          navigate('/login');
          return;
        }

        try {
          await ensureProfile({
            id: user.id,
            email: user.email ?? null,
            name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null,
          });

          const assessmentData = await getAssessment(role.name);
          if (!assessmentData) {
            throw new Error('Assessment data is unavailable');
          }

          const attempt = await startAssessmentAttempt({
            profileId: user.id,
            assessmentId: assessmentData.id,
            role: role.name,
            totalQuestions: assessmentData.questions.length,
          });

          setActiveAttempt(attempt);
          setAssessmentStatus('in_progress');
          setAssessmentResult(null);
          appendAttemptHistory({
            id: attempt.id,
            role: attempt.role ?? role.name,
            assessmentId: attempt.assessmentId ?? null,
            status: attempt.status,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            completedAt: attempt.completedAt,
            overallScore: null,
            createdAt: attempt.createdAt ?? attempt.startedAt ?? null,
            answeredCount: attempt.answeredCount,
            totalQuestions: attempt.totalQuestions,
            cheatingCount: attempt.cheatingCount ?? null,
          });

          navigate('/pre-assessment', { state: { assessment: assessmentData } });
        } catch (error) {
          console.error('Failed to start assessment attempt:', error);
          setSelectedRole(null);
          setAssessmentStatus('idle');
          toast({
            title: 'Không thể bắt đầu bài đánh giá',
            description: 'Vui lòng thử lại sau.',
            variant: 'destructive',
          });
        }
      }}
    />
  );
};

const PreAssessmentRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialAssessment = (location.state as { assessment?: Assessment } | null)?.assessment ?? null;
  const { selectedRole, assessmentStatus, assessmentResult, activeAttempt } = useAssessment();

  if (!selectedRole) {
    return <Navigate to="/role-selection" replace />;
  }

  if (assessmentStatus === 'completed' && assessmentResult) {
    return <Navigate to="/result" replace />;
  }

  if (!activeAttempt) {
    return <Navigate to="/role-selection" replace />;
  }

  return (
    <PreAssessmentScreen
      role={selectedRole}
      initialAssessment={initialAssessment}
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
      onFinish={({ result, attempt }) => {
        const finalAttempt = attempt ?? activeAttempt;

        if (finalAttempt) {
          setActiveAttempt(finalAttempt);
          appendAttemptHistory({
            id: finalAttempt.id,
            role: finalAttempt.role ?? selectedRole.name,
            assessmentId: finalAttempt.assessmentId ?? null,
            status: finalAttempt.status,
            startedAt: finalAttempt.startedAt,
            submittedAt: finalAttempt.submittedAt,
            completedAt: finalAttempt.completedAt,
            overallScore: result.score,
            createdAt: finalAttempt.createdAt ?? finalAttempt.startedAt ?? null,
            answeredCount: finalAttempt.answeredCount,
            totalQuestions: finalAttempt.totalQuestions,
            cheatingCount: finalAttempt.cheatingCount ?? null,
          });
        }

        setAssessmentResult(result);
        setAssessmentStatus('completed');
        navigate('/result');
      }}
    />
  );
};

const ResultRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    assessmentResult,
    assessmentStatus,
    activeAttempt,
    attemptHistory,
    resetAssessment,
    setSelectedRole,
    setActiveAttempt,
    setAssessmentResult,
    setAssessmentStatus,
    appendAttemptHistory,
  } = useAssessment();
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

  const handleRetake = async (entry: AssessmentHistoryEntry) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const roleName = entry.role;
    const role = { name: roleName, title: roleName };

    try {
      const assessmentData = await getAssessment(roleName);
      if (!assessmentData) {
        throw new Error('Assessment unavailable');
      }

      const attempt = await startAssessmentAttempt({
        profileId: user.id,
        assessmentId: assessmentData.id,
        role: roleName,
        totalQuestions: assessmentData.questions.length,
      });

      setSelectedRole(role);
      setActiveAttempt(attempt);
      setAssessmentResult(null);
      setAssessmentStatus('in_progress');
      appendAttemptHistory({
        id: attempt.id,
        role: attempt.role ?? roleName,
        assessmentId: attempt.assessmentId ?? null,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        completedAt: attempt.completedAt,
        overallScore: null,
        createdAt: attempt.createdAt ?? attempt.startedAt ?? null,
        answeredCount: attempt.answeredCount,
        totalQuestions: attempt.totalQuestions,
        cheatingCount: attempt.cheatingCount ?? null,
      });

      navigate('/pre-assessment', { state: { assessment: assessmentData } });
    } catch (error) {
      console.error('Failed to retake assessment:', error);
      toast({
        title: 'Không thể tạo bài làm mới',
        description: 'Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  return (
    <ResultScreen
      result={assessmentResult}
      history={attemptHistory}
      onReviewAttempt={(attemptId) => {
        navigate(`/attempts/${attemptId}/review`);
      }}
      onRetakeAttempt={handleRetake}
      onTryoutClick={() => {
        navigate('/tryout');
      }}
      onReset={() => {
        resetAssessment();
        setAssessmentStatus('idle');
        setAssessmentResult(null);
        navigate('/role-selection');
      }}
    />
  );
};

const ReviewAttemptRoute = () => {
  const navigate = useNavigate();
  const { attemptId } = useParams<{ attemptId: string }>();
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) {
      setError('missing');
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadReview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getAttemptReview(attemptId);
        if (isCancelled) {
          return;
        }

        if (!data) {
          setError('missing');
        } else {
          setReview(data);
        }
      } catch (err) {
        console.error('Failed to load attempt review:', err);
        if (!isCancelled) {
          setError('failed');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadReview();

    return () => {
      isCancelled = true;
    };
  }, [attemptId]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (error || !review) {
    return (
      <ErrorPage
        title="Không tìm thấy bài làm"
        description="Chúng tôi không thể tìm thấy dữ liệu cho lần làm bài này."
        ctaLabel="Quay lại kết quả"
        onRetry={() => {
          navigate('/result');
        }}
      />
    );
  }

  return (
    <ReviewAttemptScreen
      attempt={review.attempt}
      result={review.result}
      answers={review.answers}
      onBack={() => {
        navigate('/result');
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


