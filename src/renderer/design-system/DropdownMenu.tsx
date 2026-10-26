import React, { useState, useRef, useEffect } from 'react';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: (DropdownMenuItem | 'separator')[];
  align?: 'left' | 'right';
  className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = 'left',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={`absolute z-40 mt-1 min-w-[180px] max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto bg-kano-surface border border-kano-border rounded-md shadow-popup py-1 select-none focus:outline-none ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, idx) => {
            if (item === 'separator') {
              return <div key={`sep-${idx}`} className="my-1 border-t border-kano-border" role="separator" />;
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-sm text-left transition-colors whitespace-nowrap ${
                  item.danger
                    ? 'text-kano-danger hover:bg-kano-danger-subtle'
                    : 'text-kano-text-primary hover:bg-kano-surface-hover'
                } disabled:opacity-40 disabled:pointer-events-none`}
              >
                <div className="flex items-center gap-2">
                  {item.icon && <span className="text-kano-text-muted">{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-kano-surface-hover text-kano-text-muted">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
