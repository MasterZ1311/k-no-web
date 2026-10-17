import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LayoutGrid, Plus, AlertCircle } from 'lucide-react';
import type { TaskDTO, BoardColumnDTO, BoardDTO } from '../../preload/types';
import { useRoom } from '../features/rooms/RoomContext';
import { useToast } from '../design-system/ToastProvider';
import { Button } from '../design-system/Button';
import { EmptyState } from '../design-system/EmptyState';
import { LoadingState } from '../design-system/LoadingState';
import { TaskCard } from '../features/tasks/TaskCard';
import { TaskDialog } from '../features/tasks/TaskDialog';
import { useRealtimeInvalidation } from '../features/realtime/RealtimeContext';

const COLUMN_COLOR_MAP: Record<string, { border: string; bg: string; dot: string }> = {
  todo: { border: 'border-l-indigo-500', bg: 'bg-indigo-500/10', dot: 'bg-indigo-500' },
  in_progress: { border: 'border-l-amber-500', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
  blocked: { border: 'border-l-rose-500', bg: 'bg-rose-500/10', dot: 'bg-rose-500' },
  done: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
};

export const BoardRoute: React.FC = () => {
  const { activeRoom, isLoading: isRoomLoading } = useRoom();
  const { showToast } = useToast();

  const [board, setBoard] = useState<BoardDTO | null>(null);
  const [columns, setColumns] = useState<BoardColumnDTO[]>([]);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogColumnId, setDialogColumnId] = useState<string | undefined>(undefined);
  const [taskToEdit, setTaskToEdit] = useState<TaskDTO | null>(null);

  const loadBoardData = useCallback(async () => {
    if (!activeRoom || !window.kanoDesktop?.boards || !window.kanoDesktop?.tasks) {
      setBoard(null);
      setColumns([]);
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [boardRes, tasksRes] = await Promise.all([
        window.kanoDesktop.boards.getBoard(activeRoom.id),
        window.kanoDesktop.tasks.getTasks(activeRoom.id),
      ]);

      if (boardRes.success) {
        if (boardRes.board) setBoard(boardRes.board);
        if (boardRes.columns) setColumns(boardRes.columns);
      } else {
        showToast(boardRes.error || 'Failed to load board', { type: 'error' });
      }

      if (tasksRes.success && tasksRes.tasks) {
        setTasks(tasksRes.tasks);
      }
    } catch (err) {
      console.error('[BoardRoute] Load failed:', err);
      showToast('Failed to load Kanban board', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [activeRoom, showToast]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

  // Reconcile on realtime board/task invalidations
  useRealtimeInvalidation(['tasks', 'boards', 'board_columns'], () => {
    loadBoardData();
  });

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const map = new Map<string, TaskDTO[]>();
    columns.forEach((col) => map.set(col.id, []));

    tasks.forEach((task) => {
      const list = map.get(task.columnId);
      if (list) {
        list.push(task);
      } else {
        // Fallback: match by status if columnId changed or not matched
        const matchedCol = columns.find((c) => c.statusKey === task.status);
        if (matchedCol) {
          const fallbackList = map.get(matchedCol.id);
          if (fallbackList) fallbackList.push(task);
        }
      }
    });

    // Sort by position within each column
    map.forEach((list) => {
      list.sort((a, b) => a.position - b.position);
    });

    return map;
  }, [columns, tasks]);

  // Atomic move task with optimistic update & rollback
  const handleMoveTask = async (taskId: string, targetColumnId: string, newPosition = 0) => {
    const targetCol = columns.find((c) => c.id === targetColumnId);
    if (!targetCol || !window.kanoDesktop?.boards) return;

    const prevTasks = [...tasks];

    // Optimistic state update
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? {
              ...t,
              columnId: targetColumnId,
              status: targetCol.statusKey,
              position: newPosition,
              completedAt: targetCol.statusKey === 'done' ? new Date().toISOString() : null,
            }
          : t
      )
    );

    try {
      const res = await window.kanoDesktop.boards.moveTask(taskId, targetColumnId, newPosition);
      if (!res.success) {
        throw new Error(res.error || 'Failed to move task');
      }
      if (res.task) {
        setTasks((current) => current.map((t) => (t.id === taskId ? res.task! : t)));
      }
    } catch (err) {
      // Rollback on failure
      setTasks(prevTasks);
      showToast(err instanceof Error ? err.message : 'Kanban movement failed', { type: 'error' });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, columnId: string) => {
    if (dragOverColumnId === columnId) {
      setDragOverColumnId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumnId(null);

    let taskId = draggedTaskId;
    if (!taskId) {
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        taskId = data.taskId;
      } catch {
        // ignore parse error
      }
    }

    if (taskId) {
      const colTasks = tasksByColumn.get(columnId) || [];
      const newPos = colTasks.length;
      await handleMoveTask(taskId, columnId, newPos);
    }
    setDraggedTaskId(null);
  };

  const handleOpenNewTask = (columnId?: string) => {
    setTaskToEdit(null);
    setDialogColumnId(columnId);
    setIsDialogOpen(true);
  };

  const handleCardClick = (task: TaskDTO) => {
    setTaskToEdit(task);
    setDialogColumnId(task.columnId);
    setIsDialogOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.kanoDesktop?.tasks) return;
    try {
      const res = await window.kanoDesktop.tasks.deleteTask(taskId);
      if (res.success) {
        setTasks((current) => current.filter((t) => t.id !== taskId));
        showToast('Task deleted', { type: 'info' });
      }
    } catch (err) {
      showToast('Failed to delete task', { type: 'error' });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 shrink-0 gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-kano-text-primary flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-kano-accent" />
            {board ? board.name : 'Main Kanban Board'}
          </h1>
          <p className="text-xs text-kano-text-muted mt-1">
            Authoritative 4-column board synchronized with task status and room activities.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          iconLeft={<Plus className="w-3.5 h-3.5" />}
          onClick={() => handleOpenNewTask(columns[0]?.id)}
          className="self-start sm:self-auto"
        >
          Add Task Card
        </Button>
      </div>

      {isRoomLoading || isLoading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <LoadingState label="Loading Kanban board..." />
        </div>
      ) : !activeRoom ? (
        <div className="flex-1 p-8">
          <EmptyState
            icon={<AlertCircle className="w-8 h-8 text-kano-accent" />}
            title="No Active Room"
            description="Select or create a workspace room to access Kanban workflows."
          />
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto min-h-0 pb-3 snap-x snap-mandatory">
        {columns.map((col) => {
          const colTasks = tasksByColumn.get(col.id) || [];
          const colorCfg = COLUMN_COLOR_MAP[col.statusKey] || COLUMN_COLOR_MAP.todo;
          const isDragOver = dragOverColumnId === col.id;

          return (
            <div
              key={col.id}
              id={`board-col-${col.id}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col bg-kano-bg border rounded-xl p-3 min-w-[270px] w-72 sm:w-80 flex-shrink-0 snap-start transition-colors ${
                isDragOver
                  ? 'border-kano-accent ring-2 ring-kano-accent/20 bg-kano-surface/80'
                  : 'border-kano-border'
              }`}
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between pb-2.5 mb-2 border-b border-kano-border pl-2 border-l-2 ${colorCfg.border}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-kano-text-primary">{col.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-kano-surface border border-kano-border text-kano-text-muted">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Add task to ${col.name}`}
                  onClick={() => handleOpenNewTask(col.id)}
                  className="text-kano-text-muted hover:text-kano-text-primary p-1 rounded hover:bg-kano-surface-hover transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Column Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex flex-col justify-center items-center p-3 border border-dashed border-kano-border/60 rounded-lg text-center bg-kano-surface/30">
                    <span className="text-xs text-kano-text-muted font-medium">No cards here</span>
                    <button
                      type="button"
                      onClick={() => handleOpenNewTask(col.id)}
                      className="text-[11px] text-kano-accent hover:underline mt-1 font-medium"
                    >
                      + Add task
                    </button>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      columns={columns}
                      onClick={() => handleCardClick(task)}
                      onMoveToColumn={(targetColId) => handleMoveTask(task.id, targetColId)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Task Creation / Edit Modal Dialog */}
      {activeRoom && (
        <TaskDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setTaskToEdit(null);
          }}
          roomId={activeRoom.id}
          columns={columns}
          initialColumnId={dialogColumnId}
          taskToEdit={taskToEdit}
          onSaved={loadBoardData}
          onDeleted={() => {
            loadBoardData();
          }}
        />
      )}
    </div>
  );
};
