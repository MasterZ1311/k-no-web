import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { AuthService } from '../src/services/authService';
import { SupabaseManager } from '../src/services/supabaseClient';
import { App } from '../src/renderer/App';
import { SignInForm } from '../src/renderer/features/auth/SignInForm';
import { SignUpForm } from '../src/renderer/features/auth/SignUpForm';
import { ForgotPasswordForm } from '../src/renderer/features/auth/ForgotPasswordForm';
import { UnconfiguredView } from '../src/renderer/features/auth/UnconfiguredView';
import { AuthProvider } from '../src/renderer/features/auth/AuthContext';
import { ToastProvider } from '../src/renderer/design-system/ToastProvider';

describe('káno̱ Web Authentication & Session Handling', () => {
  // --------------------------------------------------------------------------
  // 1. AuthService & Input Sanitization
  // --------------------------------------------------------------------------
  describe('AuthService', () => {
    it('returns isConfigured: false when Supabase environment variables are missing', async () => {
      const manager = new SupabaseManager();
      manager.setCustomClient(null, false);

      const authService = new AuthService(manager);
      const status = await authService.getStatus();

      expect(status.isConfigured).toBe(false);
      expect(status.user).toBeNull();
    });

    it('sanitizes user metadata, never leaking raw tokens or private fields', () => {
      const manager = new SupabaseManager();
      const authService = new AuthService(manager);

      const rawUser = {
        id: 'usr-42',
        email: 'researcher@kano.app',
        user_metadata: {
          display_name: 'Grace Hopper',
          private_token_leak: 'secret123',
        },
        email_confirmed_at: '2026-02-01T12:00:00Z',
        aud: 'authenticated',
        role: 'authenticated',
      };

      const sanitized = authService.sanitizeUser(rawUser as any);
      expect(sanitized).toEqual({
        id: 'usr-42',
        email: 'researcher@kano.app',
        displayName: 'Grace Hopper',
        emailConfirmedAt: '2026-02-01T12:00:00Z',
      });
      expect((sanitized as any).private_token_leak).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Renderer Auth UI States & Forms
  // --------------------------------------------------------------------------
  describe('Auth UI Components', () => {
    it('renders UnconfiguredView when backend is not configured', () => {
      render(
        <ToastProvider>
          <AuthProvider initialStatus={{ isConfigured: false, user: null }}>
            <UnconfiguredView />
          </AuthProvider>
        </ToastProvider>
      );

      expect(screen.getByRole('heading', { name: /Connect káno̱ Web/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/supabase\.co/i)).toBeInTheDocument();
    });

    it('renders SignInForm and validates required fields', async () => {
      const handleSwitch = vi.fn();
      render(
        <ToastProvider>
          <AuthProvider initialStatus={{ isConfigured: true, user: null }}>
            <SignInForm onSwitchToSignUp={handleSwitch} onSwitchToForgotPassword={vi.fn()} />
          </AuthProvider>
        </ToastProvider>
      );

      const submitBtn = screen.getByRole('button', { name: /Sign In/i });
      const form = submitBtn.closest('form')!;
      fireEvent.submit(form);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Please enter your email address/i)).toBeInTheDocument();
    });

    it('renders SignUpForm and validates minimum password length', async () => {
      render(
        <ToastProvider>
          <AuthProvider initialStatus={{ isConfigured: true, user: null }}>
            <SignUpForm onSwitchToSignIn={vi.fn()} onVerificationRequired={vi.fn()} />
          </AuthProvider>
        </ToastProvider>
      );

      const emailInput = screen.getByPlaceholderText('you@domain.com');
      const passInput = screen.getByPlaceholderText(/At least 6 characters/i);
      const submitBtn = screen.getByRole('button', { name: /Create Account/i });

      fireEvent.change(emailInput, { target: { value: 'test@domain.com' } });
      fireEvent.change(passInput, { target: { value: '123' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Password must be at least 6 characters long/i)).toBeInTheDocument();
    });

    it('renders ForgotPasswordForm and displays success confirmation', async () => {
      render(
        <ToastProvider>
          <AuthProvider initialStatus={{ isConfigured: true, user: null }}>
            <ForgotPasswordForm onBackToSignIn={vi.fn()} />
          </AuthProvider>
        </ToastProvider>
      );

      const emailInput = screen.getByPlaceholderText('you@domain.com');
      const sendBtn = screen.getByRole('button', { name: /Send Recovery Link/i });

      fireEvent.change(emailInput, { target: { value: 'recovery@domain.com' } });
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Password Reset Email Sent/i })).toBeInTheDocument();
        expect(screen.getByText(/recovery@domain.com/i)).toBeInTheDocument();
      });
    });

    it('renders AuthContainer when user is unauthenticated', () => {
      render(<App initialStatus={{ isConfigured: true, user: null }} />);

      expect(screen.getByRole('heading', { name: /Sign In to káno̱/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });
  });
});
