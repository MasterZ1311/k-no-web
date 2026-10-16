import React from 'react';
import { Search, PanelLeft, Plus } from 'lucide-react';
import { RoutePath, ROUTES } from '../routes/types';
import { Breadcrumbs } from '../design-system/Breadcrumbs';
import { IconButton } from '../design-system/IconButton';
import { Button } from '../design-system/Button';
import { useToast } from '../design-system/ToastProvider';

interface PageHeaderProps {
  currentRoute: RoutePath;
  onNavigate: (route: RoutePath) => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  onOpenSearch: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  currentRoute,
  onNavigate,
  onToggleSidebar,
  isSidebarCollapsed,
  onOpenSearch,
}) => {
  const meta = ROUTES[currentRoute];
  const { showToast } = useToast();

  const handleAction = () => {
    let actionName = 'New item';
    if (currentRoute === '/notes') actionName = 'Create Note';
    else if (currentRoute === '/tasks') actionName = 'Create Task';
    else if (currentRoute === '/board') actionName = 'Add Board Card';
    else if (currentRoute === '/calendar') actionName = 'Schedule Event';

    showToast(`${actionName} (Local Shell Preview)`, {
      type: 'info',
      description: 'Persistent creation operations will be connected to the domain database in subsequent prompts.',
    });
  };

  return (
    <header className="h-14 border-b border-kano-border bg-kano-surface px-6 flex items-center justify-between flex-shrink-0 select-none">
      <div className="flex items-center gap-3">
        {isSidebarCollapsed && (
          <div className="flex items-center gap-2">
            <IconButton
              aria-label="Expand sidebar"
              variant="ghost"
              size="sm"
              onClick={onToggleSidebar}
            >
              <PanelLeft className="w-4 h-4" />
            </IconButton>
            <img src="/logo-mark.svg" alt="káno̱ mark" className="w-5 h-5 object-contain" />
          </div>
        )}
        <Breadcrumbs
          items={[
            { label: 'Workspace', onClick: () => onNavigate('/notes') },
            { label: meta.breadcrumb, current: true },
          ]}
        />
      </div>

      <div className="flex items-center gap-2.5">
        {/* Search Palette Trigger */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-kano-border bg-kano-bg hover:bg-kano-surface-hover text-kano-text-muted hover:text-kano-text-primary text-xs transition-colors shadow-subtle"
          title="Search or jump to route (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search workspace...</span>
          <kbd className="text-[10px] px-1 py-0.2 rounded bg-kano-surface border border-kano-border font-mono ml-1">
            Ctrl+K
          </kbd>
        </button>

        {/* Contextual Action Button */}
        {['/notes', '/tasks', '/board', '/calendar'].includes(currentRoute) && (
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="w-3.5 h-3.5" />}
            onClick={handleAction}
          >
            {currentRoute === '/notes'
              ? 'New Note'
              : currentRoute === '/tasks'
              ? 'New Task'
              : currentRoute === '/board'
              ? 'Add Card'
              : 'New Event'}
          </Button>
        )}
      </div>
    </header>
  );
};
