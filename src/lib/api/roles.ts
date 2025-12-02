import { apiClient } from '@/lib/httpClient';

export interface RoleData {
  id: string;
  name: string;
  title: string;
}

interface BackendRoleResponse {
  success: boolean;
  data: {
    roles: Array<{
      id: string;
      name: string;
      description?: string;
      duration_minutes: number;
      is_active: boolean;
    }>;
  };
}

export const getRoles = async (): Promise<RoleData[]> => {
  try {
    const response = await apiClient.get<BackendRoleResponse>('/hr/roles');

    if (response.success && response.data?.roles) {
      return response.data.roles.map((role) => ({
        id: role.id,
        name: role.name,
        title: role.name, // Use name as title for now
      }));
    }

    return [];
  } catch (error) {
    console.error('Failed to load roles via backend:', error);
    throw new Error('Khong the tai danh sach vai tro.');
  }
};
