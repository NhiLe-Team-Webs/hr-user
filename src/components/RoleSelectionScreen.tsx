// src/components/RoleSelectionScreen.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PencilRuler, HeartHandshake, ClipboardList } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { getRoles } from '../lib/api'; // Import API getRoles
import { useToast } from './ui/use-toast';

interface RoleSelectionScreenProps {
  onRoleSelect: (role: { name: string; title: string }) => Promise<void> | void;
}

const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ onRoleSelect }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingRole, setProcessingRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const rolesData = await getRoles();
        setRoles(rolesData);
      } catch (err) {
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
    fetchRoles();
  }, [toast]);

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
        {roles.map((roleName) => {
          const isProcessing = processingRole === roleName;

          return (
            <div
              key={roleName}
              onClick={async () => {
                if (isProcessing) {
                  return;
                }

                setProcessingRole(roleName);
                try {
                  await Promise.resolve(onRoleSelect({ name: roleName, title: roleName }));
                } catch (err) {
                  console.error('Failed to select role:', err);
                  toast({
                    title: 'Đã xảy ra lỗi',
                    description: 'Không thể khởi tạo bài đánh giá cho vai trò này.',
                    variant: 'destructive',
                  });
                } finally {
                  setProcessingRole(null);
                }
              }}
              className={`p-6 text-center bg-muted/50 rounded-2xl transition-all transform hover:-translate-y-1 ${
                isProcessing ? 'ring-2 ring-primary pointer-events-none opacity-80' : 'hover:ring-2 ring-primary cursor-pointer'
              }`}
            >
              {roleIcons[roleName as keyof typeof roleIcons] || <PencilRuler className="w-10 h-10 text-primary mb-4 mx-auto" />}
              <h3 className="text-xl font-bold mb-2">{roleName}</h3>
              <p className="text-muted-foreground text-sm">
                {/* Đây là nơi bạn có thể thêm mô tả động nếu cần */}
              </p>
              {isProcessing ? (
                <p className="text-xs text-muted-foreground mt-3">Đang chuẩn bị bài đánh giá...</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default RoleSelectionScreen;