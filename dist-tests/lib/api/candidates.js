import { supabase } from '@/lib/supabaseClient';
export const updateCandidateInfo = async (candidateId, updates) => {
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
export const getCandidateDetails = async (candidateId) => {
    // candidateId is Auth ID
    const { data, error } = await supabase
        .from('users')
        .select(`
        id,
        auth_id,
        full_name,
        email,
        role,
        band,
        results:interview_results!user_id(id, team_fit)
      `)
        .eq('auth_id', candidateId)
        .single();
    if (error) {
        console.error('Failed to fetch candidate details:', error);
        throw new Error('Khong the tai chi tiet ung vien.');
    }
    return data ?? null;
};
export const getCandidates = async () => {
    const { data, error } = await supabase
        .from('users')
        .select(`
        id,
        auth_id,
        full_name,
        email,
        role,
        band,
        results:interview_results!user_id(id, team_fit)
      `)
        .eq('role', 'candidate');
    if (error) {
        console.error('Failed to load candidates:', error);
        throw new Error('Khong the tai danh sach ung vien.');
    }
    const rows = data ?? [];
    return rows.map((user) => {
        const hasResult = (user.results?.length ?? 0) > 0;
        const status = hasResult ? 'completed' : 'in_progress';
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
        };
    });
};
