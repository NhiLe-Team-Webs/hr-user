import type { Role, AssessmentResult, AssessmentAttempt } from '@/types/assessment';
import { apiClient } from '@/lib/httpClient';

type NextRoute = '/result' | '/assessment' | '/role-selection';

export interface AssessmentResolution {
  nextRoute: NextRoute;
  selectedRole: Role | null;
  assessmentResult: AssessmentResult | null;
  activeAttempt: AssessmentAttempt | null;
}

const defaultResolution: AssessmentResolution = {
  nextRoute: '/role-selection',
  selectedRole: null,
  assessmentResult: null,
  activeAttempt: null,
};

export const resolveAssessmentState = async ({
  userId,
}: { userId: string }): Promise<AssessmentResolution> => {
  console.log('[resolveAssessmentState] Starting for userId (Auth ID):', userId);

  if (!userId) {
    console.log('[resolveAssessmentState] No userId, returning default');
    return defaultResolution;
  }

  try {
    const response = await apiClient.get<{
      success: boolean;
      data: AssessmentResolution;
      error?: { message?: string };
    }>('/hr/assessments/state');

    console.log('[resolveAssessmentState] API response received:', response.success ? 'Success' : 'Failure');

    if (!response.success) {
      console.error('[resolveAssessmentState] API error:', response.error);
      throw new Error(response.error?.message || 'Failed to resolve assessment state');
    }

    const state = response.data;
    console.log('[resolveAssessmentState] State resolved:', {
      nextRoute: state.nextRoute,
      hasRole: !!state.selectedRole,
      hasResult: !!state.assessmentResult,
      hasAttempt: !!state.activeAttempt,
    });

    return {
      nextRoute: state.nextRoute,
      selectedRole: state.selectedRole,
      assessmentResult: state.assessmentResult,
      activeAttempt: state.activeAttempt,
    };
  } catch (error) {
    console.error('[resolveAssessmentState] Failed to resolve state:', error);
    // Return default state on error
    return defaultResolution;
  }
};
