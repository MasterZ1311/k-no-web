import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  illustrationSrc?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  illustrationSrc,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto select-none ${className}`}
    >
      {illustrationSrc ? (
        <img
          src={illustrationSrc}
          alt={title}
          className="w-32 h-32 sm:w-36 sm:h-36 object-contain mb-4 select-none pointer-events-none drop-shadow-sm"
        />
      ) : icon ? (
        <div className="w-12 h-12 rounded-xl bg-kano-surface border border-kano-border text-kano-text-muted flex items-center justify-center mb-4 shadow-subtle">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-kano-text-primary mb-1.5">{title}</h3>
      <p className="text-xs text-kano-text-secondary leading-relaxed mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
