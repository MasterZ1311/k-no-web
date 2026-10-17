import React, { useEffect, useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  CheckSquare,
  MessageSquarePlus,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

export interface BubbleMenuProps {
  editor: Editor;
  onAddComment?: (highlightedText: string) => void;
}

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor, onAddComment }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const updateMenu = () => {
      const { selection } = editor.state;
      const { empty, from, to } = selection;

      // Don't show if no text is selected or if editor is not focused
      if (empty || from === to || !editor.isFocused) {
        setIsVisible(false);
        return;
      }

      // Calculate bounding rect of the selected text
      try {
        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) {
          setIsVisible(false);
          return;
        }

        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) {
          setIsVisible(false);
          return;
        }

        // Position above the selection
        const top = Math.max(10, rect.top - 46);
        const left = Math.max(10, Math.min(rect.left + rect.width / 2 - 140, window.innerWidth - 300));

        setCoords({ top, left });
        setIsVisible(true);
      } catch (err) {
        setIsVisible(false);
      }
    };

    editor.on('selectionUpdate', updateMenu);
    editor.on('blur', () => {
      // Small timeout to allow clicking menu buttons before hiding
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setIsVisible(false);
        }
      }, 150);
    });

    return () => {
      editor.off('selectionUpdate', updateMenu);
    };
  }, [editor]);

  if (!isVisible) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const buttonClasses = (isActive: boolean) =>
    `p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center ${
      isActive
        ? 'bg-kano-accent text-white shadow-xs'
        : 'text-kano-text-secondary hover:text-kano-text-primary hover:bg-kano-surface-hover'
    }`;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 55,
      }}
      className="flex items-center gap-0.5 p-1 bg-kano-surface/95 backdrop-blur-xl border border-kano-border rounded-xl shadow-modal animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={buttonClasses(editor.isActive('bold'))}
        title="Bold (Cmd+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={buttonClasses(editor.isActive('italic'))}
        title="Italic (Cmd+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={buttonClasses(editor.isActive('strike'))}
        title="Strikethrough (Cmd+Shift+X)"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={buttonClasses(editor.isActive('code'))}
        title="Inline Code (Cmd+E)"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-kano-border mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={buttonClasses(editor.isActive('heading', { level: 1 }))}
        title="Heading 1"
      >
        <Heading1 className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={buttonClasses(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={buttonClasses(editor.isActive('taskList'))}
        title="To-do Task"
      >
        <CheckSquare className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-kano-border mx-1" />

      <button
        type="button"
        onClick={setLink}
        className={buttonClasses(editor.isActive('link'))}
        title="Add Link"
      >
        <LinkIcon className="w-3.5 h-3.5" />
      </button>

      {onAddComment && (
        <button
          type="button"
          onClick={() => {
            const { from, to } = editor.state.selection;
            const text = editor.state.doc.textBetween(from, to, ' ');
            onAddComment(text);
          }}
          className={buttonClasses(false)}
          title="Add Comment to Selection"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-amber-500" />
        </button>
      )}
    </div>
  );
};
