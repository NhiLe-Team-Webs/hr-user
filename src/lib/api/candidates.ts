import { supabase } from '@/lib/supabaseClient';
import type { ProfileUpdates, CandidateInfo } from './types';

interface SupabaseCandidateDetails {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  band: string | null;
  scores?: { overall_score: number | null; total_score?: number | null }[];
}

interface SupabaseCandidateProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  band: string | null;
  results?: { overall_score: number | null; total_score?: number | null }[];
}

export const updateCandidateInfo = async (candidateId: string, updates: ProfileUpdates): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', candidateId);

  if (error) {
    console.error('Failed to update candidate info:', error);
    throw new Error('Khong the cap nhat thong tin ung vien.');
  }
};

export const getCandidateDetails = async (candidateId: string): Promise<SupabaseCandidateDetails | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
        id,
        name,
        email,
        role,
        band,
        scores:results(overall_score,total_score)
      `,
    )
    .eq('id', candidateId)
    .single();

  if (error) {
    console.error('Failed to fetch candidate details:', error);
    throw new Error('Khong the tai chi tiet ung vien.');
  }

  return (data as SupabaseCandidateDetails) ?? null;
};

export const getCandidates = async (): Promise<CandidateInfo[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
        id,
        name,
        email,
        role,
        band,
        results(overall_score,total_score)
      `,
    );

  if (error) {
    console.error('Failed to load candidates:', error);
    throw new Error('Khong the tai danh sach ung vien.');
  }

  const rows = (data as SupabaseCandidateProfile[] | null) ?? [];

  return rows.map((profile) => {
    const totalScore =
      profile.results?.[0]?.overall_score ?? profile.results?.[0]?.total_score ?? null;
    const status: CandidateInfo['status'] = totalScore != null ? 'completed' : 'in_progress';

    return {
      id: profile.id,
      fullName: profile.name ?? null,
      email: profile.email ?? null,
      role: profile.role ?? null,
      band: profile.band ?? null,
      avatarChar: profile.name?.charAt(0).toUpperCase() ?? '?',
      scores: { overall: totalScore },
      status,
      startTime: new Date(),
      phone: 'N/A',
      telegram: 'N/A',
    } satisfies CandidateInfo;
  });
};
