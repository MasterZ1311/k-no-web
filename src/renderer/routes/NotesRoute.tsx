import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Pin,
  Star,
  Download,
} from 'lucide-react';
import { Button } from '../design-system/Button';
import { IconButton } from '../design-system/IconButton';
import { DropdownMenu } from '../design-system/DropdownMenu';
import { EmptyState } from '../design-system/EmptyState';
import { useToast } from '../design-system/ToastProvider';
import { useRooms } from '../features/rooms/RoomContext';
import { FolderTree } from '../features/folders/FolderTree';
import { CreateFolderDialog } from '../features/folders/CreateFolderDialog';
import { RenameFolderDialog } from '../features/folders/RenameFolderDialog';
import { RichTextEditor } from '../features/editor/RichTextEditor';
import { useRealtimeInvalidation } from '../features/realtime/RealtimeContext';
import type { FolderDTO, NoteDTO, AttachmentDTO, KanoDocContent, NoteUpdateResult } from '../../preload/types';

export const NotesRoute: React.FC = () => {
  const { activeRoom } = useRooms();
  const { showToast } = useToast();

  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [notes, setNotes] = useState<NoteDTO[]>([]);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string | 'all' | 'uncategorized'>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Folder Dialog States
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderDTO | null>(null);

  // Attachments State for the currently selected note
  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);

  // 1. Fetch folders and notes for active room
  const loadData = useCallback(async () => {
    if (!activeRoom || !window.kanoDesktop) {
      setFolders([]);
      setNotes([]);
      setSelectedNoteId(null);
      return;
    }

    try {
      const [foldersRes, notesRes] = await Promise.all([
        window.kanoDesktop.folders.getFolders(activeRoom.id),
        window.kanoDesktop.notes.getNotes(activeRoom.id),
      ]);

      if (foldersRes.success && foldersRes.folders) {
        setFolders(foldersRes.folders);
      }

      if (notesRes.success && notesRes.notes) {
        setNotes(notesRes.notes);
        // Default select first note if none selected or if selected note was deleted
        setSelectedNoteId((prev) => {
          if (prev && notesRes.notes.some((n) => n.id === prev)) {
            return prev;
          }
          return notesRes.notes.length > 0 ? notesRes.notes[0].id : null;
        });
      }
    } catch (err) {
      console.error('[NotesRoute] Failed to load data:', err);
      showToast('Failed to load notes', { type: 'error' });
    }
  }, [activeRoom, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reconcile on realtime invalidation events
  useRealtimeInvalidation(['notes', 'folders'], (events) => {
    loadData();
    const wasDeleted = events.some(
      (e) => e.table === 'notes' && e.eventType === 'DELETE' && e.id === selectedNoteId
    );
    if (wasDeleted) {
      showToast('The note you were viewing was deleted.', { type: 'info' });
      setSelectedNoteId(null);
    }
  });

  // 2. Fetch attachments when selectedNoteId changes
  useEffect(() => {
    let isCancelled = false;

    async function loadAttachments() {
      if (!selectedNoteId || !window.kanoDesktop?.attachments) {
        setAttachments([]);
        return;
      }

      try {
        const res = await window.kanoDesktop.attachments.getNoteAttachments(selectedNoteId);
        if (!isCancelled && res.success && res.attachments) {
          setAttachments(res.attachments);
        }
      } catch (err) {
        console.error('[NotesRoute] Failed to load attachments:', err);
      }
    }

    loadAttachments();

    return () => {
      isCancelled = true;
    };
  }, [selectedNoteId]);

  // 3. Folder operations
  const handleCreateFolder = async (name: string, parentId?: string | null): Promise<boolean> => {
    if (!activeRoom || !window.kanoDesktop?.folders) return false;
    try {
      const res = await window.kanoDesktop.folders.createFolder(activeRoom.id, name, parentId);
      if (res.success && res.folder) {
        setFolders((prev) => [...prev, res.folder!]);
        showToast(`Folder "${res.folder.name}" created`, { type: 'success' });
        return true;
      }
      showToast(res.error || 'Failed to create folder', { type: 'error' });
      return false;
    } catch (err) {
      showToast('Folder creation failed', { type: 'error' });
      return false;
    }
  };

  const handleRenameFolder = async (folderId: string, name: string): Promise<boolean> => {
    if (!window.kanoDesktop?.folders) return false;
    try {
      const res = await window.kanoDesktop.folders.renameFolder(folderId, name);
      if (res.success && res.folder) {
        setFolders((prev) => prev.map((f) => (f.id === folderId ? res.folder! : f)));
        showToast('Folder renamed', { type: 'success' });
        return true;
      }
      showToast(res.error || 'Failed to rename folder', { type: 'error' });
      return false;
    } catch (err) {
      showToast('Rename failed', { type: 'error' });
      return false;
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.kanoDesktop?.folders) return;
    try {
      const res = await window.kanoDesktop.folders.deleteFolder(folderId);
      if (res.success) {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (selectedFolderFilter === folderId) {
          setSelectedFolderFilter('all');
        }
        showToast('Folder deleted', { type: 'info' });
        loadData();
      } else {
        showToast(res.error || 'Failed to delete folder', { type: 'error' });
      }
    } catch (err) {
      showToast('Failed to delete folder', { type: 'error' });
    }
  };

  // 4. Note operations
  const handleCreateNote = async () => {
    if (!activeRoom || !window.kanoDesktop?.notes) return;

    const targetFolderId =
      selectedFolderFilter === 'all' || selectedFolderFilter === 'uncategorized'
        ? null
        : selectedFolderFilter;

    try {
      const res = await window.kanoDesktop.notes.createNote(
        activeRoom.id,
        targetFolderId,
        'Untitled Note'
      );

      if (res.success && res.note) {
        setNotes((prev) => [res.note!, ...prev]);
        setSelectedNoteId(res.note.id);
        showToast('New note created', { type: 'success' });
        // Update folder note count
        if (targetFolderId) {
          setFolders((prev) =>
            prev.map((f) => (f.id === targetFolderId ? { ...f, noteCount: (f.noteCount || 0) + 1 } : f))
          );
        }
      } else {
        showToast(res.error || 'Failed to create note', { type: 'error' });
      }
    } catch (err) {
      showToast('Note creation failed', { type: 'error' });
    }
  };

  const handleUpdateNote = async (
    noteId: string,
    expectedVersion: number,
    title?: string,
    content?: KanoDocContent,
    folderId?: string | null
  ): Promise<NoteUpdateResult> => {
    if (!window.kanoDesktop?.notes) {
      return { success: false, error: 'Desktop bridge unavailable.' };
    }

    const res = await window.kanoDesktop.notes.updateNoteWithVersion(
      noteId,
      expectedVersion,
      title,
      content,
      folderId
    );

    if (res.success && res.note) {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? res.note! : n)));
    }

    return res;
  };

  const handleTrashNote = async (noteId: string) => {
    if (!window.kanoDesktop?.notes) return;
    try {
      const res = await window.kanoDesktop.notes.trashNote(noteId);
      if (res.success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        setSelectedNoteId((prev) => {
          if (prev === noteId) {
            const remaining = notes.filter((n) => n.id !== noteId);
            return remaining.length > 0 ? remaining[0].id : null;
          }
          return prev;
        });
        showToast('Note moved to Trash', { type: 'info' });
        loadData();
      } else {
        showToast(res.error || 'Failed to trash note', { type: 'error' });
      }
    } catch (err) {
      showToast('Failed to trash note', { type: 'error' });
    }
  };

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    if (!window.kanoDesktop?.notes) return;
    try {
      const res = await window.kanoDesktop.notes.togglePin(noteId, isPinned);
      if (res.success) {
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, isPinned } : n)).sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          })
        );
      }
    } catch (err) {
      showToast('Failed to toggle pin', { type: 'error' });
    }
  };

  const handleToggleFavorite = async (noteId: string, isFavorite: boolean) => {
    if (!window.kanoDesktop?.notes) return;
    try {
      const res = await window.kanoDesktop.notes.toggleFavorite(noteId, isFavorite);
      if (res.success) {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, isFavorite } : n)));
      }
    } catch (err) {
      showToast('Failed to toggle favorite', { type: 'error' });
    }
  };

  const handleMoveNote = async (noteId: string, folderId: string | null) => {
    if (!window.kanoDesktop?.notes) return;
    try {
      const res = await window.kanoDesktop.notes.moveNote(noteId, folderId);
      if (res.success) {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, folderId } : n)));
        showToast('Note moved', { type: 'success' });
        loadData();
      } else {
        showToast(res.error || 'Failed to move note', { type: 'error' });
      }
    } catch (err) {
      showToast('Failed to move note', { type: 'error' });
    }
  };

  const handleDuplicateConflictNote = async (title: string, content: KanoDocContent) => {
    if (!activeRoom || !window.kanoDesktop?.notes) return;
    try {
      const res = await window.kanoDesktop.notes.createNote(
        activeRoom.id,
        null,
        title,
        content
      );
      if (res.success && res.note) {
        setNotes((prev) => [res.note!, ...prev]);
        showToast('Conflict copy saved as a new note', { type: 'info' });
      }
    } catch (err) {
      showToast('Failed to duplicate conflict note', { type: 'error' });
    }
  };

  // 5. Attachment operations
  const handleUploadAttachment = async (file: File): Promise<boolean> => {
    if (!activeRoom || !selectedNoteId || !window.kanoDesktop?.attachments) return false;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await window.kanoDesktop.attachments.uploadAttachment(
        activeRoom.id,
        selectedNoteId,
        file.name,
        file.type,
        arrayBuffer
      );

      if (res.success && res.attachment) {
        setAttachments((prev) => [...prev, res.attachment!]);
        return true;
      }
      showToast(res.error || 'Upload failed', { type: 'error' });
      return false;
    } catch (err) {
      showToast('Upload error', { type: 'error' });
      return false;
    }
  };

  const handleDeleteAttachment = async (attachmentId: string): Promise<boolean> => {
    if (!window.kanoDesktop?.attachments) return false;
    try {
      const res = await window.kanoDesktop.attachments.deleteAttachment(attachmentId);
      if (res.success) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        showToast('Attachment deleted', { type: 'info' });
        return true;
      }
      showToast(res.error || 'Failed to delete attachment', { type: 'error' });
      return false;
    } catch (err) {
      showToast('Delete error', { type: 'error' });
      return false;
    }
  };

  const handleExportRoom = async (format: 'markdown' | 'json') => {
    if (!activeRoom || !window.kanoDesktop?.export) return;
    try {
      showToast('Exporting workspace...', { type: 'info' });
      const res = await window.kanoDesktop.export.exportRoom(activeRoom.id, format);
      if (res.success) {
        showToast(
          `Workspace exported (${res.exportedNotesCount} notes, ${res.exportedFoldersCount} folders)`,
          {
            type: 'success',
            description: res.outputPath ? `Folder: ${res.outputPath}` : undefined,
          }
        );
      } else {
        showToast(res.errors?.[0] || 'Room export failed', { type: 'error' });
      }
    } catch (err) {
      showToast('Room export failed', { type: 'error' });
    }
  };

  // Filter notes by selected folder and search query
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // Folder filter
      if (selectedFolderFilter === 'uncategorized' && n.folderId !== null) {
        return false;
      }
      if (selectedFolderFilter !== 'all' && selectedFolderFilter !== 'uncategorized' && n.folderId !== selectedFolderFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesSummary = n.plainTextSummary?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSummary) return false;
      }

      return true;
    });
  }, [notes, selectedFolderFilter, searchQuery]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  const uncategorizedCount = useMemo(() => {
    return notes.filter((n) => n.folderId === null).length;
  }, [notes]);

  if (!activeRoom) {
    return (
      <div className="flex-1 flex flex-col h-full select-none bg-kano-bg">
        <div className="p-4 border-b border-kano-border bg-kano-surface">
          <h1 className="text-base font-bold text-kano-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-kano-accent" />
            Notes & Documents
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <EmptyState
            icon={<FileText className="w-8 h-8 text-kano-text-muted" />}
            title="No Active Workspace"
            description="Create or select a room to access your shared notes and documents."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden select-none bg-kano-bg">
      {/* Column 1: Folder Tree (Width 220px) */}
      <div className="w-56 border-r border-kano-border bg-kano-surface flex flex-col flex-shrink-0">
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderFilter}
          onSelectFolder={setSelectedFolderFilter}
          onCreateFolder={(parentId) => {
            setCreateFolderParentId(parentId || null);
            setIsCreateFolderOpen(true);
          }}
          onRenameFolder={(folder) => setRenameFolderTarget(folder)}
          onDeleteFolder={handleDeleteFolder}
          totalNotesCount={notes.length}
          uncategorizedNotesCount={uncategorizedCount}
        />
      </div>

      {/* Column 2: Notes List (Width 280px) */}
      <div className="w-72 border-r border-kano-border bg-kano-surface flex flex-col flex-shrink-0">
        {/* Header & Search */}
        <div className="p-3 border-b border-kano-border space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xs font-bold text-kano-text-primary tracking-tight flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-kano-accent" />
              Notes & Documents ({filteredNotes.length})
            </h1>
            <div className="flex items-center gap-1.5">
              <DropdownMenu
                align="right"
                trigger={
                  <IconButton aria-label="Export workspace" variant="ghost" size="sm">
                    <Download className="w-3.5 h-3.5" />
                  </IconButton>
                }
                items={[
                  {
                    id: 'export-room-md',
                    label: 'Export Room (Markdown)',
                    onClick: () => handleExportRoom('markdown'),
                  },
                  {
                    id: 'export-room-json',
                    label: 'Export Room (JSON)',
                    onClick: () => handleExportRoom('json'),
                  },
                ]}
              />
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Plus className="w-3.5 h-3.5" />}
                onClick={handleCreateNote}
              >
                New Note
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-kano-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-kano-bg border border-kano-border text-kano-text-primary placeholder:text-kano-text-muted focus:outline-none focus:border-kano-accent transition-colors"
            />
          </div>
        </div>

        {/* Scrollable Note Cards */}
        <div className="flex-1 overflow-y-auto divide-y divide-kano-border-subtle">
          {filteredNotes.length === 0 ? (
            <div className="p-6 text-center text-xs text-kano-text-muted">
              {searchQuery ? 'No notes matching search' : 'No notes in this view'}
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isSelected = selectedNoteId === note.id;
              const dateStr = new Date(note.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`p-3 cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-kano-surface-hover border-l-2 border-kano-accent'
                      : 'hover:bg-kano-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-kano-text-primary truncate flex-1 pr-2">
                      {note.title || 'Untitled Note'}
                    </h4>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {note.isPinned && <Pin className="w-3 h-3 text-kano-accent" />}
                      {note.isFavorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    </div>
                  </div>

                  {note.plainTextSummary ? (
                    <p className="text-[11px] text-kano-text-muted line-clamp-2 leading-relaxed mb-1.5">
                      {note.plainTextSummary}
                    </p>
                  ) : (
                    <p className="text-[11px] text-kano-text-muted/60 italic mb-1.5">Empty note</p>
                  )}

                  <span className="text-[10px] text-kano-text-muted font-mono">{dateStr}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column 3: Active Note Editor Pane */}
      <div className="flex-1 flex flex-col h-full bg-kano-surface min-w-0">
        {selectedNote ? (
          <RichTextEditor
            key={selectedNote.id}
            note={selectedNote}
            folders={folders}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleTrashNote}
            onTogglePin={handleTogglePin}
            onToggleFavorite={handleToggleFavorite}
            onMoveNote={handleMoveNote}
            attachments={attachments}
            onUploadAttachment={handleUploadAttachment}
            onDeleteAttachment={handleDeleteAttachment}
            onDuplicateConflictNote={handleDuplicateConflictNote}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 select-none">
            <EmptyState
              icon={<FileText className="w-8 h-8 text-kano-text-muted" />}
              title="No Note Selected"
              description="Choose a note from the list or create a new rich-text document."
              actionLabel="Create Note"
              onAction={handleCreateNote}
            />
          </div>
        )}
      </div>

      {/* Folder Dialogs */}
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        parentId={createFolderParentId}
        parentFolder={folders.find((f) => f.id === createFolderParentId)}
        onSubmit={handleCreateFolder}
      />

      <RenameFolderDialog
        isOpen={!!renameFolderTarget}
        onClose={() => setRenameFolderTarget(null)}
        folder={renameFolderTarget}
        onSubmit={handleRenameFolder}
      />
    </div>
  );
};
