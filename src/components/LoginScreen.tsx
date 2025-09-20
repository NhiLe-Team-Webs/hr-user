import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Linkedin } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useLanguage } from '../hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import { toast } from './ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type OAuthProvider = 'google' | 'linkedin_oidc';

const LoginScreen: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { status, user, signInWithEmail, signInWithProvider } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState({
    email: false,
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

  const ensureEmail = (value: string) => value.trim().toLowerCase();

  const handleEmailAuth = async () => {
    const cleanedEmail = ensureEmail(email);
    if (!cleanedEmail) {
      toast({
        title: t('loginScreen.error'),
        description: t('loginScreen.emailInvalid'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading((prev) => ({ ...prev, email: true }));
    const { error } = await signInWithEmail(cleanedEmail);
    setIsLoading((prev) => ({ ...prev, email: false }));

    if (error) {
      toast({
        title: t('loginScreen.error'),
        description: t('loginScreen.genericError'),
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('loginScreen.emailSentTitle'),
      description: t('loginScreen.emailSentDescription', { email: cleanedEmail }),
    });
    setEmail('');
  };

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
        <div className="space-y-2">
          <Input
            type="email"
            placeholder={t('loginScreen.enterEmail')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full"
            aria-label={t('loginScreen.enterEmail')}
            disabled={isLoading.email || status !== 'ready'}
          />
          <Button
            onClick={handleEmailAuth}
            disabled={isLoading.email || !email.trim() || status !== 'ready'}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50"
            aria-label={t('loginScreen.emailCta')}
          >
            <Mail className="w-5 h-5 text-gray-600" />
            <span>{isLoading.email ? t('loginScreen.loading') : t('loginScreen.emailCta')}</span>
          </Button>
        </div>

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

        {/* <Button
          onClick={() => handleOAuthLogin('linkedin_oidc')}
          disabled={isLoading.linkedin || status !== 'ready'}
          className="w-full flex items-center justify-center gap-2 bg-[#0A66C2] text-white border-[#0A66C2] hover:bg-[#004B87]"
          aria-label={t('loginScreen.linkedinCta')}
        >
          <Linkedin className="w-5 h-5" />
          <span>{isLoading.linkedin ? t('loginScreen.loading') : t('loginScreen.linkedinCta')}</span>
        </Button> */}
      </div>
    </motion.div>
  );
};

export default LoginScreen;
