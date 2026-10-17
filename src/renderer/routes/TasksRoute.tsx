import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Calendar,
  Check,
  Edit2,
} from 'lucide-react';
import type { TaskDTO, BoardColumnDTO, TaskPriority } from '../../preload/types';
import { useRoom } from '../features/rooms/RoomContext';
import { useToast } from '../design-system/ToastProvider';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import { EmptyState } from '../design-system/EmptyState';
import { LoadingState } from '../design-system/LoadingState';
import { TaskDialog } from '../features/tasks/TaskDialog';
import { useRealtimeInvalidation } from '../features/realtime/RealtimeContext';

type FilterTab = 'all' | 'todo' | 'in_progress' | 'blocked' | 'done';

const STATUS_TAB_CONFIG: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All Tasks' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Completed' },
];

const PRIORITY_BADGE_CONFIG: Record<TaskPriority, { label: string; bg: string; text: string; dot: string }> = {
  urgent: { label: 'Urgent', bg: 'bg-rose-500/10 border border-rose-500/20', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' },
  high: { label: 'High', bg: 'bg-amber-500/10 border border-amber-500/20', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  medium: { label: 'Medium', bg: 'bg-blue-500/10 border border-blue-500/20', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  low: { label: 'Low', bg: 'bg-slate-500/10 border border-slate-500/20', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
};

export const TasksRoute: React.FC = () => {
  const { activeRoom, isLoading: isRoomLoading } = useRoom();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [columns, setColumns] = useState<BoardColumnDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TaskDTO | null>(null);

  const loadData = useCallback(async () => {
    if (!activeRoom || !window.kanoDesktop?.tasks || !window.kanoDesktop?.boards) {
      setTasks([]);
      setColumns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [boardRes, tasksRes] = await Promise.all([
        window.kanoDesktop.boards.getBoard(activeRoom.id),
        window.kanoDesktop.tasks.getTasks(activeRoom.id),
      ]);

      if (boardRes.success && boardRes.columns) {
        setColumns(boardRes.columns);
      }
      if (tasksRes.success && tasksRes.tasks) {
        setTasks(tasksRes.tasks);
      } else if (tasksRes.error) {
        showToast(tasksRes.error, { type: 'error' });
      }
    } catch (err) {
      console.error('[TasksRoute] Load failed:', err);
      showToast('Failed to load tasks', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [activeRoom, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reconcile on realtime task invalidations
  useRealtimeInvalidation(['tasks', 'task_checklists', 'task_labels', 'task_label_assignments'], () => {
    loadData();
  });

  // Handle quick complete toggle
  const handleToggleComplete = async (task: TaskDTO) => {
    if (!activeRoom || !columns.length || !window.kanoDesktop?.boards) return;

    const isDone = task.status === 'done';
    let targetCol: BoardColumnDTO | undefined;

    if (isDone) {
      // Move to 'todo' column
      targetCol = columns.find((c) => c.statusKey === 'todo') || columns[0];
    } else {
      // Move to 'done' column
      targetCol = columns.find((c) => c.statusKey === 'done') || columns[columns.length - 1];
    }

    if (!targetCol) return;

    // Optimistic update
    const prevTasks = [...tasks];
    setTasks((current) =>
      current.map((t) =>
        t.id === task.id
          ? {
              ...t,
              columnId: targetCol!.id,
              status: targetCol!.statusKey,
              completedAt: !isDone ? new Date().toISOString() : null,
            }
          : t
      )
    );

    try {
      const res = await window.kanoDesktop.boards.moveTask(task.id, targetCol.id);
      if (!res.success) {
        throw new Error(res.error || 'Failed to move task');
      }
      if (res.task) {
        setTasks((current) => current.map((t) => (t.id === task.id ? res.task! : t)));
      }
    } catch (err) {
      // Rollback
      setTasks(prevTasks);
      showToast(err instanceof Error ? err.message : 'Failed to update task', { type: 'error' });
    }
  };

  // Filtered task list
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Status tab filter
      if (activeTab !== 'all' && task.status !== activeTab) {
        return false;
      }
      // Priority filter
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = (task.description || '').toLowerCase().includes(query);
        const matchesLabel = task.labels?.some((l) => l.name.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesLabel) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, activeTab, selectedPriority, searchQuery]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: tasks.length,
      todo: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
    };
    tasks.forEach((t) => {
      if (counts[t.status as FilterTab] !== undefined) {
        counts[t.status as FilterTab]++;
      }
    });
    return counts;
  }, [tasks]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-kano-text-primary flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-kano-accent" />
            Tasks & Checklists
          </h1>
          <p className="text-sm text-kano-text-muted mt-1">
            Single authoritative task records synchronized with Kanban boards, reminders, and calendar deadlines.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          iconLeft={<Plus className="w-4 h-4" />}
          onClick={() => {
            setTaskToEdit(null);
            setIsDialogOpen(true);
          }}
          className="self-start sm:self-auto h-9 px-3.5 text-sm font-medium whitespace-nowrap shrink-0"
        >
          New Task
        </Button>
      </div>

      {/* Filter Bar & Tabs */}
      <div className="space-y-3">
        {/* Apple-style Segmented Filter Track */}
        <div className="p-1 bg-kano-surface/80 border border-kano-border rounded-xl flex items-center gap-1 overflow-x-auto no-scrollbar shadow-subtle backdrop-blur-sm">
          {STATUS_TAB_CONFIG.map((tab) => {
            const isCurrent = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center gap-2 shrink-0 whitespace-nowrap active:scale-[0.98] ${
                  isCurrent
                    ? 'bg-kano-accent text-white shadow-sm font-semibold'
                    : 'text-kano-text-secondary hover:bg-kano-surface-hover hover:text-kano-text-primary'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md ${
                    isCurrent ? 'bg-white/20 text-white' : 'bg-kano-bg border border-kano-border text-kano-text-muted'
                  }`}
                >
                  {tabCounts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Priority Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-kano-text-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, descriptions, or labels..."
              className="text-sm pl-9 h-10 w-full"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2.5 shrink-0">
            <span className="text-sm text-kano-text-muted flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" /> Priority:
            </span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="text-sm rounded-lg border border-kano-border bg-kano-surface px-3 py-2 h-10 text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List Content */}
      {isRoomLoading || isLoading ? (
        <div className="py-12 flex items-center justify-center">
          <LoadingState label="Loading room tasks..." />
        </div>
      ) : !activeRoom ? (
        <div className="py-12 border border-dashed border-kano-border rounded-xl bg-kano-surface">
          <EmptyState
            icon={<AlertCircle className="w-8 h-8 text-kano-accent" />}
            title="No Active Room"
            description="Select or create a workspace room to manage tasks and checklists."
          />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-12 border border-dashed border-kano-border rounded-xl bg-kano-surface">
          <EmptyState
            illustrationSrc="/empty-tasks.svg"
            icon={<CheckSquare className="w-6 h-6 text-kano-text-muted" />}
            title={tasks.length === 0 ? 'No tasks in this workspace' : 'No matching tasks'}
            description={
              tasks.length === 0
                ? 'Create tasks to track action items, organize with Kanban columns, and schedule milestones.'
                : 'Try adjusting your search criteria or status filter to see other tasks.'
            }
            actionLabel={tasks.length === 0 ? 'Create First Task' : undefined}
            onAction={
              tasks.length === 0
                ? () => {
                    setTaskToEdit(null);
                    setIsDialogOpen(true);
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const isDone = task.status === 'done';
            const col = columns.find((c) => c.id === task.columnId);
            const priorityBadge = PRIORITY_BADGE_CONFIG[task.priority] || PRIORITY_BADGE_CONFIG.medium;
            const completedChecks = task.checklists?.filter((c) => c.isCompleted).length || 0;
            const totalChecks = task.checklists?.length || 0;

            let formattedDue: string | null = null;
            let isOverdue = false;
            if (task.dueDate) {
              const d = new Date(task.dueDate);
              if (!isNaN(d.getTime())) {
                formattedDue = d.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                isOverdue = !isDone && d.getTime() < Date.now();
              }
            }

            return (
              <div
                key={task.id}
                onClick={() => {
                  setTaskToEdit(task);
                  setIsDialogOpen(true);
                }}
                className={`group flex items-center justify-between p-3.5 rounded-xl border border-kano-border bg-kano-surface hover:border-kano-accent/50 hover:shadow-subtle hover:-translate-y-[0.5px] active:scale-[0.99] transition-all cursor-pointer gap-4 ${
                  isDone ? 'opacity-70 bg-kano-bg/50' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Complete Checkbox */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={`Mark task as ${isDone ? 'incomplete' : 'complete'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(task);
                    }}
                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 active:scale-90 shrink-0 ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-kano-border hover:border-kano-accent bg-kano-bg'
                    }`}
                  >
                    {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-medium text-kano-text-primary ${
                          isDone ? 'line-through text-kano-text-muted' : ''
                        }`}
                      >
                        {task.title}
                      </span>

                      {/* Labels */}
                      {task.labels &&
                        task.labels.map((lbl) => (
                          <span
                            key={lbl.id}
                            className="text-[10px] font-medium px-1.5 py-0.2 rounded-full"
                            style={{
                              backgroundColor: `${lbl.colorHex}20`,
                              color: lbl.colorHex,
                              border: `1px solid ${lbl.colorHex}40`,
                            }}
                          >
                            {lbl.name}
                          </span>
                        ))}
                    </div>

                    {task.description && (
                      <p className="text-[11px] text-kano-text-secondary truncate mt-0.5 max-w-xl">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Metadata */}
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  {/* Column badge */}
                  {col && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-kano-bg border border-kano-border text-kano-text-muted">
                      {col.name}
                    </span>
                  )}

                  {/* Priority Badge with Linear Dot Indicator */}
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1.5 ${priorityBadge.bg} ${priorityBadge.text}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${priorityBadge.dot}`} />
                    {priorityBadge.label}
                  </span>

                  {/* Checklist counter */}
                  {totalChecks > 0 && (
                    <span className="text-[10px] font-mono text-kano-text-muted flex items-center gap-1 bg-kano-bg px-1.5 py-0.5 rounded">
                      <CheckSquare className="w-2.5 h-2.5" />
                      {completedChecks}/{totalChecks}
                    </span>
                  )}

                  {/* Due Date */}
                  {formattedDue && (
                    <span
                      className={`text-[10px] font-mono flex items-center gap-1 px-1.5 py-0.5 rounded ${
                        isOverdue
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                          : 'text-kano-text-muted bg-kano-bg'
                      }`}
                    >
                      {isOverdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                      {formattedDue}
                    </span>
                  )}

                  {/* Edit button */}
                  <button
                    type="button"
                    aria-label="Edit task"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTaskToEdit(task);
                      setIsDialogOpen(true);
                    }}
                    className="w-7 h-7 flex items-center justify-center shrink-0 rounded-md text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
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
          taskToEdit={taskToEdit}
          onSaved={loadData}
          onDeleted={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};
