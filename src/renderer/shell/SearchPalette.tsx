import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  FileText,
  CheckSquare,
  LayoutGrid,
  Calendar,
  Activity,
  Star,
  Trash2,
  Settings,
  ArrowRight,
  Plus,
  Sun,
  Moon,
  Keyboard,
  Share2,
  PanelLeft,
  Sparkles,
} from 'lucide-react';
import { RoutePath } from '../routes/types';
import { useRooms } from '../features/rooms/RoomContext';
import { useSettings } from '../features/settings/SettingsContext';
import { useToast } from '../design-system/ToastProvider';
import type { NoteDTO } from '../../preload/types';

export interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: RoutePath) => void;
  onOpenShortcuts?: () => void;
  onToggleSidebar?: () => void;
  onCreateNote?: () => void;
  onCreateTask?: () => void;
}

interface PaletteActionItem {
  id: string;
  title: string;
  group: 'Actions' | 'Navigation' | 'Notes';
  icon: React.ReactNode;
  shortcut?: string;
  subtitle?: string;
  action: () => void;
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenShortcuts,
  onToggleSidebar,
  onCreateNote,
  onCreateTask,
}) => {
  const { activeRoom } = useRooms();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [noteResults, setNoteResults] = useState<NoteDTO[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Toggle dark/light theme
  const handleToggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    const nextTheme = isDark ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, { type: 'info' });
  };

  // Copy room link / id
  const handleCopyRoomLink = () => {
    if (activeRoom) {
      navigator.clipboard.writeText(window.location.origin + '#' + activeRoom.id);
      showToast('Copied workspace room link to clipboard!', { type: 'success' });
    } else {
      showToast('No active workspace selected', { type: 'warning' });
    }
  };

  // 1. Quick Actions (Raycast / Linear style)
  const quickActions: PaletteActionItem[] = useMemo(
    () => [
      {
        id: 'action-new-note',
        title: 'Create New Note',
        group: 'Actions',
        icon: <Plus className="w-4 h-4 text-kano-accent" />,
        shortcut: `${modKey} + Shift + N`,
        subtitle: 'Start a blank rich document in the active room',
        action: () => {
          if (onCreateNote) {
            onCreateNote();
          } else {
            onNavigate('/notes');
          }
        },
      },
      {
        id: 'action-new-task',
        title: 'Create New Task',
        group: 'Actions',
        icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
        shortcut: `${modKey} + Shift + T`,
        subtitle: 'Add a new checklist item with priority & deadline',
        action: () => {
          if (onCreateTask) {
            onCreateTask();
          } else {
            onNavigate('/tasks');
          }
        },
      },
      {
        id: 'action-toggle-theme',
        title: 'Toggle Color Theme',
        group: 'Actions',
        icon: <Sun className="w-4 h-4 text-amber-500" />,
        shortcut: `${modKey} + Shift + L`,
        subtitle: 'Switch between light and dark modes',
        action: handleToggleTheme,
      },
      {
        id: 'action-shortcuts',
        title: 'Keyboard Shortcuts Reference',
        group: 'Actions',
        icon: <Keyboard className="w-4 h-4 text-indigo-500" />,
        shortcut: '?',
        subtitle: 'View complete cheat sheet of all app shortcuts',
        action: () => {
          onOpenShortcuts?.();
        },
      },
      {
        id: 'action-toggle-sidebar',
        title: 'Toggle Sidebar Panel',
        group: 'Actions',
        icon: <PanelLeft className="w-4 h-4 text-sky-500" />,
        shortcut: `${modKey} + \\`,
        subtitle: 'Expand or collapse the navigation drawer',
        action: () => {
          onToggleSidebar?.();
        },
      },
      {
        id: 'action-copy-room',
        title: 'Copy Workspace Share Link',
        group: 'Actions',
        icon: <Share2 className="w-4 h-4 text-violet-500" />,
        subtitle: activeRoom ? `Copy invite link for "${activeRoom.name}"` : 'Copy link to current workspace',
        action: handleCopyRoomLink,
      },
    ],
    [modKey, activeRoom, onCreateNote, onCreateTask, onNavigate, onOpenShortcuts, onToggleSidebar]
  );

  // 2. Navigation items
  const navigationItems: PaletteActionItem[] = useMemo(
    () => [
      {
        id: 'nav-notes',
        title: 'Notes & Documents',
        group: 'Navigation',
        icon: <FileText className="w-4 h-4" />,
        shortcut: `${modKey} + 1`,
        subtitle: 'Workspace notes and folder tree',
        action: () => onNavigate('/notes'),
      },
      {
        id: 'nav-tasks',
        title: 'Tasks & Checklists',
        group: 'Navigation',
        icon: <CheckSquare className="w-4 h-4" />,
        shortcut: `${modKey} + 2`,
        subtitle: 'Action items, priorities, and deadlines',
        action: () => onNavigate('/tasks'),
      },
      {
        id: 'nav-board',
        title: 'Kanban Board',
        group: 'Navigation',
        icon: <LayoutGrid className="w-4 h-4" />,
        shortcut: `${modKey} + 3`,
        subtitle: 'Visual task stages and column flows',
        action: () => onNavigate('/board'),
      },
      {
        id: 'nav-calendar',
        title: 'Calendar & Schedule',
        group: 'Navigation',
        icon: <Calendar className="w-4 h-4" />,
        shortcut: `${modKey} + 4`,
        subtitle: 'Month schedule and due date milestones',
        action: () => onNavigate('/calendar'),
      },
      {
        id: 'nav-activity',
        title: 'Activity Stream',
        group: 'Navigation',
        icon: <Activity className="w-4 h-4" />,
        shortcut: `${modKey} + 5`,
        subtitle: 'Audit log and recent collaborator updates',
        action: () => onNavigate('/activity'),
      },
      {
        id: 'nav-favorites',
        title: 'Favorites',
        group: 'Navigation',
        icon: <Star className="w-4 h-4 text-amber-500" />,
        subtitle: 'Starred notes and important documents',
        action: () => onNavigate('/favorites'),
      },
      {
        id: 'nav-trash',
        title: 'Trash Bin',
        group: 'Navigation',
        icon: <Trash2 className="w-4 h-4 text-rose-500" />,
        subtitle: 'Recover or permanently purge deleted items',
        action: () => onNavigate('/trash'),
      },
      {
        id: 'nav-settings',
        title: 'Settings & Preferences',
        group: 'Navigation',
        icon: <Settings className="w-4 h-4" />,
        subtitle: 'Appearance, notifications, and storage cache',
        action: () => onNavigate('/settings'),
      },
    ],
    [modKey, onNavigate]
  );

  // Live notes search
  useEffect(() => {
    let isCancelled = false;

    async function searchNotes() {
      if (!query.trim() || !activeRoom || !window.kanoDesktop?.notes) {
        setNoteResults([]);
        return;
      }

      try {
        const res = await window.kanoDesktop.notes.searchNotes(activeRoom.id, query.trim());
        if (!isCancelled && res.success && res.notes) {
          setNoteResults(res.notes);
        }
      } catch (err) {
        console.error('[SearchPalette] Failed to search notes:', err);
      }
    }

    const timer = setTimeout(searchNotes, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, activeRoom]);

  // Convert note results into items
  const noteItems: PaletteActionItem[] = useMemo(
    () =>
      noteResults.map((note) => ({
        id: `note-${note.id}`,
        title: note.title || 'Untitled Note',
        group: 'Notes',
        icon: <FileText className="w-4 h-4 text-kano-accent" />,
        subtitle: note.plainTextSummary || 'Rich-text document',
        action: () => {
          onNavigate('/notes');
          // Dispatch a custom event to select this specific note
          window.dispatchEvent(new CustomEvent('kano:select-note', { detail: { noteId: note.id } }));
        },
      })),
    [noteResults, onNavigate]
  );

  // Filter lists based on query
  const filteredQuickActions = useMemo(() => {
    if (!query.trim()) return quickActions;
    const q = query.toLowerCase();
    return quickActions.filter(
      (item) => item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [quickActions, query]);

  const filteredNavItems = useMemo(() => {
    if (!query.trim()) return navigationItems;
    const q = query.toLowerCase();
    return navigationItems.filter(
      (item) => item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [navigationItems, query]);

  // Combine items into ordered list
  const allItems = useMemo(() => {
    return [...filteredQuickActions, ...noteItems, ...filteredNavItems];
  }, [filteredQuickActions, noteItems, filteredNavItems]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setNoteResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (allItems.length ? (prev + 1) % allItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (allItems.length ? (prev - 1 + allItems.length) % allItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allItems[selectedIndex]) {
          allItems[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  const currentItem = allItems[selectedIndex];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search and Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-3 sm:px-4 bg-black/50 backdrop-blur-md select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-kano-surface/95 backdrop-blur-2xl border border-kano-border rounded-2xl shadow-2xl overflow-hidden flex flex-col focus:outline-none">
        {/* Search Input Bar (Raycast-inspired) */}
        <div className="flex items-center px-4 py-3.5 border-b border-kano-border gap-3 bg-kano-bg/60">
          <Search className="w-5 h-5 text-kano-accent flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or jump to section..."
            className="w-full bg-transparent text-sm font-medium text-kano-text-primary placeholder:text-kano-text-muted focus:outline-none"
          />
          <kbd className="text-[11px] px-2 py-0.5 rounded-md bg-kano-surface border border-kano-border text-kano-text-muted font-mono shadow-subtle shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results List with Section Headers */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {allItems.length === 0 ? (
            <div className="py-12 px-4 text-center text-xs text-kano-text-muted flex flex-col items-center justify-center">
              <Sparkles className="w-8 h-8 text-kano-text-muted/40 mb-2" />
              <span className="font-medium text-kano-text-secondary">No matching commands or notes found.</span>
              <span className="mt-1 text-[11px]">Try searching for "Note", "Task", "Theme", or "Settings"</span>
            </div>
          ) : (
            allItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const prevItem = index > 0 ? allItems[index - 1] : null;
              const isFirstOfGroup = !prevItem || prevItem.group !== item.group;

              return (
                <React.Fragment key={item.id}>
                  {isFirstOfGroup && (
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-kano-text-muted">
                      {item.group === 'Actions' && '⚡ Quick Actions'}
                      {item.group === 'Notes' && '📄 Matching Documents'}
                      {item.group === 'Navigation' && '🧭 Workspace Navigation'}
                    </div>
                  )}
                  <div
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all duration-100 ${
                      isSelected
                        ? 'bg-kano-accent/12 text-kano-text-primary border border-kano-accent/30 shadow-subtle'
                        : 'text-kano-text-primary hover:bg-kano-surface-hover/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-kano-accent text-white shadow-xs'
                            : 'bg-kano-surface border border-kano-border text-kano-text-secondary'
                        }`}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate text-sm">{item.title}</span>
                          {item.group === 'Notes' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md font-mono bg-kano-accent/15 text-kano-accent font-semibold">
                              Doc
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <span className="text-[11px] text-kano-text-muted truncate block mt-0.5">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.shortcut && (
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-kano-surface border border-kano-border font-mono text-kano-text-muted">
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && (
                        <div className="flex items-center gap-1 text-[11px] text-kano-accent font-medium">
                          <span>Run</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Palette Footer (Raycast-inspired status bar) */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-kano-border bg-kano-bg/70 text-[11px] text-kano-text-muted">
          <div className="flex items-center gap-2">
            <span className="font-medium text-kano-text-secondary">
              {currentItem ? (
                <>
                  Action: <strong className="text-kano-text-primary">{currentItem.title}</strong>
                </>
              ) : (
                'Command Palette'
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-kano-surface border border-kano-border font-mono text-[9px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-kano-surface border border-kano-border font-mono text-[9px]">↵</kbd>
              Execute
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-kano-surface border border-kano-border font-mono text-[9px]">Esc</kbd>
              Dismiss
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
