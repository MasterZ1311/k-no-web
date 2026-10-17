import React, { useEffect } from 'react';
import { Command, X, Sparkles, FileText, CheckSquare, Settings } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  icon: React.ReactNode;
  items: { key: string; description: string }[];
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  // Listen for Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Global & Navigation',
      icon: <Command className="w-4 h-4 text-kano-accent" />,
      items: [
        { key: `${modKey} + K`, description: 'Open Command Palette' },
        { key: '?', description: 'Show Keyboard Shortcuts HUD' },
        { key: `${modKey} + \\`, description: 'Toggle Sidebar' },
        { key: `${modKey} + 1..5`, description: 'Jump to Notes / Tasks / Board / Calendar / Activity' },
        { key: `${modKey} + Shift + L`, description: 'Toggle Light / Dark Mode' },
      ],
    },
    {
      title: 'Notes & Notion-Style Editor',
      icon: <FileText className="w-4 h-4 text-blue-500" />,
      items: [
        { key: '/', description: 'Open Slash Command Menu at cursor' },
        { key: `${modKey} + B`, description: 'Toggle Bold format' },
        { key: `${modKey} + I`, description: 'Toggle Italic format' },
        { key: `${modKey} + Shift + X`, description: 'Toggle Strikethrough' },
        { key: `${modKey} + E`, description: 'Inline code block' },
      ],
    },
    {
      title: 'Tasks & Productivity',
      icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
      items: [
        { key: `${modKey} + Shift + N`, description: 'Create New Note' },
        { key: `${modKey} + Shift + T`, description: 'Create New Task' },
        { key: 'Esc', description: 'Close current modal or dismiss palette' },
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-kano-surface/95 backdrop-blur-xl border border-kano-border rounded-2xl shadow-modal overflow-hidden flex flex-col focus:outline-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-kano-border bg-kano-bg/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-kano-accent/15 flex items-center justify-center text-kano-accent">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-kano-text-primary">Keyboard Shortcuts</h2>
              <p className="text-xs text-kano-text-muted">Linear & Raycast-inspired universal keybindings</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts modal"
            className="p-1.5 rounded-lg text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-kano-text-muted">
                {group.icon}
                <span>{group.title}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-kano-bg/70 border border-kano-border-subtle hover:border-kano-border transition-colors text-xs"
                  >
                    <span className="text-kano-text-secondary truncate pr-2">{item.description}</span>
                    <kbd className="px-2 py-0.5 rounded bg-kano-surface border border-kano-border font-mono text-[11px] font-semibold text-kano-text-primary shadow-subtle shrink-0">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-kano-border bg-kano-bg/50 text-[11px] text-kano-text-muted">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-kano-surface border border-kano-border font-mono text-[10px] text-kano-text-primary">?</kbd> anywhere to reopen</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded-md bg-kano-surface hover:bg-kano-surface-hover border border-kano-border text-kano-text-primary transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
