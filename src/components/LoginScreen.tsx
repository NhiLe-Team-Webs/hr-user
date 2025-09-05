import React from 'react';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';

interface LoginScreenProps {
  onRoleSelectionClick: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onRoleSelectionClick }) => {
  const { t } = useLanguage();

  return (
    <motion.div
      key="login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center apple-card p-8 md:p-12"
    >
      <h2 className="text-3xl font-bold mb-3 tracking-tight">{t('loginScreen.title')}</h2>
      <p className="text-muted-foreground mb-8">{t('loginScreen.subtitle')}</p>
      <div className="space-y-4 max-w-sm mx-auto">
        <Button
          onClick={onRoleSelectionClick}
          variant="outline"
          className="w-full"
        >
          {t('loginScreen.googleCta')}
        </Button>
        <Button
          onClick={onRoleSelectionClick}
          variant="outline"
          className="w-full"
        >
          <Mail className="w-4 h-4 mr-2" />
          {t('loginScreen.emailCta')}
        </Button>
      </div>
    </motion.div>
  );
};

export default LoginScreen;