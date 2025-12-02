import { apiClient } from '@/lib/httpClient';

export interface AnalyticsCandidateSummary {
  id: string;
  name: string;
  role: string;
  band: string | null;
  status: 'completed';
}

interface BackendAnalyticsResponse {
  success: boolean;
  data: {
    candidates: Array<{
      id: string;
      name: string;
      role: string;
      band: string | null;
      status: string;
    }>;
  };
}

export const getAnalyticsData = async (): Promise<AnalyticsCandidateSummary[]> => {
  try {
    const response = await apiClient.get<BackendAnalyticsResponse>('/hr/analytics/candidates');

    if (!response.success || !response.data?.candidates) {
      return [];
    }

    return response.data.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      role: candidate.role,
      band: candidate.band,
      status: 'completed' as const,
    }));
  } catch (error) {
    console.error('Failed to fetch analytics data via backend:', error);
    throw new Error('Unable to fetch analytics data.');
  }
};
