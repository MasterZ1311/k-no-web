import React, { useState } from 'react';
import { Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { useAuth } from './AuthContext';

interface SignUpFormProps {
  onSwitchToSignIn: () => void;
  onVerificationRequired: (email: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSwitchToSignIn,
  onVerificationRequired,
}) => {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp(email, password, displayName);
      if (!result.success) {
        setError(result.error || 'Failed to create account.');
      } else if (result.requiresEmailVerification) {
        onVerificationRequired(email);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up error');
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
        <label htmlFor="signup-name" className="block text-xs font-medium text-kano-text-secondary">
          Display Name <span className="text-kano-text-muted">(Optional)</span>
        </label>
        <Input
          id="signup-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Ada Lovelace"
          iconLeft={<User className="w-4 h-4" />}
          autoComplete="name"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="signup-email" className="block text-xs font-medium text-kano-text-secondary">
          Email Address
        </label>
        <Input
          id="signup-email"
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
        <label htmlFor="signup-password" className="block text-xs font-medium text-kano-text-secondary">
          Password
        </label>
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          iconLeft={<Lock className="w-4 h-4" />}
          autoComplete="new-password"
          disabled={isSubmitting}
          required
        />
        <span className="text-[10px] text-kano-text-muted block">
          Use at least 6 characters with mixed characters.
        </span>
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-1.5 py-2"
      >
        <span>{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
        {!isSubmitting && <ArrowRight className="w-4 h-4" />}
      </Button>

      <div className="text-center pt-2">
        <span className="text-xs text-kano-text-muted">Already have an account? </span>
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="text-xs font-medium text-kano-accent hover:underline focus:outline-none"
        >
          Sign in
        </button>
      </div>
    </form>
  );
};
