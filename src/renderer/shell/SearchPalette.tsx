import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { RoutePath } from '../routes/types';
import { useRooms } from '../features/rooms/RoomContext';
import type { NoteDTO } from '../../preload/types';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: RoutePath) => void;
}

interface PaletteItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Note';
  icon: React.ReactNode;
  path: RoutePath;
  subtitle?: string;
  noteId?: string;
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const { activeRoom } = useRooms();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [noteResults, setNoteResults] = useState<NoteDTO[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigationItems: PaletteItem[] = [
    { id: 'nav-notes', title: 'Notes & Documents', category: 'Navigation', icon: <FileText className="w-4 h-4" />, path: '/notes', subtitle: 'View all notes' },
    { id: 'nav-tasks', title: 'Tasks & Checklists', category: 'Navigation', icon: <CheckSquare className="w-4 h-4" />, path: '/tasks', subtitle: 'View tasks' },
    { id: 'nav-board', title: 'Kanban Board', category: 'Navigation', icon: <LayoutGrid className="w-4 h-4" />, path: '/board', subtitle: 'Open board' },
    { id: 'nav-calendar', title: 'Calendar & Schedule', category: 'Navigation', icon: <Calendar className="w-4 h-4" />, path: '/calendar', subtitle: 'View schedule' },
    { id: 'nav-activity', title: 'Activity Stream', category: 'Navigation', icon: <Activity className="w-4 h-4" />, path: '/activity', subtitle: 'Audit history' },
    { id: 'nav-favorites', title: 'Favorites', category: 'Navigation', icon: <Star className="w-4 h-4" />, path: '/favorites', subtitle: 'Pinned items' },
    { id: 'nav-trash', title: 'Trash', category: 'Navigation', icon: <Trash2 className="w-4 h-4" />, path: '/trash', subtitle: 'Deleted items' },
    { id: 'nav-settings', title: 'Settings', category: 'Navigation', icon: <Settings className="w-4 h-4" />, path: '/settings', subtitle: 'Preferences & shortcuts' },
  ];

  // Search live notes when query changes
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

    const timer = setTimeout(searchNotes, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, activeRoom]);

  const noteItems: PaletteItem[] = noteResults.map((note) => ({
    id: `note-${note.id}`,
    title: note.title || 'Untitled Note',
    category: 'Note',
    icon: <FileText className="w-4 h-4 text-kano-accent" />,
    path: '/notes',
    subtitle: note.plainTextSummary || 'Rich-text note',
    noteId: note.id,
  }));

  const filteredNavItems = navigationItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
  );

  const allItems = [...noteItems, ...filteredNavItems];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setNoteResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
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
          onNavigate(allItems[selectedIndex].path);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allItems, selectedIndex, onNavigate, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search and Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-24 px-3 sm:px-4 bg-black/40 backdrop-blur-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-kano-surface border border-kano-border rounded-xl shadow-modal overflow-hidden flex flex-col focus:outline-none">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-kano-border gap-3 bg-kano-bg">
          <Search className="w-4 h-4 text-kano-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or jump to section..."
            className="w-full bg-transparent text-sm text-kano-text-primary placeholder:text-kano-text-muted focus:outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-kano-surface border border-kano-border text-kano-text-muted font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-2">
          {allItems.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-kano-text-muted flex flex-col items-center justify-center">
              <img src="/empty-search.svg" alt="No results" className="w-16 h-16 object-contain opacity-80 mb-2 pointer-events-none select-none" />
              <span>No matching notes or destinations found.</span>
            </div>
          ) : (
            allItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onNavigate(item.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                    isSelected ? 'bg-kano-accent text-white font-medium' : 'text-kano-text-primary hover:bg-kano-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <span className={isSelected ? 'text-white' : 'text-kano-text-muted'}>{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{item.title}</span>
                        {item.category === 'Note' && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-kano-bg text-kano-text-muted border border-kano-border-subtle'
                            }`}
                          >
                            Note
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <span className={`text-[10px] truncate block ${isSelected ? 'text-white/80' : 'text-kano-text-muted'}`}>
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <ArrowRight className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />}
                </div>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-kano-border bg-kano-bg text-[10px] text-kano-text-muted">
          <span>Navigation Shortcuts</span>
          <div className="flex items-center gap-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>esc Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
