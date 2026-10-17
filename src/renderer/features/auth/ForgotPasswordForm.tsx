import React, { useState } from 'react';
import { Mail, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { useAuth } from './AuthContext';

interface ForgotPasswordFormProps {
  onBackToSignIn: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToSignIn }) => {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide your account email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await resetPasswordForEmail(email);
      if (!result.success) {
        setError(result.error || 'Failed to send reset link.');
      } else {
        setIsSuccess(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset password failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center py-2">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-kano-text-primary">
            Password Reset Email Sent
          </h2>
          <p className="text-xs text-kano-text-muted leading-relaxed">
            We sent instructions to <span className="font-medium text-kano-text-primary">{email}</span>. Click the link in the email to set a new password.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={onBackToSignIn}
          className="w-full flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Sign In</span>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <p className="text-xs text-kano-text-muted leading-relaxed">
        Enter the email associated with your account, and we will send you a recovery link to reset your password.
      </p>

      <div className="space-y-1">
        <label htmlFor="forgot-email" className="block text-xs font-medium text-kano-text-secondary">
          Account Email
        </label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          iconLeft={<Mail className="w-4 h-4" />}
          autoComplete="email"
          disabled={isSubmitting}
          required
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 h-10 text-sm font-medium whitespace-nowrap shrink-0"
      >
        <span>{isSubmitting ? 'Sending Link...' : 'Send Recovery Link'}</span>
      </Button>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onBackToSignIn}
          className="inline-flex items-center gap-1 text-xs text-kano-text-secondary hover:text-kano-text-primary"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </button>
      </div>
    </form>
  );
};
