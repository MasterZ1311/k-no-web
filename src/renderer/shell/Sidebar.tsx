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
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { showToast } = useToast();
  const { user, signOut } = useAuth();
  const { activeRoom } = useRooms();

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
    onNavigate('/notes');
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
    <aside
      aria-label="Workspace Sidebar"
      className={`h-screen flex flex-col border-r border-kano-border bg-kano-surface transition-all duration-200 select-none flex-shrink-0 ${
        isCollapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* 1. App Wordmark & Branding */}
      <div className="h-14 px-3 flex items-center justify-between border-b border-kano-border flex-shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2 pl-1.5">
            <div className="w-5 h-5 rounded bg-kano-accent text-white flex items-center justify-center font-bold text-xs shadow-subtle">
              k
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-kano-text-primary">
                káno̱
              </span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-kano-surface-hover text-kano-text-muted border border-kano-border-subtle">
                web v1.0
              </span>
            </div>
          </div>
        )}
        <Tooltip content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right">
          <IconButton
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={isCollapsed ? 'mx-auto' : ''}
          >
            <PanelLeftClose
              className={`w-4 h-4 transition-transform duration-200 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
            />
          </IconButton>
        </Tooltip>
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
            onClick={() => onNavigate('/notes')}
          />
          <SidebarNavItem
            path="/tasks"
            label="Tasks"
            icon={<CheckSquare className="w-4 h-4" />}
            badgeCount={counts.tasks}
            isActive={currentRoute === '/tasks'}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate('/tasks')}
          />
          <SidebarNavItem
            path="/board"
            label="Board"
            icon={<LayoutGrid className="w-4 h-4" />}
            badgeCount={counts.boardItems}
            isActive={currentRoute === '/board'}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate('/board')}
          />
          <SidebarNavItem
            path="/calendar"
            label="Calendar"
            icon={<Calendar className="w-4 h-4" />}
            badgeCount={counts.calendarItems}
            isActive={currentRoute === '/calendar'}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate('/calendar')}
          />
          <SidebarNavItem
            path="/activity"
            label="Activity"
            icon={<Activity className="w-4 h-4" />}
            isActive={currentRoute === '/activity'}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate('/activity')}
          />
        </div>

        {/* Folders Section (Shown in expanded mode) */}
        {!isCollapsed && (
          <div className="pt-2">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-semibold text-kano-text-muted tracking-wider uppercase">
                Folders
              </span>
              {activeRoom && (
                <IconButton
                  aria-label="New folder"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateFolderOpen(true)}
                  className="w-5 h-5 p-0.5 text-kano-text-muted hover:text-kano-text-primary"
                >
                  <Plus className="w-3 h-3" />
                </IconButton>
              )}
            </div>

            <div className="space-y-0.5">
              {rootFolders.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] text-kano-text-muted italic">
                  No folders yet
                </div>
              ) : (
                rootFolders.map((folder) => {
                  const isExpanded = expandedFolders[folder.id];
                  const childFolders = getChildFolders(folder.id);
                  const hasChildren = childFolders.length > 0;

                  return (
                    <div key={folder.id}>
                      <div className="flex items-center group rounded-md hover:bg-kano-surface-hover px-1.5 py-1 text-xs text-kano-text-secondary">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleFolder(folder.id)}
                            className="p-0.5 hover:text-kano-text-primary rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        ) : (
                          <div className="w-4" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleFolderClick(folder)}
                          className="flex-1 flex items-center gap-1.5 ml-1 text-left truncate hover:text-kano-text-primary"
                        >
                          {isExpanded ? (
                            <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          ) : (
                            <FolderIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="truncate">{folder.name}</span>
                        </button>
                        <span className="text-[10px] text-kano-text-muted px-1 font-mono">
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
                              className="w-full flex items-center justify-between px-2 py-1 rounded-md text-xs text-kano-text-secondary hover:text-kano-text-primary hover:bg-kano-surface-hover text-left truncate"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <FolderIcon className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                <span className="truncate">{child.name}</span>
                              </div>
                              <span className="text-[10px] text-kano-text-muted font-mono">
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
            onClick={() => onNavigate('/favorites')}
          />
          <SidebarNavItem
            path="/trash"
            label="Trash"
            icon={<Trash2 className="w-4 h-4" />}
            badgeCount={counts.trashCount}
            isActive={currentRoute === '/trash'}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate('/trash')}
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
          onClick={() => onNavigate('/settings')}
        />

        {/* User Identity Area */}
        <div
          className={`flex items-center gap-2 p-1.5 rounded-md hover:bg-kano-surface-hover select-none transition-colors ${
            isCollapsed ? 'justify-center p-1' : ''
          }`}
          title={user ? `${user.displayName || user.email} (${user.email})` : 'Authenticated user'}
        >
          <div className="w-7 h-7 rounded-full bg-kano-accent-subtle text-kano-accent border border-kano-accent/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user ? (user.displayName || user.email || 'U').charAt(0).toUpperCase() : 'U'}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-kano-text-primary truncate">
                    {user ? (user.displayName || user.email.split('@')[0]) : 'User'}
                  </span>
                </div>
                <span className="text-[10px] text-kano-text-muted block truncate">
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
                    className="w-6 h-6 p-1 text-kano-text-muted hover:text-red-600"
                  >
                    <LogOut className="w-3.5 h-3.5" />
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
  );
};
