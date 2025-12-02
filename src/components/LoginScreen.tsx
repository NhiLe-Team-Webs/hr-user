import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useLanguage } from '../hooks/useLanguage';
import { toast } from './ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type OAuthProvider = 'google' | 'linkedin_oidc';

const LoginScreen: React.FC = () => {
  const { t } = useLanguage();
  const { status, signInWithProvider, signUp, signInWithPassword, resendVerificationEmail } = useAuth();
  const [isLoading, setIsLoading] = useState({
    google: false,
    linkedin: false,
    emailAuth: false,
    resend: false,
  });
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  // LoginRoute in Router.tsx handles redirecting logged-in users
  // No need to manually redirect here to avoid loops

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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors = {
      name: '',
      email: '',
      password: '',
    };

    if (mode === 'register' && !formData.name.trim()) {
      newErrors.name = t('loginScreen.nameRequiredError');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('loginScreen.invalidEmailError');
    } else if (!validateEmail(formData.email)) {
      newErrors.email = t('loginScreen.invalidEmailError');
    }

    if (!formData.password) {
      newErrors.password = t('loginScreen.weakPasswordError');
    } else if (formData.password.length < 8) {
      newErrors.password = t('loginScreen.weakPasswordError');
    }

    setErrors(newErrors);
    return !newErrors.name && !newErrors.email && !newErrors.password;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading((prev) => ({ ...prev, emailAuth: true }));

    try {
      if (mode === 'register') {
        const { error } = await signUp(formData.email, formData.password, formData.name);

        if (error) {
          if (error === 'duplicate_email') {
            toast({
              title: t('loginScreen.error'),
              description: t('loginScreen.duplicateEmailError'),
              variant: 'destructive',
            });
          } else if (error === 'signups_disabled') {
            toast({
              title: t('loginScreen.error'),
              description: t('loginScreen.signupsDisabledError'),
              variant: 'destructive',
            });
          } else if (error === 'email_confirmation_required') {
            toast({
              title: t('loginScreen.emailConfirmationTitle'),
              description: t('loginScreen.emailConfirmationMessage').replace('{email}', formData.email),
              duration: 10000, // Show longer for important message
            });
            // Switch to login mode after successful registration
            setMode('login');
            setFormData({ name: '', email: '', password: '' });
          } else {
            toast({
              title: t('loginScreen.error'),
              description: t('loginScreen.registrationError'),
              variant: 'destructive',
            });
          }
        } else {
          // Registration successful and user is logged in
          toast({
            title: t('loginScreen.registrationSuccess'),
          });
          // Router will handle navigation based on assessment state
          // Don't navigate manually to avoid redirect loops
        }
      } else {
        const { error } = await signInWithPassword(formData.email, formData.password);

        if (error) {
          if (error === 'invalid_credentials') {
            toast({
              title: t('loginScreen.error'),
              description: t('loginScreen.loginError'),
              variant: 'destructive',
            });
          } else if (error === 'email_not_verified' || error === 'email_not_confirmed') {
            toast({
              title: t('loginScreen.emailConfirmationTitle'),
              description: t('loginScreen.emailNotConfirmedError'),
              variant: 'destructive',
              duration: 10000,
              action: (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white text-black border-white hover:bg-gray-100"
                  onClick={async () => {
                    setIsLoading((prev) => ({ ...prev, resend: true }));
                    await resendVerificationEmail(formData.email);
                    setIsLoading((prev) => ({ ...prev, resend: false }));
                    toast({
                      title: t('loginScreen.emailSent'),
                      description: t('loginScreen.checkInbox'),
                    });
                  }}
                >
                  {t('loginScreen.resendButton')}
                </Button>
              ),
            });
          } else {
            toast({
              title: t('loginScreen.error'),
              description: t('loginScreen.genericError'),
              variant: 'destructive',
            });
          }
        } else {
          // Login successful, Router will handle navigation based on assessment state
          // Don't navigate manually to avoid redirect loops
        }
      }
    } catch (error) {
      console.error('Email auth error:', error);
      toast({
        title: t('loginScreen.error'),
        description: t('loginScreen.genericError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading((prev) => ({ ...prev, emailAuth: false }));
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setErrors({ name: '', email: '', password: '' });
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
      <h2 className="text-3xl font-bold mb-3 tracking-tight">
        {mode === 'register' ? t('loginScreen.registerTitle') : t('loginScreen.loginTitle')}
      </h2>
      <p className="text-muted-foreground mb-8">{t('loginScreen.subtitle')}</p>

      {/* Email/Password Form */}
      <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
        {mode === 'register' && (
          <div className="text-left">
            <Label htmlFor="name">{t('loginScreen.nameLabel')}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t('loginScreen.namePlaceholder')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading.emailAuth || status !== 'ready'}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>
        )}

        <div className="text-left">
          <Label htmlFor="email">{t('loginScreen.emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t('loginScreen.emailInputPlaceholder')}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={isLoading.emailAuth || status !== 'ready'}
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        <div className="text-left">
          <Label htmlFor="password">{t('loginScreen.passwordLabel')}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('loginScreen.passwordPlaceholder')}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={isLoading.emailAuth || status !== 'ready'}
              className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading.emailAuth || status !== 'ready'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
        </div>

        <Button
          type="submit"
          disabled={isLoading.emailAuth || status !== 'ready'}
          className="w-full"
        >
          {isLoading.emailAuth
            ? t('loginScreen.loading')
            : mode === 'register'
              ? t('loginScreen.registerButton')
              : t('loginScreen.loginButton')}
        </Button>

        <button
          type="button"
          onClick={toggleMode}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          disabled={isLoading.emailAuth}
        >
          {mode === 'register' ? t('loginScreen.switchToLogin') : t('loginScreen.switchToRegister')}
        </button>
      </form>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-muted-foreground">{t('loginScreen.orDivider')}</span>
        </div>
      </div>

      {/* OAuth Buttons */}
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
