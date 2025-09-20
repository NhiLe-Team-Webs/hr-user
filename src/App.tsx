import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HRAssessmentApp from './components/HRAssessmentApp';
import Router from './components/Router';
import ErrorPage from './pages/ErrorPage';
import { AuthProvider } from '@/contexts/AuthContext';
import { AssessmentProvider } from '@/contexts/AssessmentContext';

const queryClient = new QueryClient();

interface ErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false }, () => {
      window.location.assign('/');
    });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorPage onRetry={this.handleReset} />;
    }

    return this.props.children;
  }
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <AssessmentProvider>
            <AppErrorBoundary>
              <HRAssessmentApp>
                <Router />
              </HRAssessmentApp>
            </AppErrorBoundary>
          </AssessmentProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
