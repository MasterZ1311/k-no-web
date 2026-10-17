import React, { useState, useEffect } from 'react';
import { RoutePath } from '../routes/types';
import { Sidebar } from './Sidebar';
import { PageHeader } from './PageHeader';
import { SearchPalette } from './SearchPalette';
import { NotesRoute } from '../routes/NotesRoute';
import { TasksRoute } from '../routes/TasksRoute';
import { BoardRoute } from '../routes/BoardRoute';
import { CalendarRoute } from '../routes/CalendarRoute';
import { ActivityRoute } from '../routes/ActivityRoute';
import { FavoritesRoute } from '../routes/FavoritesRoute';
import { TrashRoute } from '../routes/TrashRoute';
import { SettingsRoute } from '../routes/SettingsRoute';
import { useSettings } from '../features/settings/SettingsContext';
import { BrandBackdrop } from '../design-system/BrandBackdrop';
import { KeyboardShortcutsModal } from '../design-system/KeyboardShortcutsModal';

export const AppShell: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [currentRoute, setCurrentRoute] = useState<RoutePath>('/notes');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(settings.sidebarCollapsed);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Keyboard shortcut listener for global shell operations (Linear & Raycast inspired)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing inside an input, textarea, or rich text editor
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');

      // '?' -> Toggle keyboard shortcuts HUD when not in an active input
      if (event.key === '?' && !isInputActive && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // Ctrl+Shift+L / Cmd+Shift+L -> Toggle light/dark theme
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        const isDark = document.documentElement.classList.contains('dark');
        updateSettings({ theme: isDark ? 'light' : 'dark' });
        return;
      }

      // Ctrl+Shift+N / Cmd+Shift+N -> Jump to Notes
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setCurrentRoute('/notes');
        return;
      }

      // Ctrl+Shift+T / Cmd+Shift+T -> Jump to Tasks
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setCurrentRoute('/tasks');
        return;
      }

      // Ctrl+K / Cmd+K -> Toggle command palette
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      // Ctrl+\ -> Toggle sidebar
      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
        return;
      }

      // Number navigation (Ctrl+1 to Ctrl+5)
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        if (event.key === '1') {
          event.preventDefault();
          setCurrentRoute('/notes');
        } else if (event.key === '2') {
          event.preventDefault();
          setCurrentRoute('/tasks');
        } else if (event.key === '3') {
          event.preventDefault();
          setCurrentRoute('/board');
        } else if (event.key === '4') {
          event.preventDefault();
          setCurrentRoute('/calendar');
        } else if (event.key === '5') {
          event.preventDefault();
          setCurrentRoute('/activity');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateSettings]);

  // Listen to native menu navigation events from Electron main process
  useEffect(() => {
    if (window.kanoDesktop) {
      const unsubscribe = window.kanoDesktop.onNavigate((route) => {
        if (
          [
            '/notes',
            '/tasks',
            '/board',
            '/calendar',
            '/activity',
            '/favorites',
            '/trash',
            '/settings',
          ].includes(route)
        ) {
          setCurrentRoute(route as RoutePath);
        }
      });
      return unsubscribe;
    }
  }, []);

  // Listen to native notification click events from Electron main process
  useEffect(() => {
    if (window.kanoDesktop?.notifications) {
      const unsubscribe = window.kanoDesktop.notifications.onNotificationClick((payload) => {
        if (payload.route) {
          const validRoutes: RoutePath[] = [
            '/notes',
            '/tasks',
            '/board',
            '/calendar',
            '/activity',
            '/favorites',
            '/trash',
            '/settings',
          ];
          const target = payload.route.startsWith('/') ? payload.route : `/${payload.route}`;
          if (validRoutes.includes(target as RoutePath)) {
            setCurrentRoute(target as RoutePath);
          }
        }
      });
      return unsubscribe;
    }
  }, []);

  const renderRoute = () => {
    switch (currentRoute) {
      case '/notes':
        return <NotesRoute />;
      case '/tasks':
        return <TasksRoute />;
      case '/board':
        return <BoardRoute />;
      case '/calendar':
        return <CalendarRoute />;
      case '/activity':
        return <ActivityRoute />;
      case '/favorites':
        return <FavoritesRoute onNavigate={setCurrentRoute} />;
      case '/trash':
        return <TrashRoute />;
      case '/settings':
        return <SettingsRoute />;
      default:
        return <NotesRoute />;
    }
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-kano-bg text-kano-text-primary">
      {/* Sidebar Navigation */}
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={(route) => {
          setCurrentRoute(route);
          setIsMobileSidebarOpen(false);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Region */}
      <div className="flex-1 flex flex-col min-w-0 h-screen h-[100dvh] overflow-hidden">
        <PageHeader
          currentRoute={currentRoute}
          onNavigate={(route) => {
            setCurrentRoute(route);
            setIsMobileSidebarOpen(false);
          }}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(false)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
        />

        {/* Route View Outlet with Huge Subtle Brand Backdrop */}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-kano-bg relative">
          <BrandBackdrop size="huge" position="center" />
          <div className="flex-1 flex flex-col min-h-0 relative z-10">
            {renderRoute()}
          </div>
        </main>
      </div>

      {/* Global Command Palette */}
      <SearchPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(route) => {
          setCurrentRoute(route);
          setIsMobileSidebarOpen(false);
        }}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        onCreateNote={() => {
          setCurrentRoute('/notes');
          setIsMobileSidebarOpen(false);
        }}
        onCreateTask={() => {
          setCurrentRoute('/tasks');
          setIsMobileSidebarOpen(false);
        }}
      />

      {/* Global Keyboard Shortcuts HUD */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
