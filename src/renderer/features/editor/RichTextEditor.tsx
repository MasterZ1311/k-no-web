import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Link as LinkIcon,
  Star,
  Pin,
  Trash2,
  Folder as FolderIcon,
  CheckCircle,
  Loader2,
  AlertTriangle,
  FolderOpen,
  Download,
} from 'lucide-react';
import { IconButton } from '../../design-system/IconButton';
import { Button } from '../../design-system/Button';
import { DropdownMenu } from '../../design-system/DropdownMenu';
import { useToast } from '../../design-system/ToastProvider';
import { AttachmentList } from './AttachmentList';
import { kanoDocToTipTap, tipTapToKanoDoc } from './converter';
import type { NoteDTO, FolderDTO, AttachmentDTO, KanoDocContent, NoteUpdateResult } from '../../../preload/types';

interface RichTextEditorProps {
  note: NoteDTO;
  folders: FolderDTO[];
  onUpdateNote: (
    noteId: string,
    expectedVersion: number,
    title?: string,
    content?: KanoDocContent,
    folderId?: string | null
  ) => Promise<NoteUpdateResult>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onTogglePin: (noteId: string, isPinned: boolean) => Promise<void>;
  onToggleFavorite: (noteId: string, isFavorite: boolean) => Promise<void>;
  onMoveNote: (noteId: string, folderId: string | null) => Promise<void>;
  attachments: AttachmentDTO[];
  onUploadAttachment: (file: File) => Promise<boolean>;
  onDeleteAttachment: (attachmentId: string) => Promise<boolean>;
  onDuplicateConflictNote?: (title: string, content: KanoDocContent) => Promise<void>;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  note,
  folders,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
  onToggleFavorite,
  onMoveNote,
  attachments,
  onUploadAttachment,
  onDeleteAttachment,
  onDuplicateConflictNote,
}) => {
  const { showToast } = useToast();
  const [title, setTitle] = useState(note.title);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [conflictData, setConflictData] = useState<{ currentVersion: number; currentNote?: NoteDTO } | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDirtyRef = useRef<boolean>(false);
  const latestVersionRef = useRef<number>(note.version);
  const currentNoteIdRef = useRef<string>(note.id);

  // Synchronize internal state when selected note changes
  useEffect(() => {
    currentNoteIdRef.current = note.id;
    latestVersionRef.current = note.version;
    setTitle(note.title);
    setSaveStatus('saved');
    setConflictData(null);
    isDirtyRef.current = false;
  }, [note.id, note.version, note.title]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-kano-accent underline cursor-pointer',
          },
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: kanoDocToTipTap(note.content),
    onUpdate: () => {
      isDirtyRef.current = true;
      setSaveStatus('unsaved');
      triggerDebouncedSave();
    },
  });

  // Keep TipTap content in sync if note changes
  useEffect(() => {
    if (editor && note) {
      const currentDoc = tipTapToKanoDoc(editor.getJSON());
      if (JSON.stringify(currentDoc) !== JSON.stringify(note.content)) {
        editor.commands.setContent(kanoDocToTipTap(note.content), { emitUpdate: false });
      }
    }
  }, [note.id, editor]);

  // Execute actual atomic save with optimistic concurrency
  const performSave = useCallback(
    async (overrideVersion?: number) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (!editor || !isDirtyRef.current) return;

      const expectedVer = overrideVersion !== undefined ? overrideVersion : latestVersionRef.current;
      const editorJson = editor.getJSON();
      const kanoContent = tipTapToKanoDoc(editorJson);

      setSaveStatus('saving');

      try {
        const result = await onUpdateNote(
          currentNoteIdRef.current,
          expectedVer,
          title,
          kanoContent,
          note.folderId
        );

        if (result.success && result.note) {
          latestVersionRef.current = result.note.version;
          isDirtyRef.current = false;
          setSaveStatus('saved');
          setConflictData(null);
        } else if (result.conflict) {
          setSaveStatus('conflict');
          setConflictData({
            currentVersion: result.currentVersion || expectedVer + 1,
            currentNote: result.currentNote,
          });
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        console.error('[Editor] Save failed:', err);
        setSaveStatus('error');
      }
    },
    [editor, onUpdateNote, title, note.folderId]
  );

  const triggerDebouncedSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, 800);
  }, [performSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    isDirtyRef.current = true;
    setSaveStatus('unsaved');
    triggerDebouncedSave();
  };

  const handleBlur = () => {
    if (isDirtyRef.current) {
      performSave();
    }
  };

  // Conflict resolution: force overwrite with latest remote version
  const handleResolveOverwrite = () => {
    if (conflictData) {
      performSave(conflictData.currentVersion);
    }
  };

  // Conflict resolution: save dirty buffer as separate copy
  const handleResolveDuplicate = async () => {
    if (!editor) return;
    const editorJson = editor.getJSON();
    const kanoContent = tipTapToKanoDoc(editorJson);
    if (onDuplicateConflictNote) {
      await onDuplicateConflictNote(`${title} (Conflict Copy)`, kanoContent);
    }
    // Revert current note view to remote version
    if (conflictData?.currentNote) {
      setTitle(conflictData.currentNote.title);
      latestVersionRef.current = conflictData.currentNote.version;
      editor.commands.setContent(kanoDocToTipTap(conflictData.currentNote.content));
      isDirtyRef.current = false;
      setConflictData(null);
      setSaveStatus('saved');
    }
  };

  // Conflict resolution: discard local edits and reload remote version
  const handleResolveDiscard = () => {
    if (conflictData?.currentNote && editor) {
      setTitle(conflictData.currentNote.title);
      latestVersionRef.current = conflictData.currentNote.version;
      editor.commands.setContent(kanoDocToTipTap(conflictData.currentNote.content));
      isDirtyRef.current = false;
      setConflictData(null);
      setSaveStatus('saved');
      showToast('Local changes discarded. Loaded server version.', { type: 'info' });
    }
  };

  // Export note as Markdown or JSON
  const handleExportNote = async (format: 'markdown' | 'json') => {
    if (!window.kanoDesktop?.export) return;
    try {
      const res = await window.kanoDesktop.export.exportNote(note.id, format);
      if (res.success) {
        showToast(`Note exported as ${format === 'markdown' ? 'Markdown (.md)' : 'JSON (.json)'}`, {
          type: 'success',
          description: res.filename ? `File: ${res.filename}` : undefined,
        });
      } else {
        showToast(res.error || 'Export failed', { type: 'error' });
      }
    } catch (err) {
      showToast('Export failed', { type: 'error' });
    }
  };

  const currentFolder = folders.find((f) => f.id === note.folderId);

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter link URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-kano-surface overflow-hidden">
      {/* 1. Note Header & Properties Toolbar */}
      <div className="border-b border-kano-border px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 bg-kano-surface flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Folder Assignment Badge / Dropdown */}
          <DropdownMenu
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover border border-kano-border-subtle transition-colors"
              >
                <FolderIcon className="w-3.5 h-3.5 text-amber-500" />
                <span className="truncate max-w-[120px]">
                  {currentFolder ? currentFolder.name : 'Uncategorized'}
                </span>
              </button>
            }
            items={[
              {
                id: 'folder-root',
                label: 'Uncategorized (Root)',
                icon: <FolderOpen className="w-3.5 h-3.5" />,
                onClick: () => onMoveNote(note.id, null),
              },
              ...folders.map((f) => ({
                id: `folder-${f.id}`,
                label: f.name,
                icon: <FolderIcon className="w-3.5 h-3.5 text-amber-500" />,
                onClick: () => onMoveNote(note.id, f.id),
              })),
            ]}
          />

          <span className="text-kano-border">/</span>

          {/* Editable Note Title */}
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleBlur}
            placeholder="Untitled Note"
            className="flex-1 font-bold text-base bg-transparent border-none outline-none text-kano-text-primary placeholder:text-kano-text-muted px-1 py-0.5 rounded focus:bg-kano-surface-hover transition-colors"
          />
        </div>

        {/* Action Controls & Save Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Save Status Badge */}
          <div className="flex items-center gap-1.5 text-xs mr-2 font-mono">
            {saveStatus === 'saved' && (
              <span className="text-emerald-500 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-[11px]">Saved</span>
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-amber-500 flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[11px]">Saving...</span>
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="text-kano-text-muted flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-[11px]">Unsaved</span>
              </span>
            )}
            {saveStatus === 'conflict' && (
              <span className="text-rose-500 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-[11px]">Conflict</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-rose-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-[11px]">Save error</span>
              </span>
            )}
          </div>

          <IconButton
            aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
            variant={note.isPinned ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onTogglePin(note.id, !note.isPinned)}
          >
            <Pin className="w-3.5 h-3.5" />
          </IconButton>

          <IconButton
            aria-label={note.isFavorite ? 'Unfavorite note' : 'Favorite note'}
            variant="ghost"
            size="sm"
            onClick={() => onToggleFavorite(note.id, !note.isFavorite)}
            className={note.isFavorite ? 'text-amber-500' : ''}
          >
            <Star className={`w-3.5 h-3.5 ${note.isFavorite ? 'fill-amber-500' : ''}`} />
          </IconButton>

          <DropdownMenu
            align="right"
            trigger={
              <IconButton aria-label="Export note" variant="ghost" size="sm">
                <Download className="w-3.5 h-3.5" />
              </IconButton>
            }
            items={[
              {
                id: 'export-md',
                label: 'Export Markdown (.md)',
                onClick: () => handleExportNote('markdown'),
              },
              {
                id: 'export-json',
                label: 'Export JSON (.json)',
                onClick: () => handleExportNote('json'),
              },
            ]}
          />

          <IconButton
            aria-label="Trash note"
            variant="ghost"
            size="sm"
            onClick={() => onDeleteNote(note.id)}
            className="text-kano-text-muted hover:text-rose-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      {/* 2. Version Conflict Warning Banner with 3 Explicit Recovery Choices */}
      {saveStatus === 'conflict' && conflictData && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-center justify-between text-xs text-rose-900 flex-shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>
              <strong>Version Conflict:</strong> This note was modified elsewhere (current v
              {conflictData.currentVersion}). Your changes are preserved in the editor.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleResolveDiscard}>
              Discard Local Changes
            </Button>
            <Button variant="secondary" size="sm" onClick={handleResolveDuplicate}>
              Save as Conflict Copy
            </Button>
            <Button variant="danger" size="sm" onClick={handleResolveOverwrite}>
              Overwrite Remote Version
            </Button>
          </div>
        </div>
      )}

      {/* 3. Formatting Toolbar */}
      <div className="border-b border-kano-border px-3 sm:px-6 py-1.5 flex items-center gap-1 bg-kano-bg/50 overflow-x-auto flex-nowrap sm:flex-wrap no-scrollbar flex-shrink-0">
        <IconButton
          aria-label="Bold"
          variant={editor.isActive('bold') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="w-7 h-7 p-1"
        >
          <Bold className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          aria-label="Italic"
          variant={editor.isActive('italic') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="w-7 h-7 p-1"
        >
          <Italic className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          aria-label="Strikethrough"
          variant={editor.isActive('strike') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className="w-7 h-7 p-1"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          aria-label="Code"
          variant={editor.isActive('code') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className="w-7 h-7 p-1"
        >
          <Code className="w-3.5 h-3.5" />
        </IconButton>

        <span className="w-px h-4 bg-kano-border mx-1" />

        <IconButton
          aria-label="Heading 1"
          variant={editor.isActive('heading', { level: 1 }) ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className="w-7 h-7 p-1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          aria-label="Heading 2"
          variant={editor.isActive('heading', { level: 2 }) ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="w-7 h-7 p-1"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          aria-label="Heading 3"
          variant={editor.isActive('heading', { level: 3 }) ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className="w-7 h-7 p-1"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </IconButton>

        <span className="w-px h-4 bg-kano-border mx-1" />

        <IconButton
          aria-label="Bullet list"
          variant={editor.isActive('bulletList') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="w-7 h-7 p-1"
        >
          <List className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          aria-label="Numbered list"
          variant={editor.isActive('orderedList') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="w-7 h-7 p-1"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          aria-label="Task checklist"
          variant={editor.isActive('taskList') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className="w-7 h-7 p-1"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </IconButton>

        <span className="w-px h-4 bg-kano-border mx-1" />

        <IconButton
          aria-label="Blockquote"
          variant={editor.isActive('blockquote') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className="w-7 h-7 p-1"
        >
          <Quote className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          aria-label="Code block"
          variant={editor.isActive('codeBlock') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className="w-7 h-7 p-1"
        >
          <Code className="w-3.5 h-3.5 font-bold" />
        </IconButton>
        <IconButton
          aria-label="Horizontal rule"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="w-7 h-7 p-1"
        >
          <Minus className="w-3.5 h-3.5" />
        </IconButton>

        <span className="w-px h-4 bg-kano-border mx-1" />

        <IconButton
          aria-label="Link"
          variant={editor.isActive('link') ? 'primary' : 'ghost'}
          size="sm"
          onClick={setLink}
          className="w-7 h-7 p-1"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </IconButton>
      </div>

      {/* 4. TipTap Prose Editor Content Area */}
      <div
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 cursor-text"
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} onBlur={handleBlur} />
      </div>

      {/* 5. Attachments Pane */}
      <AttachmentList
        roomId={note.roomId}
        noteId={note.id}
        attachments={attachments}
        onUploadAttachment={onUploadAttachment}
        onDeleteAttachment={onDeleteAttachment}
      />
    </div>
  );
};
