import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, iconLeft, iconRight, id, className = '', disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-kano-text-secondary select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {iconLeft && (
            <div className="absolute left-3 text-kano-text-muted pointer-events-none flex items-center">
              {iconLeft}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full h-9 rounded-md bg-kano-surface text-kano-text-primary text-sm border transition-colors shadow-subtle placeholder:text-kano-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kano-accent focus-visible:border-transparent disabled:opacity-50 disabled:bg-kano-surface-hover ${
              iconLeft ? 'pl-9' : 'pl-3'
            } ${iconRight ? 'pr-9' : 'pr-3'} ${
              error ? 'border-kano-danger ring-1 ring-kano-danger' : 'border-kano-border hover:border-kano-border'
            } ${className}`}
            {...props}
          />
          {iconRight && (
            <div className="absolute right-3 text-kano-text-muted flex items-center">
              {iconRight}
            </div>
          )}
        </div>
        {error && (
          <span role="alert" className="text-xs text-kano-danger font-medium">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
