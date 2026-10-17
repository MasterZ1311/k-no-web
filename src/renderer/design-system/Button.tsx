import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      iconLeft,
      iconRight,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kano-accent focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none';

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs sm:text-sm gap-1.5 font-medium',
      md: 'h-9.5 px-4 text-sm gap-2 font-medium',
      lg: 'h-11 px-5 text-base gap-2.5 font-medium',
    };

    const variantStyles = {
      primary:
        'bg-kano-accent text-kano-accent-text hover:bg-kano-accent-hover shadow-subtle',
      secondary:
        'bg-kano-surface text-kano-text-primary border border-kano-border hover:bg-kano-surface-hover shadow-subtle',
      ghost:
        'text-kano-text-secondary hover:text-kano-text-primary hover:bg-kano-surface-hover',
      danger:
        'bg-kano-danger text-white hover:bg-kano-danger-hover shadow-subtle',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          iconLeft
        )}
        {children}
        {!isLoading && iconRight}
      </button>
    );
  }
);

Button.displayName = 'Button';
