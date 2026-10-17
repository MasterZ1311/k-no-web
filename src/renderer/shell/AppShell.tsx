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

export const AppShell: React.FC = () => {
  const { settings } = useSettings();
  const [currentRoute, setCurrentRoute] = useState<RoutePath>('/notes');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(settings.sidebarCollapsed);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keyboard shortcut listener for global shell operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K / Cmd+K -> Toggle command palette
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }

      // Ctrl+\ -> Toggle sidebar
      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
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
  }, []);

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
        />

        {/* Route View Outlet */}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-kano-bg">
          {renderRoute()}
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
      />
    </div>
  );
};
