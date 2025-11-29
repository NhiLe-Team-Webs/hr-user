// src/components/RoleSelectionScreen.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { PencilRuler, HeartHandshake, ClipboardList } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { getRoles, getLatestResult } from '../lib/api'; // Import API getRoles
import { useToast } from './ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface RoleSelectionScreenProps {
  onRoleSelect: (role: { name: string; title: string }) => void;
}

const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ onRoleSelect }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [roles, setRoles] = useState<{ name: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check if user already has a result
        if (user?.id) {
          try {
            const result = await getLatestResult(user.id);
            console.log('[RoleSelection] Latest result:', result);
            if (result) {
              console.log('[RoleSelection] User has result, redirecting to /result');
              setHasResult(true);
              return;
            }
          } catch (resultError) {
            // If error checking result, just continue to show roles
            console.log('[RoleSelection] Error checking result (continuing):', resultError);
          }
        }

        // Fetch available roles
        const rolesData = await getRoles();
        console.log('[RoleSelection] Loaded roles:', rolesData);
        setRoles(rolesData);
      } catch (err) {
        console.error('[RoleSelection] Error loading roles:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách vai trò.',
          variant: 'destructive',
        });
        setError('Không thể tải danh sách vai trò.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast, user?.id]);

  // Redirect to result if user already completed assessment
  if (hasResult) {
    return <Navigate to="/result" replace />;
  }

  if (loading) {
    return (
      <motion.div
        key="loading-roles"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center p-8"
      >
        Đang tải danh sách vai trò...
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        key="error-roles"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center p-8 text-red-500"
      >
        Lỗi: {error}
      </motion.div>
    );
  }

  const roleIcons = {
    'Content Creator': <PencilRuler className="w-10 h-10 text-primary mb-4 mx-auto" />,
    'Customer Support': <HeartHandshake className="w-10 h-10 text-primary mb-4 mx-auto" />,
    'Operations': <ClipboardList className="w-10 h-10 text-primary mb-4 mx-auto" />,
  };

  return (
    <motion.div
      key="role-selection"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 md:p-12"
    >
      <h2 className="text-3xl font-bold mb-3 text-center tracking-tight">{t('roleSelectionScreen.title')}</h2>
      <p className="text-muted-foreground mb-10 text-center">
        {t('roleSelectionScreen.subtitle')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map(role => (
          <div
            key={role.name}
            onClick={() => {
              console.log('[RoleSelection] Role clicked:', role.name);
              onRoleSelect({ name: role.name, title: role.title });
            }}
            className="p-6 text-center bg-muted/50 rounded-2xl hover:ring-2 ring-primary cursor-pointer transition-all transform hover:-translate-y-1"
          >
            {roleIcons[role.name as keyof typeof roleIcons] || <PencilRuler className="w-10 h-10 text-primary mb-4 mx-auto" />}
            <h3 className="text-xl font-bold mb-2">{role.title}</h3>
            <p className="text-muted-foreground text-sm">
              {/* Đây là nơi bạn có thể thêm mô tả động nếu cần */}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default RoleSelectionScreen;