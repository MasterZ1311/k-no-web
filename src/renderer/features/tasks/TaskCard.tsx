import React from 'react';
import {
  Calendar,
  CheckSquare,
  MoreVertical,
  ArrowRight,
  Trash2,
  Edit2,
  AlertCircle,
} from 'lucide-react';
import type { TaskDTO, BoardColumnDTO, TaskPriority } from '../../../preload/types';
import { DropdownMenu, DropdownMenuItem } from '../../design-system/DropdownMenu';

export interface TaskCardProps {
  task: TaskDTO;
  columns?: BoardColumnDTO[];
  onClick?: () => void;
  onMoveToColumn?: (targetColumnId: string) => void;
  onDelete?: () => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  className?: string;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; bg: string; text: string; dot: string }> = {
  urgent: { label: 'Urgent', bg: 'bg-[#FA2E23]/15', text: 'text-[#FA2E23] dark:text-[#FA2E23]', dot: 'bg-[#FA2E23]' },
  high: { label: 'High', bg: 'bg-[#A8120B]/15', text: 'text-[#A8120B] dark:text-[#ff7a70]', dot: 'bg-[#A8120B]' },
  medium: { label: 'Medium', bg: 'bg-[#787A5B]/15', text: 'text-[#5a5c3d] dark:text-[#cfd2a8]', dot: 'bg-[#787A5B]' },
  low: { label: 'Low', bg: 'bg-[#607080]/15', text: 'text-[#607080] dark:text-[#94a3b8]', dot: 'bg-[#607080]' },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  columns = [],
  onClick,
  onMoveToColumn,
  onDelete,
  isDraggable = true,
  onDragStart,
  className = '',
}) => {
  const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isDone = task.status === 'done';

  // Checklists progress
  const totalChecklists = task.checklists?.length || 0;
  const completedChecklists = task.checklists?.filter((c) => c.isCompleted).length || 0;

  // Due date formatting & overdue detection
  let dueDateText: string | null = null;
  let isOverdue = false;
  if (task.dueDate) {
    try {
      const d = new Date(task.dueDate);
      if (!isNaN(d.getTime())) {
        dueDateText = d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        isOverdue = !isDone && d.getTime() < Date.now();
      }
    } catch {
      // ignore date parse issues
    }
  }

  // Build menu items for accessible relocation
  const menuItems: (DropdownMenuItem | 'separator')[] = [];

  if (onClick) {
    menuItems.push({
      id: 'edit',
      label: 'Edit details',
      icon: <Edit2 className="w-3.5 h-3.5" />,
      onClick: onClick,
    });
  }

  const otherColumns = columns.filter((c) => c.id !== task.columnId);
  if (otherColumns.length > 0 && onMoveToColumn) {
    menuItems.push('separator');
    otherColumns.forEach((col) => {
      menuItems.push({
        id: `move-${col.id}`,
        label: `Move to ${col.name}`,
        icon: <ArrowRight className="w-3.5 h-3.5" />,
        onClick: () => onMoveToColumn(col.id),
      });
    });
  }

  if (onDelete) {
    menuItems.push('separator');
    menuItems.push({
      id: 'delete',
      label: 'Delete task',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      danger: true,
      onClick: onDelete,
    });
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Avoid triggering card click if clicking dropdown menu button
    if ((e.target as HTMLElement).closest('[role="menu"]') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, columnId: task.columnId }));
        if (onDragStart) onDragStart(e);
      }}
      onClick={handleCardClick}
      className={`group relative flex flex-col p-4 rounded-xl border border-kano-border bg-kano-surface hover:border-kano-accent/50 shadow-subtle hover:shadow-popup transition-all cursor-pointer ${
        isDone ? 'opacity-75 bg-kano-bg/50' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span
          className={`text-sm font-semibold text-kano-text-primary leading-snug break-words flex-1 ${
            isDone ? 'line-through text-kano-text-muted' : ''
          }`}
        >
          {task.title}
        </span>

        {/* Dropdown Menu for keyboard/accessible actions */}
        {menuItems.length > 0 && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mr-1 -mt-1">
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  aria-label="Task options"
                  className="p-1 rounded text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover opacity-80 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              }
              items={menuItems}
              align="right"
            />
          </div>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-kano-text-secondary line-clamp-2 mb-2.5 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${label.colorHex}20`,
                color: label.colorHex,
                border: `1px solid ${label.colorHex}40`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Bottom Metadata Badges */}
      <div className="flex items-center flex-wrap gap-2 text-xs text-kano-text-muted mt-auto pt-1">
        {/* Priority Badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${priorityInfo.bg} ${priorityInfo.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.dot} shadow-[0_0_4px_currentColor]`} />
          {priorityInfo.label}
        </span>

        {/* Due Date */}
        {dueDateText && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono transition-colors ${
              isOverdue
                ? 'bg-[#FA2E23]/15 text-[#FA2E23] font-semibold'
                : 'bg-kano-surface-hover border border-kano-border text-kano-text-muted'
            }`}
          >
            {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {dueDateText}
          </span>
        )}

        {/* Checklists Progress */}
        {totalChecklists > 0 && (
          <span className="inline-flex items-center gap-1.5 font-mono bg-kano-surface-hover border border-kano-border px-2.5 py-0.5 rounded-full">
            <CheckSquare className="w-3 h-3 text-kano-text-muted" />
            {completedChecklists}/{totalChecklists}
          </span>
        )}
      </div>
    </div>
  );
};
