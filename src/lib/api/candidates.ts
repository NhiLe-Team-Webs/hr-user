import { apiClient } from '@/lib/httpClient';
import type { ProfileUpdates } from './types';

interface BackendCandidateResponse {
  success: boolean;
  data: {
    id: string;
    auth_id: string;
    email: string;
    full_name: string;
    phone?: string;
    role: string;
    created_at: string;
    updated_at: string;
  };
}

interface EnsureUserPayload {
  auth_id: string;
  email: string;
  full_name: string;
}

export const ensureUser = async (payload: EnsureUserPayload): Promise<void> => {
  console.log('[ensureUser] Creating/updating user via backend:', payload);

  try {
    await apiClient.post<BackendCandidateResponse>('/hr/candidates/ensure', payload);
    console.log('[ensureUser] User ensured successfully via backend');
  } catch (error) {
    console.error('[ensureUser] Failed to ensure user via backend:', error);
    throw new Error('Khong the khoi tao ho so nguoi dung.');
  }
};

export const updateCandidateInfo = async (candidateId: string, updates: ProfileUpdates): Promise<void> => {
  // candidateId is Auth ID
  try {
    await apiClient.put(`/hr/candidates/${candidateId}`, updates);
  } catch (error) {
    console.error('Failed to update candidate info via backend:', error);
    throw new Error('Khong the cap nhat thong tin ung vien.');
  }
};
