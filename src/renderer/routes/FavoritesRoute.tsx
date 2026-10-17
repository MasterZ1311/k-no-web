import React, { useState, useEffect } from 'react';
import { Star, FileText, CheckSquare, ArrowRight, Sparkles } from 'lucide-react';
import { RoutePath } from './types';
import { useRoom } from '../features/rooms/RoomContext';
import { EmptyState } from '../design-system/EmptyState';
import { LoadingState } from '../design-system/LoadingState';
import type { NoteDTO, TaskDTO } from '../../preload/types';

interface FavoritesRouteProps {
  onNavigate: (route: RoutePath) => void;
}

export const FavoritesRoute: React.FC<FavoritesRouteProps> = ({ onNavigate }) => {
  const { activeRoom } = useRoom();
  const [favoriteNotes, setFavoriteNotes] = useState<NoteDTO[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<TaskDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadFavorites() {
      if (!activeRoom || !window.kanoDesktop) {
        setFavoriteNotes([]);
        setUrgentTasks([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [notesRes, tasksRes] = await Promise.all([
          window.kanoDesktop.notes.getNotes(activeRoom.id, { isFavorite: true }),
          window.kanoDesktop.tasks.getTasks(activeRoom.id, { priority: 'urgent' }),
        ]);

        if (!isCancelled) {
          if (notesRes.success && notesRes.notes) {
            setFavoriteNotes(notesRes.notes);
          }
          if (tasksRes.success && tasksRes.tasks) {
            setUrgentTasks(tasksRes.tasks);
          }
        }
      } catch (err) {
        console.error('[FavoritesRoute] Error loading favorites:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadFavorites();
    return () => {
      isCancelled = true;
    };
  }, [activeRoom]);

  const hasItems = favoriteNotes.length > 0 || urgentTasks.length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 select-none max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-kano-text-primary flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          Favorites & Priority Items
        </h1>
        <p className="text-xs text-kano-text-muted mt-1">
          Quickly access starred documents and urgent tasks across your current room.
        </p>
      </div>

      {isLoading ? (
        <div className="py-16">
          <LoadingState label="Loading starred workspace items..." />
        </div>
      ) : !hasItems ? (
        <div className="py-16 border border-dashed border-kano-border rounded-xl bg-kano-surface">
          <EmptyState
            icon={<Star className="w-6 h-6 text-amber-500" />}
            title="No favorite items yet"
            description="Star notes or mark tasks as Urgent in this workspace to see them here for quick access."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {favoriteNotes.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-kano-text-muted uppercase tracking-wider mb-3">
                Starred Notes ({favoriteNotes.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {favoriteNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => onNavigate('/notes')}
                    className="p-4 rounded-xl bg-kano-surface border border-kano-border shadow-subtle hover:border-kano-accent cursor-pointer transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-kano-text-primary group-hover:text-kano-accent transition-colors truncate">
                          {note.title || 'Untitled Note'}
                        </h4>
                        <p className="text-[10px] text-kano-text-muted truncate mt-0.5">
                          {note.plainTextSummary || 'No summary available'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-kano-text-muted group-hover:text-kano-accent group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {urgentTasks.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-kano-text-muted uppercase tracking-wider mb-3">
                Urgent Priority Tasks ({urgentTasks.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {urgentTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onNavigate('/tasks')}
                    className="p-4 rounded-xl bg-kano-surface border border-rose-500/30 shadow-subtle hover:border-rose-500 cursor-pointer transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-kano-text-primary group-hover:text-rose-500 transition-colors truncate">
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-kano-text-muted">
                          <span className="uppercase font-semibold text-rose-500">Urgent</span>
                          <span>•</span>
                          <span className="capitalize">{task.status.replace('_', ' ')}</span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-kano-text-muted group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
