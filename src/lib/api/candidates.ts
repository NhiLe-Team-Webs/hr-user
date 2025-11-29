import { supabase } from '@/lib/supabaseClient';
import type { ProfileUpdates, CandidateInfo } from './types';

interface SupabaseCandidateDetails {
  id: string; // Internal ID
  auth_id: string; // Auth ID
  full_name: string | null;
  email: string | null;
  role: string | null;
  band: string | null;
  results?: { id: string }[];
}

interface SupabaseCandidateUser {
  id: string; // Internal ID
  auth_id: string; // Auth ID
  full_name: string | null;
  email: string | null;
  role: string | null;
  band: string | null;
  results?: {
    id: string;
    team_fit?: string | null;
  }[];
}

export const updateCandidateInfo = async (candidateId: string, updates: ProfileUpdates): Promise<void> => {
  // candidateId is Auth ID
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('auth_id', candidateId);

  if (error) {
    console.error('Failed to update candidate info:', error);
    throw new Error('Khong the cap nhat thong tin ung vien.');
  }
};

export const getCandidateDetails = async (candidateId: string): Promise<SupabaseCandidateDetails | null> => {
  // candidateId is Auth ID
  const { data, error } = await supabase
    .from('users')
    .select(
      `
        id,
        auth_id,
        full_name,
        email,
        role,
        band,
        results:interview_results!user_id(id, team_fit)
      `,
    )
    .eq('auth_id', candidateId)
    .single();

  if (error) {
    console.error('Failed to fetch candidate details:', error);
    throw new Error('Khong the tai chi tiet ung vien.');
  }

  return (data as SupabaseCandidateDetails) ?? null;
};

export const getCandidates = async (): Promise<CandidateInfo[]> => {
  const { data, error } = await supabase
    .from('users')
    .select(
      `
        id,
        auth_id,
        full_name,
        email,
        role,
        band,
        results:interview_results!user_id(id, team_fit)
      `,
    )
    .eq('role', 'candidate');

  if (error) {
    console.error('Failed to load candidates:', error);
    throw new Error('Khong the tai danh sach ung vien.');
  }

  const rows = (data as SupabaseCandidateUser[] | null) ?? [];

  return rows.map((user) => {
    const hasResult = (user.results?.length ?? 0) > 0;
    const status: CandidateInfo['status'] = hasResult ? 'completed' : 'in_progress';

    return {
      id: user.auth_id, // Use Auth ID as public ID
      fullName: user.full_name ?? null,
      email: user.email ?? null,
      role: user.role ?? null,
      band: user.band ?? null,
      avatarChar: user.full_name?.charAt(0).toUpperCase() ?? '?',
      status,
      startTime: new Date(),
      phone: 'N/A',
      telegram: 'N/A',
    } satisfies CandidateInfo;
  });
};
