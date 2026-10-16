import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthStatus, KanoUser } from '../../../preload/types';

interface AuthContextValue {
  status: AuthStatus | null;
  user: KanoUser | null;
  isConfigured: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ success: boolean; requiresEmailVerification?: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialStatus?: AuthStatus;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialStatus }) => {
  const globalInitial =
    typeof window !== 'undefined'
      ? (window as unknown as { __KANO_INITIAL_AUTH__?: AuthStatus }).__KANO_INITIAL_AUTH__
      : undefined;
  const effectiveInitial = initialStatus ?? globalInitial;

  const [status, setStatus] = useState<AuthStatus | null>(effectiveInitial ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(effectiveInitial !== undefined ? false : true);

  const refreshStatus = useCallback(async () => {
    if (!window.kanoDesktop?.auth) {
      // Running outside Electron without preload bridge
      setStatus({ isConfigured: false, user: null });
      setIsLoading(false);
      return;
    }

    try {
      const currentStatus = await window.kanoDesktop.auth.getStatus();
      setStatus(currentStatus);
    } catch (err) {
      console.error('[AuthContext] Failed to get auth status:', err);
      setStatus({ isConfigured: false, user: null, error: 'Failed to query auth status' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (effectiveInitial === undefined) {
      refreshStatus();
    }

    if (window.kanoDesktop?.auth?.onAuthStateChange) {
      const unsubscribe = window.kanoDesktop.auth.onAuthStateChange((newStatus) => {
        setStatus(newStatus);
        setIsLoading(false);
      });
      return unsubscribe;
    }
  }, [refreshStatus]);

  const signIn = async (email: string, password: string) => {
    if (!window.kanoDesktop?.auth) {
      return { success: false, error: 'Desktop bridge unavailable.' };
    }
    const result = await window.kanoDesktop.auth.signIn(email, password);
    if (result.success && result.user) {
      setStatus({ isConfigured: true, user: result.user });
    }
    return result;
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!window.kanoDesktop?.auth) {
      return { success: false, error: 'Desktop bridge unavailable.' };
    }
    const result = await window.kanoDesktop.auth.signUp(email, password, displayName);
    if (result.success && result.user && !result.requiresEmailVerification) {
      setStatus({ isConfigured: true, user: result.user });
    }
    return result;
  };

  const signOut = async () => {
    if (window.kanoDesktop?.auth) {
      await window.kanoDesktop.auth.signOut();
    }
    setStatus({ isConfigured: true, user: null });
  };

  const resetPasswordForEmail = async (email: string) => {
    if (!window.kanoDesktop?.auth) {
      return { success: false, error: 'Desktop bridge unavailable.' };
    }
    return window.kanoDesktop.auth.resetPasswordForEmail(email);
  };

  const updatePassword = async (newPassword: string) => {
    if (!window.kanoDesktop?.auth) {
      return { success: false, error: 'Desktop bridge unavailable.' };
    }
    return window.kanoDesktop.auth.updatePassword(newPassword);
  };

  const value: AuthContextValue = {
    status,
    user: status?.user ?? null,
    isConfigured: status?.isConfigured ?? false,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    refreshStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
