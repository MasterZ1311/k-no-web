import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { useAuth } from './AuthContext';

interface SignInFormProps {
  onSwitchToSignUp: () => void;
  onSwitchToForgotPassword: () => void;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  onSwitchToSignUp,
  onSwitchToForgotPassword,
}) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setError(result.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in error');
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <div className="space-y-1">
        <label htmlFor="signin-email" className="block text-xs font-medium text-kano-text-secondary">
          Email Address
        </label>
        <Input
          id="signin-email"
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

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="signin-password" className="block text-xs font-medium text-kano-text-secondary">
            Password
          </label>
          <button
            type="button"
            onClick={onSwitchToForgotPassword}
            className="text-xs text-kano-accent hover:underline font-medium focus:outline-none"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="signin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          iconLeft={<Lock className="w-4 h-4" />}
          autoComplete="current-password"
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
        <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
        {!isSubmitting && <ArrowRight className="w-4 h-4" />}
      </Button>

      <div className="text-center pt-2">
        <span className="text-xs text-kano-text-muted">Don&apos;t have an account? </span>
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-xs font-medium text-kano-accent hover:underline focus:outline-none"
        >
          Create an account
        </button>
      </div>
    </form>
  );
};
