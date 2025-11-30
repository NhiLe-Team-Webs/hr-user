/**
 * Backend API Authentication Client
 *
 * This client handles all authentication through the backend API
 * No direct Supabase client dependencies
 */

import { apiClient } from './httpClient';
import { supabase } from './supabaseClient';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  created_at?: string;
}

export interface Session {
  access_token: string;
  refresh_token?: string;
  user: User;
  expires_at?: number;
}

/**
 * Authentication functions using backend API
 */
export const auth = {
  /**
   * Sign in with email and password
   */
  signIn: async (email: string, password: string) => {
    try {
      const response = await apiClient.post<{ success: boolean; data: { user: User; session: { access_token: string; refresh_token: string; expires_in: number; expires_at: number } } }>('/hr/auth/login', {
        email,
        password,
      });

      // Backend returns { success: true, data: { user, session } }
      // Transform to Session format expected by frontend
      return {
        access_token: response.data.session.access_token,
        refresh_token: response.data.session.refresh_token,
        user: response.data.user,
        expires_at: response.data.session.expires_at,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  /**
   * Register new user
   */
  signUp: async (email: string, password: string, fullName: string) => {
    try {
      const response = await apiClient.post<{ success: boolean; data: { user: User; session: { access_token: string; refresh_token: string; expires_in: number; expires_at: number } } }>('/hr/auth/register', {
        email,
        password,
        full_name: fullName,
      });

      // Backend returns { success: true, data: { user, session } }
      // Transform to Session format expected by frontend
      return {
        access_token: response.data.session.access_token,
        refresh_token: response.data.session.refresh_token,
        user: response.data.user,
        expires_at: response.data.session.expires_at,
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    try {
      await apiClient.post('/hr/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  /**
   * Get current session
   */
  getSession: async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data: { user: User; session: { access_token: string; refresh_token: string; expires_in: number; expires_at: number } } }>('/hr/auth/session', { skipAuthRedirect: true });

      // Backend returns { success: true, data: { user, session } }
      // Transform to Session format expected by frontend
      return {
        access_token: response.data.session.access_token,
        refresh_token: response.data.session.refresh_token,
        user: response.data.user,
        expires_at: response.data.session.expires_at,
      };
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  },

  /**
   * Refresh token
   */
  refreshToken: async (refreshToken: string) => {
    try {
      const response = await apiClient.post<{ success: boolean; data: { user: User; session: { access_token: string; refresh_token: string; expires_in: number; expires_at: number } } }>('/hr/auth/refresh', {
        refresh_token: refreshToken,
      });

      // Backend returns { success: true, data: { user, session } }
      // Transform to Session format expected by frontend
      return {
        access_token: response.data.session.access_token,
        refresh_token: response.data.session.refresh_token,
        user: response.data.user,
        expires_at: response.data.session.expires_at,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  },

  /**
   * Resend verification email
   */
  resendVerificationEmail: async (email: string) => {
    try {
      await apiClient.post('/hr/auth/resend-verification', { email });
      return {};
    } catch (error) {
      console.error('Resend verification error:', error);
      throw error;
    }
  },

  /**
   * Get current user
   */
  getUser: async (accessToken?: string) => {
    try {
      const response = await apiClient.get<{ user: User }>('/hr/auth/user', { skipAuthRedirect: true });
      return response.user;
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  },
};

/**
 * OAuth functions using Supabase client directly
 */
export const oauth = {
  /**
   * Sign in with OAuth provider (Google, etc.)
   */
  signInWithProvider: async (provider: 'google' | 'linkedin_oidc') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: false,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('OAuth sign-in error:', error);
      throw error;
    }
  },

  /**
   * Handle OAuth callback
   */
  handleCallback: async (code: string, state: string) => {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) throw error;

      if (!data.session || !data.user) {
        throw new Error('No session returned from Supabase');
      }

      // Call backend to ensure user record exists
      // We must pass the token explicitly as it's not in localStorage yet
      await apiClient.post('/hr/candidates/ensure', {
        auth_id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata.full_name || data.user.user_metadata.name || data.user.email,
      }, {
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`
        }
      });

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email!,
          full_name: data.user.user_metadata.full_name,
          role: 'candidate',
        },
        expires_at: data.session.expires_at,
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw error;
    }
  },

  /**
   * Sign out from OAuth session
   */
  signOut: async () => {
    try {
      await supabase.auth.signOut();
      // Also notify backend to clear any cookies if they exist
      await apiClient.post('/hr/auth/logout').catch(() => { });
    } catch (error) {
      console.error('OAuth sign-out error:', error);
      throw error;
    }
  },

  /**
   * Get current OAuth session
   */
  getSession: async () => {
    try {
      const { data } = await supabase.auth.getSession();

      if (data.session && data.session.user) {
        return {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user: {
            id: data.session.user.id,
            email: data.session.user.email!,
            full_name: data.session.user.user_metadata.full_name,
            role: 'candidate',
          },
          expires_at: data.session.expires_at,
        };
      }
      return null;
    } catch (error) {
      console.error('OAuth session error:', error);
      return null;
    }
  },
};

/**
 * Auth state change listener (simplified version)
 */
const authStateChangeCallbacks: ((event: string, session: Session | null) => void)[] = [];

export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
  authStateChangeCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    const index = authStateChangeCallbacks.indexOf(callback);
    if (index > -1) {
      authStateChangeCallbacks.splice(index, 1);
    }
  };
};

/**
 * Trigger auth state change (for internal use)
 */
export const triggerAuthStateChange = (event: string, session: Session | null) => {
  authStateChangeCallbacks.forEach(callback => {
    try {
      callback(event, session);
    } catch (error) {
      console.error('Auth state change callback error:', error);
    }
  });
};