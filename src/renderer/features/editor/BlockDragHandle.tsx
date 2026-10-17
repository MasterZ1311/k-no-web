import React, { useState, useEffect, useRef } from 'react';
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  List,
  CheckSquare,
  Quote,
  Code,
  Type,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface BlockDragHandleProps {
  editor: Editor;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const BlockDragHandle: React.FC<BlockDragHandleProps> = ({ editor, containerRef }) => {
  const [handlePos, setHandlePos] = useState<{ top: number; left: number } | null>(null);
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Track hovered block in the editor
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current || isMenuOpen) return;

      const editorDom = container.querySelector('.tiptap');
      if (!editorDom) return;

      // Find top-level block under cursor
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || !editorDom.contains(target)) {
        if (!menuRef.current?.contains(target)) {
          // If cursor moves outside, hide unless hovering handle
          const handleEl = container.querySelector('.block-drag-handle-wrapper');
          if (!handleEl?.contains(target)) {
            setHandlePos(null);
            setActiveElement(null);
          }
        }
        return;
      }

      // Traverse upwards until we reach the direct child of .tiptap
      let current: HTMLElement | null = target as HTMLElement;
      while (current && current.parentElement !== editorDom && current !== editorDom) {
        current = current.parentElement;
      }

      if (current && current !== editorDom) {
        const containerRect = container.getBoundingClientRect();
        const blockRect = current.getBoundingClientRect();

        const top = blockRect.top - containerRect.top + container.scrollTop;
        const left = Math.max(4, blockRect.left - containerRect.left - 48);

        setHandlePos({ top, left });
        setActiveElement(current);
      }
    };

    const handleMouseLeave = () => {
      if (!isMenuOpen && !isDraggingRef.current) {
        setHandlePos(null);
        setActiveElement(null);
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, editor, isMenuOpen]);

  // Close block menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  if (!handlePos || !activeElement) return null;

  // Find ProseMirror node pos for current activeElement
  const getBlockPos = (): number | null => {
    try {
      const pos = editor.view.posAtDOM(activeElement, 0);
      return pos;
    } catch {
      return null;
    }
  };

  // Insert a new blank paragraph below the active block
  const handleInsertBelow = () => {
    const pos = getBlockPos();
    if (pos === null) return;

    try {
      const resolved = editor.state.doc.resolve(pos);
      const afterPos = resolved.end(1) + 1;
      editor
        .chain()
        .focus()
        .insertContentAt(afterPos, { type: 'paragraph' })
        .setTextSelection(afterPos + 1)
        .run();
    } catch {
      editor.chain().focus().run();
    }
    setIsMenuOpen(false);
  };

  // Duplicate current block
  const handleDuplicateBlock = () => {
    const pos = getBlockPos();
    if (pos === null) return;

    try {
      const resolved = editor.state.doc.resolve(pos);
      const blockNode = resolved.node(1);
      const afterPos = resolved.end(1) + 1;
      if (blockNode) {
        editor
          .chain()
          .focus()
          .insertContentAt(afterPos, blockNode.toJSON())
          .run();
      }
    } catch {}
    setIsMenuOpen(false);
  };

  // Delete current block
  const handleDeleteBlock = () => {
    const pos = getBlockPos();
    if (pos === null) return;

    try {
      const resolved = editor.state.doc.resolve(pos);
      const from = resolved.start(1) - 1;
      const to = resolved.end(1) + 1;
      editor.chain().focus().deleteRange({ from, to }).run();
    } catch {}
    setIsMenuOpen(false);
    setHandlePos(null);
  };

  // Convert block type
  const handleConvertBlock = (type: string, options?: Record<string, unknown>) => {
    const pos = getBlockPos();
    if (pos === null) return;

    try {
      editor.chain().focus().setTextSelection(pos).run();
      if (type === 'paragraph') {
        editor.chain().focus().setParagraph().run();
      } else if (type === 'heading') {
        const level = (options?.level as 1 | 2 | 3) || 1;
        editor.chain().focus().toggleHeading({ level }).run();
      } else if (type === 'bulletList') {
        editor.chain().focus().toggleBulletList().run();
      } else if (type === 'taskList') {
        editor.chain().focus().toggleTaskList().run();
      } else if (type === 'blockquote') {
        editor.chain().focus().toggleBlockquote().run();
      } else if (type === 'codeBlock') {
        editor.chain().focus().toggleCodeBlock().run();
      }
    } catch {}
    setIsMenuOpen(false);
  };

  // HTML5 Drag and drop reordering
  const handleDragStart = (e: React.DragEvent) => {
    isDraggingRef.current = true;
    const pos = getBlockPos();
    if (pos !== null) {
      e.dataTransfer.setData('text/plain', String(pos));
      e.dataTransfer.effectAllowed = 'move';
      if (activeElement) {
        activeElement.classList.add('opacity-40');
      }
    }
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    if (activeElement) {
      activeElement.classList.remove('opacity-40');
    }
  };

  return (
    <div
      className="block-drag-handle-wrapper absolute z-40 transition-all duration-75 flex items-center"
      style={{
        top: `${handlePos.top}px`,
        left: `${handlePos.left}px`,
      }}
    >
      <div className="flex items-center gap-0.5 bg-kano-surface/90 backdrop-blur-sm border border-kano-border/70 rounded-md shadow-subtle p-0.5 animate-in fade-in duration-100">
        {/* Quick Insert (+) Button */}
        <button
          type="button"
          onClick={handleInsertBelow}
          title="Click to add a block below"
          aria-label="Add block below"
          className="p-1 rounded text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* 6-dot Drag & Context Grip */}
        <button
          type="button"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          title="Drag to move, click to open block menu"
          aria-label="Block options and drag handle"
          className="p-1 rounded text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Notion-Style Block Options Popover */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute left-full top-0 ml-1.5 w-52 bg-kano-surface/98 backdrop-blur-xl border border-kano-border rounded-xl shadow-modal p-1.5 text-xs z-50 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-kano-text-muted border-b border-kano-border/60 mb-1">
            Block Actions
          </div>

          <div className="space-y-0.5">
            <button
              type="button"
              onClick={handleDuplicateBlock}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <Copy className="w-3.5 h-3.5 text-kano-accent" />
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteBlock}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Block</span>
            </button>
          </div>

          <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-kano-text-muted border-t border-kano-border/60 mt-1 mb-1">
            Turn Into
          </div>

          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleConvertBlock('paragraph')}
              className="w-full flex items-center gap-2 px-2 py-1.2 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Paragraph</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlock('heading', { level: 1 })}
              className="w-full flex items-center gap-2 px-2 py-1.2 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <Heading1 className="w-3.5 h-3.5 text-kano-accent" />
              <span>Heading 1</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlock('heading', { level: 2 })}
              className="w-full flex items-center gap-2 px-2 py-1.2 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <Heading2 className="w-3.5 h-3.5 text-sky-500" />
              <span>Heading 2</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlock('heading', { level: 3 })}
              className="w-full flex items-center gap-2 px-2 py-1.2 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <Heading3 className="w-3.5 h-3.5 text-violet-500" />
              <span>Heading 3</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlock('taskList')}
              className="w-full flex items-center gap-2 px-2 py-1.2 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>To-do Task</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlock('bulletList')}
              className="w-full flex items-center gap-2 px-2 py-1.2 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <List className="w-3.5 h-3.5 text-amber-500" />
              <span>Bullet List</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlock('blockquote')}
              className="w-full flex items-center gap-2 px-2 py-1.2 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <Quote className="w-3.5 h-3.5 text-rose-500" />
              <span>Quote</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlock('codeBlock')}
              className="w-full flex items-center gap-2 px-2 py-1.2 rounded-lg hover:bg-kano-surface-hover text-kano-text-secondary hover:text-kano-text-primary transition-colors text-left"
            >
              <Code className="w-3.5 h-3.5 text-cyan-500" />
              <span>Code Block</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
