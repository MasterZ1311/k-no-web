import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading workspace...',
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-8 gap-3 text-kano-text-muted ${className}`}
    >
      <Loader2 className="w-6 h-6 animate-spin text-kano-accent" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
};
