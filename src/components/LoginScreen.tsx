import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Linkedin } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useLanguage } from '../hooks/useLanguage';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { toast } from './ui/use-toast'; // Assuming shadcn/ui toast

interface LoginScreenProps {
  onRoleSelectionClick?: () => void; // Optional, kept for compatibility
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onRoleSelectionClick }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState({
    email: false,
    google: false,
    linkedin: false,
  });

  // Check session on mount and redirect if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/role-selection');
      }
    };
    checkSession();
  }, [navigate]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('User session:', session.user);
        navigate('/role-selection');
      } else if (event === 'SIGNED_OUT') {
        navigate('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Force sign-out before new authentication attempt
  const forceSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
      toast({
        title: t('loginScreen.error'),
        description: t('loginScreen.signOutError'),
        variant: 'destructive',
      });
    }
  };

  // Email Sign-Up / Sign-In (Passwordless with Magic Link)
  const handleEmailAuth = async () => {
    if (!email.trim()) {
      toast({
        title: t('loginScreen.error'),
        description: t('loginScreen.enterEmail'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading((prev) => ({ ...prev, email: true }));
    await forceSignOut(); // Clear existing session

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/role-selection`,
      },
    });

    setIsLoading((prev) => ({ ...prev, email: false }));
    if (error) {
      toast({
        title: t('loginScreen.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('loginScreen.checkEmail'),
        description: t('loginScreen.checkEmailDescription'),
      });
      setEmail('');
      if (onRoleSelectionClick) onRoleSelectionClick(); // Trigger role selection if provided
    }
  };

  // OAuth Sign-In / Sign-Up (Google or LinkedIn)
  const handleOAuthLogin = async (provider: 'google' | 'linkedin_oidc') => {
    setIsLoading((prev) => ({ ...prev, [provider]: true }));
    await forceSignOut(); // Clear existing session

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/role-selection`,
      },
    });

    setIsLoading((prev) => ({ ...prev, [provider]: false }));
    if (error) {
      toast({
        title: t('loginScreen.error'),
        description: error.message,
        variant: 'destructive',
      });
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
        {/* Email Input Form */}
        <div className="space-y-2">
          <Input
            type="email"
            placeholder={t('loginScreen.enterEmail')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full"
            aria-label={t('loginScreen.enterEmail')}
            disabled={isLoading.email}
          />
          <Button
            onClick={handleEmailAuth}
            disabled={isLoading.email || !email.trim()}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50"
            aria-label={t('loginScreen.emailCta')}
          >
            <Mail className="w-5 h-5 text-gray-600" />
            <span>{isLoading.email ? t('loginScreen.loading') : t('loginScreen.emailCta')}</span>
          </Button>
        </div>

        {/* Google Login Button */}
        <Button
          onClick={() => handleOAuthLogin('google')}
          disabled={isLoading.google}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 bg-white border-gray-300 hover:bg-gray-50 shadow-sm"
          aria-label={t('loginScreen.googleCta')}
        >
          <FcGoogle size={20} />
          <span>{isLoading.google ? t('loginScreen.loading') : t('loginScreen.googleCta')}</span>
        </Button>

        {/* LinkedIn Login Button */}
        <Button
          onClick={() => handleOAuthLogin('linkedin_oidc')}
          disabled={isLoading.linkedin}
          className="w-full flex items-center justify-center gap-2 bg-[#0A66C2] text-white border-[#0A66C2] hover:bg-[#004B87]"
          aria-label={t('loginScreen.linkedinCta')}
        >
          <Linkedin className="w-5 h-5" />
          <span>{isLoading.linkedin ? t('loginScreen.loading') : t('loginScreen.linkedinCta')}</span>
        </Button>
      </div>
    </motion.div>
  );
};

export default LoginScreen;