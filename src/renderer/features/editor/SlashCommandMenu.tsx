import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

export interface SlashCommandMenuProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
  filterText: string;
  position: { top: number; left: number };
}

interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  keywords: string[];
  execute: (editor: Editor) => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  editor,
  isOpen,
  onClose,
  filterText,
  position,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: 'heading-1',
        title: 'Heading 1',
        description: 'Big section heading',
        icon: <Heading1 className="w-4 h-4 text-kano-accent" />,
        keywords: ['h1', 'heading', 'title', 'large'],
        execute: (ed) => {
          ed.chain().focus().toggleHeading({ level: 1 }).run();
        },
      },
      {
        id: 'heading-2',
        title: 'Heading 2',
        description: 'Medium section heading',
        icon: <Heading2 className="w-4 h-4 text-sky-500" />,
        keywords: ['h2', 'heading', 'subtitle', 'medium'],
        execute: (ed) => {
          ed.chain().focus().toggleHeading({ level: 2 }).run();
        },
      },
      {
        id: 'heading-3',
        title: 'Heading 3',
        description: 'Small subsection heading',
        icon: <Heading3 className="w-4 h-4 text-violet-500" />,
        keywords: ['h3', 'heading', 'subheading', 'small'],
        execute: (ed) => {
          ed.chain().focus().toggleHeading({ level: 3 }).run();
        },
      },
      {
        id: 'task-list',
        title: 'To-do List',
        description: 'Track tasks with interactive checkboxes',
        icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
        keywords: ['todo', 'task', 'checklist', 'checkbox'],
        execute: (ed) => {
          ed.chain().focus().toggleTaskList().run();
        },
      },
      {
        id: 'bullet-list',
        title: 'Bulleted List',
        description: 'Create a simple bulleted list',
        icon: <List className="w-4 h-4 text-amber-500" />,
        keywords: ['bullet', 'list', 'unordered'],
        execute: (ed) => {
          ed.chain().focus().toggleBulletList().run();
        },
      },
      {
        id: 'ordered-list',
        title: 'Numbered List',
        description: 'Create a sequence or ranked list',
        icon: <ListOrdered className="w-4 h-4 text-indigo-500" />,
        keywords: ['number', 'ordered', 'sequence', '1.'],
        execute: (ed) => {
          ed.chain().focus().toggleOrderedList().run();
        },
      },
      {
        id: 'blockquote',
        title: 'Quote',
        description: 'Capture a quote or highlight block',
        icon: <Quote className="w-4 h-4 text-rose-500" />,
        keywords: ['quote', 'callout', 'blockquote'],
        execute: (ed) => {
          ed.chain().focus().toggleBlockquote().run();
        },
      },
      {
        id: 'code-block',
        title: 'Code Block',
        description: 'Capture code snippet with syntax styling',
        icon: <Code className="w-4 h-4 text-cyan-500" />,
        keywords: ['code', 'snippet', 'pre'],
        execute: (ed) => {
          ed.chain().focus().toggleCodeBlock().run();
        },
      },
      {
        id: 'divider',
        title: 'Divider',
        description: 'Visually separate sections with a horizontal line',
        icon: <Minus className="w-4 h-4 text-slate-400" />,
        keywords: ['divider', 'hr', 'line', 'separator'],
        execute: (ed) => {
          ed.chain().focus().setHorizontalRule().run();
        },
      },
    ],
    []
  );

  // Filter commands by typed filterText
  const filteredCommands = useMemo(() => {
    if (!filterText) return commands;
    const clean = filterText.toLowerCase().trim();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(clean) ||
        cmd.description.toLowerCase().includes(clean) ||
        cmd.keywords.some((k) => k.includes(clean))
    );
  }, [commands, filterText]);

  // Reset index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  const executeCommand = (cmd: CommandItem) => {
    // Delete the slash trigger text from the document
    const { state } = editor;
    const { from } = state.selection;
    const textBefore = state.doc.textBetween(Math.max(0, from - filterText.length - 1), from, '\0', '\0');
    if (textBefore.startsWith('/')) {
      editor.commands.deleteRange({ from: from - filterText.length - 1, to: from });
    }
    cmd.execute(editor);
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredCommands.length ? (prev + 1) % filteredCommands.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredCommands.length ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filteredCommands, selectedIndex, editor, filterText, onClose]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || filteredCommands.length === 0) return null;

  // Boundary check for positioning
  const adjustedTop = Math.min(position.top, window.innerHeight - 320);
  const adjustedLeft = Math.min(Math.max(position.left, 16), window.innerWidth - 300);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: `${adjustedTop}px`,
        left: `${adjustedLeft}px`,
        zIndex: 60,
      }}
      className="w-72 bg-kano-surface/95 backdrop-blur-xl border border-kano-border rounded-xl shadow-modal overflow-hidden flex flex-col p-1.5 animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-kano-text-muted border-b border-kano-border/60 pb-1.5 mb-1 flex items-center justify-between">
        <span>Notion Blocks</span>
        <span>{filteredCommands.length} items</span>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {filteredCommands.map((cmd, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={cmd.id}
              onClick={() => executeCommand(cmd)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                isSelected
                  ? 'bg-kano-accent/15 text-kano-text-primary font-medium'
                  : 'text-kano-text-secondary hover:bg-kano-surface-hover hover:text-kano-text-primary'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'bg-kano-accent text-white shadow-xs'
                    : 'bg-kano-bg border border-kano-border-subtle'
                }`}
              >
                {cmd.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-kano-text-primary truncate">{cmd.title}</div>
                <div className="text-[10px] text-kano-text-muted truncate">{cmd.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-1 pt-1.5 border-t border-kano-border/60 px-2 py-0.5 text-[10px] text-kano-text-muted flex items-center justify-between">
        <span>↑↓ Navigate</span>
        <span>↵ Insert</span>
        <span>Esc Dismiss</span>
      </div>
    </div>
  );
};
