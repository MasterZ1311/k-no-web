import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type { AuthStatus, KanoUser } from '../preload/types';

export class AuthService {
  private manager: SupabaseManager;
  private listeners: Set<(status: AuthStatus) => void> = new Set();
  private authStateSubscription: { unsubscribe: () => void } | null = null;

  constructor(manager: SupabaseManager = defaultSupabaseManager) {
    this.manager = manager;
    this.setupAuthListener();
    this.handleCallbackIfPresent();
  }

  private setupAuthListener(): void {
    const client = this.manager.getClient();
    if (!client) return;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const sanitized = session?.user ? this.sanitizeUser(session.user) : null;
      const status: AuthStatus = {
        isConfigured: true,
        user: sanitized,
      };
      this.notifyListeners(status);
    });

    this.authStateSubscription = subscription;
  }

  private async handleCallbackIfPresent(): Promise<void> {
    if (typeof window === 'undefined') return;
    const client = this.manager.getClient();
    if (!client) return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (!error && data.session?.user) {
          // Clean URL without reload
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          this.notifyListeners({
            isConfigured: true,
            user: this.sanitizeUser(data.session.user),
          });
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error during auth callback exchange:', err);
    }
  }

  public sanitizeUser(user: SupabaseUser): KanoUser {
    return {
      id: user.id,
      email: user.email ?? '',
      displayName: (user.user_metadata?.display_name as string) || (user.user_metadata?.full_name as string) || null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
    };
  }

  public async getStatus(): Promise<AuthStatus> {
    if (!this.manager.isConfigured()) {
      return {
        isConfigured: false,
        user: null,
      };
    }

    const client = this.manager.getClient();
    if (!client) {
      return { isConfigured: false, user: null };
    }

    try {
      const {
        data: { session },
        error,
      } = await client.auth.getSession();
      if (error) {
        return { isConfigured: true, user: null, error: error.message };
      }

      return {
        isConfigured: true,
        user: session?.user ? this.sanitizeUser(session.user) : null,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown auth status error';
      return { isConfigured: true, user: null, error: msg };
    }
  }

  public async signIn(email: string, password: string): Promise<{ success: boolean; user?: KanoUser; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured. Please configure your Supabase URL and Anon Key.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'No user record returned from authentication service.' };
      }

      return {
        success: true,
        user: this.sanitizeUser(data.user),
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Sign in failed' };
    }
  }

  public async signUp(
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ success: boolean; user?: KanoUser; requiresEmailVerification?: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName?.trim() || null,
          },
          emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Registration failed to return user.' };
      }

      const requiresEmailVerification = !data.session;
      return {
        success: true,
        user: this.sanitizeUser(data.user),
        requiresEmailVerification,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Sign up failed' };
    }
  }

  public async signOut(): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: true };
    }

    const client = this.manager.getClient()!;
    try {
      await client.auth.signOut();
      this.notifyListeners({ isConfigured: true, user: null });
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Sign out error' };
    }
  }

  public async resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: origin ? `${origin}/auth/callback` : undefined,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Password reset failed' };
    }
  }

  public async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Password update failed' };
    }
  }

  public onAuthStateChange(callback: (status: AuthStatus) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(status: AuthStatus): void {
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('[AuthService] Error in auth change listener:', err);
      }
    }
  }

  public cleanup(): void {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
    this.listeners.clear();
  }
}

export const defaultAuthService = new AuthService();
