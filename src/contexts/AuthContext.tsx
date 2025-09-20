import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type AuthStatus = 'loading' | 'ready';

type OAuthProvider = 'google' | 'linkedin_oidc';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signInWithEmail: (email: string) => Promise<{ error?: string }>;
  signInWithProvider: (provider: OAuthProvider) => Promise<{ error?: string }>;
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

    const syncSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) {
          return;
        }
        if (error) {
          console.error('Supabase session error:', error);
        }
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      } finally {
        if (isMounted) {
          setStatus('ready');
        }
      }
    };

    void syncSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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

  const signInWithEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/role-selection`,
        },
      });

      if (error) {
        console.error('Supabase email sign-in error:', error);
        return { error: toFriendlyMessage() };
      }

      return {};
    } catch (error) {
      console.error('Unexpected email sign-in error:', error);
      return { error: toFriendlyMessage() };
    }
  };

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
      signInWithEmail,
      signInWithProvider,
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
