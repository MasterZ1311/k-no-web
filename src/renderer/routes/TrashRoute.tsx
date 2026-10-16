import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, RotateCcw, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../design-system/Button';
import { Dialog } from '../design-system/Dialog';
import { EmptyState } from '../design-system/EmptyState';
import { LoadingState } from '../design-system/LoadingState';
import { useToast } from '../design-system/ToastProvider';
import { useRooms } from '../features/rooms/RoomContext';
import { useRealtime } from '../features/realtime/RealtimeContext';
import type { NoteDTO } from '../../preload/types';

export const TrashRoute: React.FC = () => {
  const { activeRoom } = useRooms();
  const { showToast } = useToast();
  const { subscribeInvalidation } = useRealtime();

  const [trashNotes, setTrashNotes] = useState<NoteDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Confirmation Dialog States
  const [noteToDelete, setNoteToDelete] = useState<NoteDTO | null>(null);
  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTrash = useCallback(async () => {
    if (!activeRoom || !window.kanoDesktop?.notes) {
      setTrashNotes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await window.kanoDesktop.notes.getTrashNotes(activeRoom.id);
      if (res.success && res.notes) {
        setTrashNotes(res.notes);
      } else {
        setError(res.error || 'Failed to load trash.');
      }
    } catch (err) {
      console.error('[TrashRoute] Failed to load trash:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trash items.');
    } finally {
      setIsLoading(false);
    }
  }, [activeRoom]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  // Realtime live refresh on note changes
  useEffect(() => {
    const unsubscribe = subscribeInvalidation((event) => {
      if (event.roomId === activeRoom?.id && event.table === 'notes') {
        loadTrash();
      }
    });
    return unsubscribe;
  }, [activeRoom?.id, loadTrash, subscribeInvalidation]);

  const handleRestoreNote = async (noteId: string) => {
    if (!window.kanoDesktop?.notes) return;
    try {
      const res = await window.kanoDesktop.notes.restoreNote(noteId);
      if (res.success) {
        setTrashNotes((prev) => prev.filter((n) => n.id !== noteId));
        showToast('Note restored', {
          type: 'success',
          description: 'Restored note is now active in your workspace (moved to root if parent folder was deleted).',
        });
      } else {
        showToast(res.error || 'Failed to restore note', { type: 'error' });
      }
    } catch (err) {
      showToast('Restore failed', { type: 'error' });
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!noteToDelete || !window.kanoDesktop?.notes) return;
    setIsDeleting(true);
    try {
      const res = await window.kanoDesktop.notes.permanentlyDeleteNote(noteToDelete.id);
      if (res.success) {
        setTrashNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
        showToast('Note permanently deleted', { type: 'info' });
        setNoteToDelete(null);
      } else {
        showToast(res.error || 'Failed to delete note', { type: 'error' });
      }
    } catch (err) {
      showToast('Delete failed', { type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    const desktop = window.kanoDesktop;
    if (!desktop?.notes || trashNotes.length === 0) return;
    setIsDeleting(true);
    try {
      await Promise.all(trashNotes.map((n) => desktop.notes.permanentlyDeleteNote(n.id)));
      setTrashNotes([]);
      setIsEmptyTrashOpen(false);
      showToast('Trash emptied', {
        type: 'info',
        description: 'All trashed items have been permanently purged.',
      });
    } catch (err) {
      showToast('Failed to empty trash', { type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none bg-kano-bg max-w-5xl mx-auto">
      {/* Route Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-kano-text-primary flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-kano-text-muted" />
            Trash & Soft Deletion
          </h1>
          <p className="text-xs text-kano-text-muted mt-1">
            Items in trash remain restorable. Restoring an item whose folder was deleted places it at the workspace root.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadTrash}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {trashNotes.length > 0 && (
            <Button variant="danger" size="sm" onClick={() => setIsEmptyTrashOpen(true)}>
              Empty Trash ({trashNotes.length})
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={loadTrash}>
            Retry
          </Button>
        </div>
      )}

      {/* Content State */}
      {!activeRoom ? (
        <div className="py-16 border border-dashed border-kano-border rounded-xl bg-kano-surface">
          <EmptyState
            icon={<Trash2 className="w-6 h-6 text-kano-text-muted" />}
            title="No Active Workspace"
            description="Select or create a workspace room to view trash."
          />
        </div>
      ) : isLoading && trashNotes.length === 0 ? (
        <div className="py-16">
          <LoadingState label="Loading trashed items..." />
        </div>
      ) : trashNotes.length === 0 ? (
        <div className="py-16 border border-dashed border-kano-border rounded-xl bg-kano-surface">
          <EmptyState
            icon={<Trash2 className="w-6 h-6 text-kano-text-muted" />}
            title="Trash is empty"
            description="Deleted notes will appear here before being permanently removed."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {trashNotes.map((note) => {
            const deletedDate = note.deletedAt
              ? new Date(note.deletedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recently';

            return (
              <div
                key={note.id}
                className="bg-kano-surface border border-kano-border rounded-xl p-4 flex items-center justify-between text-xs shadow-subtle hover:border-kano-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                  <div className="w-8 h-8 rounded-lg bg-kano-bg border border-kano-border flex items-center justify-center text-kano-text-muted flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-kano-text-primary truncate">
                      {note.title || 'Untitled Note'}
                    </h4>
                    <p className="text-[11px] text-kano-text-muted truncate mt-0.5">
                      Deleted: {deletedDate} {note.plainTextSummary ? `• ${note.plainTextSummary}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => handleRestoreNote(note.id)}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setNoteToDelete(note)}
                  >
                    Delete Forever
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog: Permanent Delete Single Note */}
      <Dialog
        isOpen={Boolean(noteToDelete)}
        onClose={() => setNoteToDelete(null)}
        title="Permanently Delete Note?"
        description="This action cannot be undone. The note and any associated attachments will be permanently removed."
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNoteToDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmPermanentDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            Are you sure you want to delete <strong>"{noteToDelete?.title || 'Untitled Note'}"</strong>?
          </span>
        </div>
      </Dialog>

      {/* Confirmation Dialog: Empty Trash */}
      <Dialog
        isOpen={isEmptyTrashOpen}
        onClose={() => setIsEmptyTrashOpen(false)}
        title="Empty Trash?"
        description="All items in the trash will be permanently purged. This action cannot be reversed."
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEmptyTrashOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmEmptyTrash}
              disabled={isDeleting}
            >
              {isDeleting ? 'Purging...' : `Empty All (${trashNotes.length})`}
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            You are about to permanently purge <strong>{trashNotes.length}</strong> items.
          </span>
        </div>
      </Dialog>
    </div>
  );
};
