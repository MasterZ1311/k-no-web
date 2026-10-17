import React, { useState } from 'react';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { VerifyEmailNotice } from './VerifyEmailNotice';

type AuthView = 'signIn' | 'signUp' | 'forgotPassword' | 'verifyPending';

export const AuthContainer: React.FC = () => {
  const [view, setView] = useState<AuthView>('signIn');
  const [pendingEmail, setPendingEmail] = useState<string>('');

  const getTitle = () => {
    switch (view) {
      case 'signIn':
        return 'Sign In to káno̱';
      case 'signUp':
        return 'Create your Account';
      case 'forgotPassword':
        return 'Recover Account';
      case 'verifyPending':
        return 'Verification Required';
    }
  };

  const getSubtitle = () => {
    switch (view) {
      case 'signIn':
        return 'Enter your credentials to access your workspaces';
      case 'signUp':
        return 'Start organizing notes, tasks, and private rooms';
      case 'forgotPassword':
        return 'Receive a password reset link in your email';
      case 'verifyPending':
        return 'Confirm your email to complete registration';
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-screen flex items-center justify-center bg-kano-bg p-4 sm:p-6 overflow-y-auto text-kano-text-primary">
      <div className="max-w-md w-full my-auto bg-kano-surface border border-kano-border rounded-xl shadow-card p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <img
              src="/logo-mark.svg"
              alt="káno̱ logo"
              className="w-12 h-12 object-contain drop-shadow-sm"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-kano-text-primary">
              {getTitle()}
            </h1>
            <p className="text-xs text-kano-text-muted mt-1">
              {getSubtitle()}
            </p>
          </div>
        </div>

        {/* View Switcher */}
        {view === 'signIn' && (
          <SignInForm
            onSwitchToSignUp={() => setView('signUp')}
            onSwitchToForgotPassword={() => setView('forgotPassword')}
          />
        )}

        {view === 'signUp' && (
          <SignUpForm
            onSwitchToSignIn={() => setView('signIn')}
            onVerificationRequired={(email) => {
              setPendingEmail(email);
              setView('verifyPending');
            }}
          />
        )}

        {view === 'forgotPassword' && (
          <ForgotPasswordForm onBackToSignIn={() => setView('signIn')} />
        )}

        {view === 'verifyPending' && (
          <VerifyEmailNotice
            email={pendingEmail}
            onBackToSignIn={() => setView('signIn')}
          />
        )}
      </div>
    </div>
  );
};
