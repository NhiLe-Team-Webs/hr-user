import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type AuthStatus = 'loading' | 'ready';

type OAuthProvider = 'google' | 'linkedin_oidc';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signInWithProvider: (provider: OAuthProvider) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const toFriendlyMessage = () => 'Unable to process the request right now. Please try again shortly.';

export const AuthProvider = ({ children }: PropsWithChildren<unknown>) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    console.log('[AuthContext] Initializing...');

    const syncSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        console.log('[AuthContext] getSession result:', {
          hasSession: !!data?.session,
          userId: data?.session?.user?.id,
          email: data?.session?.user?.email,
          error: error?.message,
        });
        
        if (!isMounted) {
          return;
        }
        if (error) {
          console.error('[AuthContext] Supabase session error:', error);
        }
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      } finally {
        if (isMounted) {
          setStatus('ready');
          console.log('[AuthContext] Status set to ready');
        }
      }
    };

    void syncSession();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('[AuthContext] Auth state changed:', event, {
        hasSession: !!nextSession,
        userId: nextSession?.user?.id,
        email: nextSession?.user?.email,
      });
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStatus('ready');
    });

    const subscription = data?.subscription;

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);



  const signInWithProvider = async (provider: OAuthProvider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/role-selection`,
        },
      });

      if (error) {
        console.error('Supabase OAuth sign-in error:', error);
        return { error: toFriendlyMessage() };
      }

      return {};
    } catch (error) {
      console.error('Unexpected OAuth sign-in error:', error);
      return { error: toFriendlyMessage() };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/role-selection`,
          data: {
            full_name: fullName || '',
          },
        },
      });

      if (error) {
        console.error('Supabase sign-up error:', error);
        
        // Handle specific error cases
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          return { error: 'duplicate_email' };
        }
        
        if (error.message.includes('Signups not allowed')) {
          return { error: 'signups_disabled' };
        }
        
        return { error: toFriendlyMessage() };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        console.log('[AuthContext] Email confirmation required for:', email);
        return { error: 'email_confirmation_required' };
      }

      console.log('[AuthContext] Sign-up successful:', {
        userId: data.user?.id,
        email: data.user?.email,
      });

      return {};
    } catch (error) {
      console.error('Unexpected sign-up error:', error);
      return { error: toFriendlyMessage() };
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase sign-in error:', error);
        
        // Handle specific error cases
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'invalid_credentials' };
        }
        
        if (error.message.includes('Email not confirmed')) {
          return { error: 'email_not_confirmed' };
        }
        
        return { error: toFriendlyMessage() };
      }

      console.log('[AuthContext] Sign-in successful:', {
        userId: data.user?.id,
        email: data.user?.email,
      });

      return {};
    } catch (error) {
      console.error('Unexpected sign-in error:', error);
      return { error: toFriendlyMessage() };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase sign-out error:', error);
    }
  };

  const value = useMemo(
    () => ({
      status,
      session,
      user,
      signInWithProvider,
      signUp,
      signInWithPassword,
      signOut,
    }),
    [session, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
