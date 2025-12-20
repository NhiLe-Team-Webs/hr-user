import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session, User } from '@/lib/authClient';
import { auth, oauth, onAuthStateChange } from '@/lib/authClient';
import { supabase } from '@/lib/supabaseClient';
import { apiClient } from '@/lib/httpClient';

/**
 * NOTE: Backend API Authentication Flow Documentation
 *
 * Why we use backend API:
 * 1. All authentication operations go through backend API
 * 2. Backend provides secure authentication with proper token management
 * 3. Backend handles user creation/update after OAuth callback via /api/hr/auth/oauth/google
 * 4. All auth operations (register, login, refresh, OAuth) go through backend API
 * 5. This keeps all authentication logic centralized in the backend
 */

type AuthStatus = 'loading' | 'ready';

type OAuthProvider = 'google' | 'linkedin_oidc';

interface BackendAuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      full_name: string;
      role: string;
    };
    session: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expires_at: number;
    };
  };
}

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signInWithProvider: (provider: OAuthProvider) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const toFriendlyMessage = () => 'Unable to process request right now. Please try again shortly.';

export const AuthProvider = ({ children }: PropsWithChildren<unknown>) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    console.log('[AuthContext] Initializing...');

    const syncSession = async () => {
      try {
        // First check for tokens in localStorage (from backend auth)
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');

        if (accessToken && refreshToken) {
          // We have backend tokens, validate them with backend
          console.log('[AuthContext] Found stored tokens from backend auth, validating...');

          // Validate token with backend
          try {
            const user = await auth.getUser(accessToken);

            if (user) {
              // Token is valid, create a session object
              const backendSession: Session = {
                access_token: accessToken,
                refresh_token: refreshToken,
                user,
              };

              setSession(backendSession);
              setUser(user);
              console.log('[AuthContext] Backend tokens validated successfully');
            } else {
              // Token is invalid, clear it
              console.warn('[AuthContext] Backend tokens invalid, clearing...');
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');

              setSession(null);
              setUser(null);
            }
          } catch (error) {
            console.warn('[AuthContext] Token validation failed:', error);
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');

            setSession(null);
            setUser(null);
          }
        } else {
          // No tokens found, user is not logged in
          setSession(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setStatus('ready');
          console.log('[AuthContext] Status set to ready');
        }
      }
    };

    void syncSession();

    const unsubscribe = onAuthStateChange((event, nextSession) => {
      console.log('[AuthContext] Auth state changed:', event, {
        hasSession: !!nextSession,
        userId: nextSession?.user?.id,
        email: nextSession?.user?.email,
      });

      // Store tokens in localStorage for httpClient to use
      if (nextSession) {
        localStorage.setItem('access_token', nextSession.access_token);
        localStorage.setItem('refresh_token', nextSession.refresh_token || '');
      } else {
        // Clear tokens on sign out
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStatus('ready');
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);



  const signInWithProvider = async (provider: OAuthProvider) => {
    try {
      // For OAuth, we use dedicated oauth functions
      // The backend will handle user creation/update after OAuth callback
      await oauth.signInWithProvider(provider);
      return {};
    } catch (error) {
      console.error('Unexpected OAuth sign-in error:', error);
      return { error: toFriendlyMessage() };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const backendSession = await auth.signUp(email, password, fullName || '');

      if (backendSession) {
        // Store tokens in localStorage
        localStorage.setItem('access_token', backendSession.access_token);
        localStorage.setItem('refresh_token', backendSession.refresh_token || '');

        setSession(backendSession);
        setUser(backendSession.user);

        console.log('[AuthContext] Sign-up successful:', {
          userId: backendSession.user.id,
          email: backendSession.user.email,
        });

        return {};
      }

      return { error: toFriendlyMessage() };
    } catch (error: unknown) {
      console.error('Backend sign-up error:', error);

      // Handle specific error cases from backend
      if (error && typeof error === 'object' && 'payload' in error) {
        const payload = (error as { payload?: { error?: { code?: string; message?: string } } }).payload;
        if (payload?.error?.code === 'VALIDATION_FAILED') {
          if (payload.error.message?.includes('already exists') || payload.error.message?.includes('existing user')) {
            return { error: 'duplicate_email' };
          }
          // Return the actual validation message for other validation errors
          return { error: payload.error.message || 'validation_error' };
        }

        if (payload?.error?.message) {
          return { error: payload.error.message };
        }
      }

      return { error: toFriendlyMessage() };
    }

  };

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const backendSession = await auth.signIn(email, password);

      if (backendSession) {
        // Store tokens in localStorage
        localStorage.setItem('access_token', backendSession.access_token);
        localStorage.setItem('refresh_token', backendSession.refresh_token || '');

        setSession(backendSession);
        setUser(backendSession.user);

        console.log('[AuthContext] Sign-in successful:', {
          userId: backendSession.user.id,
          email: backendSession.user.email,
        });

        return {};
      }

      return { error: toFriendlyMessage() };
    } catch (error: unknown) {
      console.error('Backend sign-in error:', error);

      // Handle specific error cases from backend
      if (error && typeof error === 'object' && 'payload' in error) {
        const payload = (error as { payload?: { error?: { code?: string; message?: string } } }).payload;
        if (payload?.error?.code === 'AUTH_INVALID') {
          return { error: 'invalid_credentials' };
        }

        if (payload?.error?.code === 'USER_NOT_FOUND') {
          return { error: 'invalid_credentials' };
        }

        if (payload?.error?.code === 'EMAIL_NOT_VERIFIED') {
          return { error: 'email_not_verified' };
        }

        if (payload?.error?.message) {
          return { error: payload.error.message };
        }
      }

      return { error: toFriendlyMessage() };
    }
  };

  const signOut = async () => {
    // Clear tokens from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    // Also sign out from backend for all sessions
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Backend sign-out error:', error);
    }

    // Clear local state
    setSession(null);
    setUser(null);
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      return {};
    } catch (error) {
      console.error('Resend verification error:', error);
      return { error: toFriendlyMessage() };
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
      resendVerificationEmail,
    }),
    [session, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export as a named export to avoid React refresh warning
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
