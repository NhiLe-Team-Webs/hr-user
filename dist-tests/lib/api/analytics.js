import { supabase } from '@/lib/supabaseClient';
export const getAnalyticsData = async () => {
    const { data, error } = await supabase
        .from('interview_results')
        .select(`
        assessment:interview_assessments(target_role),
        user:users(auth_id, full_name, band)
      `);
    if (error) {
        console.error('Failed to fetch analytics data:', error);
        throw new Error('Unable to fetch analytics data.');
    }
    const rows = data ?? [];
    return rows
        .map((item) => {
        const user = item.user?.[0] ?? null;
        if (!user?.auth_id) {
            return null;
        }
        const assessment = item.assessment?.[0] ?? null;
        return {
            id: user.auth_id,
            name: user.full_name ?? 'Unknown',
            role: assessment?.target_role ?? 'Unknown',
            band: user.band ?? null,
            status: 'completed',
        };
    })
        .filter((item) => item !== null);
};
