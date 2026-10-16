import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'ghost' | 'secondary' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'md',
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kano-accent focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none';

    const sizeStyles = {
      sm: 'w-7 h-7 p-1 text-xs',
      md: 'w-8 h-8 p-1.5 text-sm',
      lg: 'w-9 h-9 p-2 text-base',
    };

    const variantStyles = {
      ghost:
        'text-kano-text-secondary hover:text-kano-text-primary hover:bg-kano-surface-hover',
      secondary:
        'bg-kano-surface text-kano-text-primary border border-kano-border hover:bg-kano-surface-hover shadow-subtle',
      primary:
        'bg-kano-accent text-kano-accent-text hover:bg-kano-accent-hover shadow-subtle',
      danger:
        'text-kano-danger hover:bg-kano-danger-subtle',
    };

    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
