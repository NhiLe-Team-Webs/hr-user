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
import type { AssessmentResult } from '@/types/assessment';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useLanguage } from '@/hooks/useLanguage';
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


