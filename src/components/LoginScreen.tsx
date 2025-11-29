import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import { toast } from './ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type OAuthProvider = 'google' | 'linkedin_oidc';

const LoginScreen: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { status, user, signInWithProvider } = useAuth();
  const [isLoading, setIsLoading] = useState({
    google: false,
    linkedin: false,
  });
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (status === 'ready' && user && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      toast({
        title: t('loginScreen.alreadySignedIn'),
      });
      navigate('/result', { replace: true });
    }
  }, [status, user, navigate, t]);

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    const key = provider === 'google' ? 'google' : 'linkedin';
    setIsLoading((prev) => ({ ...prev, [key]: true }));
    toast({ title: t('loginScreen.oauthInProgress') });

    const { error } = await signInWithProvider(provider);

    if (error) {
      toast({
        title: t('loginScreen.error'),
        description: t('loginScreen.genericError'),
        variant: 'destructive',
      });
      setIsLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <motion.div
      key="login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center apple-card p-8 md:p-12 max-w-md mx-auto"
    >
      <h2 className="text-3xl font-bold mb-3 tracking-tight">{t('loginScreen.title')}</h2>
      <p className="text-muted-foreground mb-8">{t('loginScreen.subtitle')}</p>
      <div className="space-y-4">
        <Button
          onClick={() => handleOAuthLogin('google')}
          disabled={isLoading.google || status !== 'ready'}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 bg-white border-gray-300 hover:bg-gray-50 shadow-sm"
          aria-label={t('loginScreen.googleCta')}
        >
          <FcGoogle size={20} />
          <span>{isLoading.google ? t('loginScreen.loading') : t('loginScreen.googleCta')}</span>
        </Button>
      </div>
    </motion.div>
  );
};

export default LoginScreen;
