import React from 'react';
import { RoutePath } from '../routes/types';
import { Tooltip } from '../design-system/Tooltip';

export interface SidebarNavItemProps {
  path: RoutePath;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  label,
  icon,
  badgeCount,
  isActive,
  isCollapsed,
  onClick,
}) => {
  const content = (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors select-none ${
        isActive
          ? 'bg-kano-accent-subtle text-kano-accent font-semibold'
          : 'text-kano-text-secondary hover:text-kano-text-primary hover:bg-kano-surface-hover'
      } ${isCollapsed ? 'justify-center px-1.5' : ''}`}
    >
      <span className={`w-4 h-4 flex-shrink-0 flex items-center justify-center ${isActive ? 'text-kano-accent' : 'text-kano-text-muted'}`}>
        {icon}
      </span>
      {!isCollapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {!isCollapsed && typeof badgeCount === 'number' && badgeCount > 0 && (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-mono flex-shrink-0 ${
            isActive
              ? 'bg-kano-accent text-white font-bold'
              : 'bg-kano-surface border border-kano-border text-kano-text-muted'
          }`}
        >
          {badgeCount}
        </span>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip content={label} position="right">
        {content}
      </Tooltip>
    );
  }

  return content;
};
