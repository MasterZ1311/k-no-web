import React from 'react';
import { MailCheck, ArrowLeft } from 'lucide-react';
import { Button } from '../../design-system/Button';

interface VerifyEmailNoticeProps {
  email: string;
  onBackToSignIn: () => void;
}

export const VerifyEmailNotice: React.FC<VerifyEmailNoticeProps> = ({ email, onBackToSignIn }) => {
  return (
    <div className="space-y-4 text-center py-2">
      <div className="w-12 h-12 rounded-full bg-kano-accent/10 text-kano-accent flex items-center justify-center mx-auto">
        <MailCheck className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-kano-text-primary">
          Check Your Email
        </h2>
        <p className="text-xs text-kano-text-muted leading-relaxed">
          We sent a verification link to <span className="font-medium text-kano-text-primary">{email}</span>. Please verify your address to complete your registration.
        </p>
      </div>

      <div className="p-3 bg-kano-bg rounded-lg border border-kano-border text-[11px] text-kano-text-secondary leading-relaxed">
        Once verified, you will be able to log in to your account and collaborate in private rooms.
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
};
