// src/components/RoleSelectionScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { PencilRuler, HeartHandshake, ClipboardList } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { Role } from '../types/assessment'; // Import the Role type

interface RoleSelectionScreenProps {
  onRoleSelect: (role: Role) => void;
}

const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ onRoleSelect }) => {
  const { t } = useLanguage();

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
        <div 
          onClick={() => onRoleSelect({ name: 'Content Creator', title: 'Content Creator' })} 
          className="p-6 text-center bg-muted/50 rounded-2xl hover:ring-2 ring-primary cursor-pointer transition-all transform hover:-translate-y-1"
        >
          <PencilRuler className="w-10 h-10 text-primary mb-4 mx-auto" />
          <h3 className="text-xl font-bold mb-2">{t('roles.Content Creator')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('roleSelectionScreen.role1Text')}
          </p>
        </div>
        <div 
          onClick={() => onRoleSelect({ name: 'Customer Support', title: 'Customer Support' })} 
          className="p-6 text-center bg-muted/50 rounded-2xl hover:ring-2 ring-primary cursor-pointer transition-all transform hover:-translate-y-1"
        >
          <HeartHandshake className="w-10 h-10 text-primary mb-4 mx-auto" />
          <h3 className="text-xl font-bold mb-2">{t('roles.Customer Support')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('roleSelectionScreen.role2Text')}
          </p>
        </div>
        <div 
          onClick={() => onRoleSelect({ name: 'Operations', title: 'Operations / Admin' })} 
          className="p-6 text-center bg-muted/50 rounded-2xl hover:ring-2 ring-primary cursor-pointer transition-all transform hover:-translate-y-1"
        >
          <ClipboardList className="w-10 h-10 text-primary mb-4 mx-auto" />
          <h3 className="text-xl font-bold mb-2">{t('roles.Operations')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('roleSelectionScreen.role3Text')}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default RoleSelectionScreen;