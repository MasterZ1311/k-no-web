import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  CheckSquare,
  LayoutGrid,
  Calendar,
  Activity,
  Star,
  Trash2,
  Settings,
  PanelLeftClose,
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  LogOut,
  X,
} from 'lucide-react';
import { RoutePath } from '../routes/types';
import { SidebarNavItem } from './SidebarNavItem';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { IconButton } from '../design-system/IconButton';
import { Tooltip } from '../design-system/Tooltip';
import { useToast } from '../design-system/ToastProvider';
import { useAuth } from '../features/auth/AuthContext';
import { useRooms } from '../features/rooms/RoomContext';
import { useRealtimeInvalidation } from '../features/realtime/RealtimeContext';
import { CreateFolderDialog } from '../features/folders/CreateFolderDialog';
import type { FolderDTO } from '../../preload/types';

interface SidebarProps {
  currentRoute: RoutePath;
  onNavigate: (route: RoutePath) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { showToast } = useToast();
  const { user, signOut } = useAuth();
  const { activeRoom } = useRooms();

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('kano_sidebar_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 180 && val <= 480) return val;
      }
    } catch {}
    return 256;
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, 180), 480);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('kano_sidebar_width', String(sidebarWidth));
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  const handleNavClick = (path: RoutePath) => {
    onNavigate(path);
    onCloseMobile?.();
  };

  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [counts, setCounts] = useState({
    notes: 0,
    tasks: 0,
    boardItems: 0,
    calendarItems: 0,
    activityCount: 0,
    trashCount: 0,
  });

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  const loadSidebarData = useCallback(async () => {
    if (!activeRoom || !window.kanoDesktop) {
      setFolders([]);
      setCounts({ notes: 0, tasks: 0, boardItems: 0, calendarItems: 0, activityCount: 0, trashCount: 0 });
      return;
    }

    try {
      const [foldersRes, notesRes, tasksRes, eventsRes, trashRes] = await Promise.all([
        window.kanoDesktop.folders.getFolders(activeRoom.id),
        window.kanoDesktop.notes.getNotes(activeRoom.id),
        window.kanoDesktop.tasks.getTasks(activeRoom.id),
        window.kanoDesktop.calendar.getEvents(activeRoom.id),
        window.kanoDesktop.notes.getTrashNotes(activeRoom.id),
      ]);

      if (foldersRes.success && foldersRes.folders) {
        setFolders(foldersRes.folders);
      }

      const notesCount = notesRes.success && notesRes.notes ? notesRes.notes.length : 0;
      const tasksCount = tasksRes.success && tasksRes.tasks ? tasksRes.tasks.length : 0;
      const boardCount = tasksCount;
      const eventsCount = eventsRes.success && eventsRes.events ? eventsRes.events.length : 0;
      const trashCount = trashRes.success && trashRes.notes ? trashRes.notes.length : 0;

      setCounts({
        notes: notesCount,
        tasks: tasksCount,
        boardItems: boardCount,
        calendarItems: eventsCount,
        activityCount: 0,
        trashCount,
      });
    } catch (err) {
      console.warn('[Sidebar] Error loading counts:', err);
    }
  }, [activeRoom]);

  useEffect(() => {
    loadSidebarData();
  }, [loadSidebarData]);

  // Realtime updates
  useRealtimeInvalidation(['notes', 'folders', 'tasks', 'calendar_events'], () => {
    loadSidebarData();
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleFolderClick = (folder: FolderDTO) => {
    handleNavClick('/notes');
  };

  const handleCreateFolderSubmit = async (name: string, parentId?: string | null) => {
    if (!activeRoom || !window.kanoDesktop) return false;
    try {
      const res = await window.kanoDesktop.folders.createFolder(activeRoom.id, name, parentId);
      if (res.success && res.folder) {
        showToast(`Folder "${res.folder.name}" created`, { type: 'success' });
        loadSidebarData();
        return true;
      } else {
        showToast(res.error || 'Failed to create folder', { type: 'error' });
        return false;
      }
    } catch {
      showToast('Failed to create folder', { type: 'error' });
      return false;
    }
  };

  // Build hierarchy: root folders and child folders
  const rootFolders = folders.filter((f) => !f.parentId);
  const getChildFolders = (parentId: string) => folders.filter((f) => f.parentId === parentId);

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        aria-label="Workspace Sidebar"
        style={isCollapsed ? undefined : { width: `${sidebarWidth}px` }}
        className={`h-screen h-[100dvh] flex flex-col border-r border-kano-border bg-kano-surface select-none flex-shrink-0 relative z-50 md:z-auto transition-transform md:transition-[width] duration-200 ${
          isCollapsed ? 'w-14' : 'w-64'
        } ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0 max-w-[85vw]'
            : 'fixed md:relative -translate-x-full md:translate-x-0'
        }`}
      >
        {/* Resizer Handle (Desktop only) */}
        {!isCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={startResizing}
            onDoubleClick={() => setSidebarWidth(256)}
            title="Drag to resize, double click to reset"
            className="hidden md:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-kano-accent/40 active:bg-kano-accent transition-colors z-30"
          />
        )}

        {/* 1. App Wordmark & Branding */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-kano-border flex-shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2 pl-1.5 min-w-0">
              <img
                src="/logo-full.svg"
                alt="káno̱"
                className="h-7 w-auto max-w-[110px] object-contain flex-shrink-0"
              />
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-kano-surface-hover text-kano-text-muted border border-kano-border-subtle whitespace-nowrap">
                web v1.0
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {onCloseMobile && (
              <IconButton
                aria-label="Close navigation"
                variant="ghost"
                size="sm"
                onClick={onCloseMobile}
                className="md:hidden"
              >
                <X className="w-4 h-4 text-kano-text-muted" />
              </IconButton>
            )}
            <Tooltip content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right">
              <IconButton
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className={isCollapsed ? 'mx-auto' : 'hidden md:inline-flex'}
              >
                <PanelLeftClose
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isCollapsed ? 'rotate-180' : ''
                  }`}
                />
              </IconButton>
            </Tooltip>
          </div>
        </div>

      {/* 2. Workspace Identity & Switcher */}
      <div className="p-2 border-b border-kano-border flex-shrink-0">
        <WorkspaceSwitcher isCollapsed={isCollapsed} />
      </div>

      {/* 3. Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Core Domain Navigation */}
        <div className="space-y-0.5">
          <SidebarNavItem
            path="/notes"
            label="Notes"
            icon={<FileText className="w-4 h-4" />}
            badgeCount={counts.notes}
            isActive={currentRoute === '/notes'}
            isCollapsed={isCollapsed}
            onClick={() => handleNavClick('/notes')}
          />
          <SidebarNavItem
            path="/tasks"
            label="Tasks"
            icon={<CheckSquare className="w-4 h-4" />}
            badgeCount={counts.tasks}
            isActive={currentRoute === '/tasks'}
            isCollapsed={isCollapsed}
            onClick={() => handleNavClick('/tasks')}
          />
          <SidebarNavItem
            path="/board"
            label="Board"
            icon={<LayoutGrid className="w-4 h-4" />}
            badgeCount={counts.boardItems}
            isActive={currentRoute === '/board'}
            isCollapsed={isCollapsed}
            onClick={() => handleNavClick('/board')}
          />
          <SidebarNavItem
            path="/calendar"
            label="Calendar"
            icon={<Calendar className="w-4 h-4" />}
            badgeCount={counts.calendarItems}
            isActive={currentRoute === '/calendar'}
            isCollapsed={isCollapsed}
            onClick={() => handleNavClick('/calendar')}
          />
          <SidebarNavItem
            path="/activity"
            label="Activity"
            icon={<Activity className="w-4 h-4" />}
            isActive={currentRoute === '/activity'}
            isCollapsed={isCollapsed}
            onClick={() => handleNavClick('/activity')}
          />
        </div>

        {/* Folders Section (Shown in expanded mode) */}
        {!isCollapsed && (
          <div className="pt-2">
            <div className="flex items-center justify-between px-2.5 mb-2">
              <span className="text-xs font-semibold text-kano-text-muted tracking-wider uppercase">
                Folders
              </span>
              {activeRoom && (
                <IconButton
                  aria-label="New folder"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateFolderOpen(true)}
                  className="w-6 h-6 p-1 text-kano-text-muted hover:text-kano-text-primary"
                >
                  <Plus className="w-3.5 h-3.5" />
                </IconButton>
              )}
            </div>

            <div className="space-y-0.5">
              {rootFolders.length === 0 ? (
                <div className="px-2.5 py-2 text-xs text-kano-text-muted italic">
                  No folders yet
                </div>
              ) : (
                rootFolders.map((folder) => {
                  const isExpanded = expandedFolders[folder.id];
                  const childFolders = getChildFolders(folder.id);
                  const hasChildren = childFolders.length > 0;

                  return (
                    <div key={folder.id}>
                      <div className="flex items-center group rounded-lg hover:bg-kano-surface-hover px-2 py-1.5 text-sm text-kano-text-secondary">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleFolder(folder.id)}
                            className="p-1 hover:text-kano-text-primary rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <div className="w-4" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleFolderClick(folder)}
                          className="flex-1 flex items-center gap-2 ml-1 text-left truncate hover:text-kano-text-primary font-medium"
                        >
                          {isExpanded ? (
                            <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          ) : (
                            <FolderIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="truncate">{folder.name}</span>
                        </button>
                        <span className="text-xs text-kano-text-muted px-1.5 font-mono">
                          {folder.noteCount || 0}
                        </span>
                      </div>

                      {/* Render Child Folders */}
                      {hasChildren && isExpanded && (
                        <div className="pl-5 space-y-0.5 mt-0.5">
                          {childFolders.map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handleFolderClick(child)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-kano-text-secondary hover:text-kano-text-primary hover:bg-kano-surface-hover text-left truncate"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FolderIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="truncate">{child.name}</span>
                              </div>
                              <span className="text-xs text-kano-text-muted font-mono">
                                {child.noteCount || 0}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Quick Links: Favorites & Trash */}
        <div className="pt-2 border-t border-kano-border space-y-0.5">
          <SidebarNavItem
            path="/favorites"
            label="Favorites"
            icon={<Star className="w-4 h-4 text-amber-500" />}
            isActive={currentRoute === '/favorites'}
            isCollapsed={isCollapsed}
            onClick={() => handleNavClick('/favorites')}
          />
          <SidebarNavItem
            path="/trash"
            label="Trash"
            icon={<Trash2 className="w-4 h-4" />}
            badgeCount={counts.trashCount}
            isActive={currentRoute === '/trash'}
            isCollapsed={isCollapsed}
            onClick={() => handleNavClick('/trash')}
          />
        </div>
      </div>

      {/* 4. Bottom Controls: Settings & User Profile */}
      <div className="p-2 border-t border-kano-border flex-shrink-0 space-y-1">
        <SidebarNavItem
          path="/settings"
          label="Settings"
          icon={<Settings className="w-4 h-4" />}
          isActive={currentRoute === '/settings'}
          isCollapsed={isCollapsed}
          onClick={() => handleNavClick('/settings')}
        />

        {/* User Identity Area */}
        <div
          className={`flex items-center gap-2.5 p-2 rounded-lg hover:bg-kano-surface-hover select-none transition-colors ${
            isCollapsed ? 'justify-center p-1' : ''
          }`}
          title={user ? `${user.displayName || user.email} (${user.email})` : 'Authenticated user'}
        >
          <div className="w-8 h-8 rounded-full bg-kano-accent-subtle text-kano-accent border border-kano-accent/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user ? (user.displayName || user.email || 'U').charAt(0).toUpperCase() : 'U'}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-kano-text-primary truncate">
                    {user ? (user.displayName || user.email.split('@')[0]) : 'User'}
                  </span>
                </div>
                <span className="text-xs text-kano-text-muted block truncate">
                  {user ? user.email : ''}
                </span>
              </div>
              {user && (
                <Tooltip content="Sign Out" position="top">
                  <IconButton
                    aria-label="Sign out"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      signOut();
                      showToast('Signed out of káno̱', { type: 'info' });
                    }}
                    className="w-7 h-7 p-1 text-kano-text-muted hover:text-red-600"
                  >
                    <LogOut className="w-4 h-4" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onSubmit={handleCreateFolderSubmit}
      />
    </aside>
    </>
  );
};
