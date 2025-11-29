import { supabase } from '@/lib/supabaseClient';
export const getRoles = async () => {
    const { data, error } = await supabase
        .from('interview_assessments')
        .select('target_role, title');
    if (error) {
        console.error('Failed to load roles:', error);
        throw new Error('Khong the tai danh sach vai tro.');
    }
    return (data ?? [])
        .filter((item) => item.target_role && item.title)
        .map((item) => ({
        name: item.target_role,
        title: item.title,
    }));
};
export const createRole = async (roleName) => {
    const { error } = await supabase
        .from('assessments')
        .insert([
        {
            target_role: roleName,
            title: `Assessment for ${roleName}`,
            description: `Assessment tailored for ${roleName}`,
            duration: 1800,
            is_active: true,
            start_date: new Date().toISOString().slice(0, 10),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
    ]);
    if (error) {
        console.error('Failed to create role:', error);
        throw new Error('Khong the tao vai tro.');
    }
};
export const deleteRole = async (roleName) => {
    const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('target_role', roleName);
    if (error) {
        console.error('Failed to delete role:', error);
        throw new Error('Khong the xoa vai tro.');
    }
};
