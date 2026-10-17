import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { TaskDTO, BoardColumnDTO, TaskPriority, TaskLabelDTO } from '../../../preload/types';
import { Dialog } from '../../design-system/Dialog';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { useToast } from '../../design-system/ToastProvider';

export interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  columns: BoardColumnDTO[];
  initialColumnId?: string;
  taskToEdit?: TaskDTO | null;
  onSaved: () => void;
  onDeleted?: (taskId: string) => void;
}

const PRESET_LABEL_COLORS = [
  '#7FC0FA', // Sky Blue
  '#F0FA73', // Acid Lime
  '#FA2E23', // Vivid Red
  '#A8120B', // Crimson Maroon
  '#EA1F0A', // Luxury Taupe Crimson
  '#000000', // Luxury Taupe Black
  '#F6F5F1', // Luxury Taupe Alabaster
  '#402212', // Bygone Espresso
  '#FFF99F', // Bygone Buttercream
  '#850805', // Bygone Burgundy
  '#84784E', // Bygone Vintage Brass
  '#1C241B', // Bygone Pine Onyx
  '#3A4793', // To-Do App Royal Indigo
  '#25B3EC', // To-Do App Electric Cyan
  '#9787EE', // To-Do App Periwinkle
  '#FFBF3E', // To-Do App Marigold
  '#607080', // Steel Slate
  '#787A5B', // Sage Olive
  '#10b981', // Vivid Emerald
  '#8b5cf6', // Purple
];

export const TaskDialog: React.FC<TaskDialogProps> = ({
  isOpen,
  onClose,
  roomId,
  columns,
  initialColumnId,
  taskToEdit,
  onSaved,
  onDeleted,
}) => {
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [columnId, setColumnId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Checklists state (for existing task or drafts)
  const [checklists, setChecklists] = useState<{ id?: string; title: string; isCompleted: boolean }[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Labels state
  const [availableLabels, setAvailableLabels] = useState<TaskLabelDTO[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(PRESET_LABEL_COLORS[0]);

  // Load labels whenever dialog opens
  useEffect(() => {
    if (!isOpen || !roomId || !window.kanoDesktop?.tasks) return;

    window.kanoDesktop.tasks.getLabels(roomId).then((res) => {
      if (res.success && res.labels) {
        setAvailableLabels(res.labels);
      }
    });
  }, [isOpen, roomId]);

  // Populate form fields
  useEffect(() => {
    if (!isOpen) return;

    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority);
      setColumnId(taskToEdit.columnId);
      // Format ISO string to local input value: YYYY-MM-DDTHH:mm
      if (taskToEdit.dueDate) {
        const d = new Date(taskToEdit.dueDate);
        if (!isNaN(d.getTime())) {
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
          setDueDate(localISOTime);
        } else {
          setDueDate('');
        }
      } else {
        setDueDate('');
      }
      setChecklists(taskToEdit.checklists ? [...taskToEdit.checklists] : []);
      setSelectedLabelIds(taskToEdit.labels ? taskToEdit.labels.map((l) => l.id) : []);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      const defaultCol = initialColumnId || (columns.length > 0 ? columns[0].id : '');
      setColumnId(defaultCol);
      setDueDate('');
      setChecklists([]);
      setSelectedLabelIds([]);
    }
    setNewChecklistText('');
    setIsCreatingLabel(false);
    setNewLabelName('');
  }, [isOpen, taskToEdit, initialColumnId, columns]);

  const handleToggleChecklist = async (index: number) => {
    const item = checklists[index];
    const newStatus = !item.isCompleted;

    // If item has a saved id, update backend immediately
    if (item.id && window.kanoDesktop?.tasks) {
      await window.kanoDesktop.tasks.updateChecklistItem(item.id, { isCompleted: newStatus });
    }

    setChecklists((prev) =>
      prev.map((c, i) => (i === index ? { ...c, isCompleted: newStatus } : c))
    );
  };

  const handleAddChecklist = async () => {
    if (!newChecklistText.trim()) return;

    if (taskToEdit && window.kanoDesktop?.tasks) {
      const res = await window.kanoDesktop.tasks.createChecklistItem(roomId, taskToEdit.id, newChecklistText.trim());
      if (res.success && res.checklist) {
        setChecklists((prev) => [...prev, res.checklist!]);
      }
    } else {
      setChecklists((prev) => [...prev, { title: newChecklistText.trim(), isCompleted: false }]);
    }
    setNewChecklistText('');
  };

  const handleDeleteChecklist = async (index: number) => {
    const item = checklists[index];
    if (item.id && window.kanoDesktop?.tasks) {
      await window.kanoDesktop.tasks.deleteChecklistItem(item.id);
    }
    setChecklists((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim() || !window.kanoDesktop?.tasks) return;

    const res = await window.kanoDesktop.tasks.createLabel(roomId, newLabelName.trim(), newLabelColor);
    if (res.success && res.label) {
      setAvailableLabels((prev) => [...prev, res.label!]);
      setSelectedLabelIds((prev) => [...prev, res.label!.id]);
      setNewLabelName('');
      setIsCreatingLabel(false);
      showToast('Label created', { type: 'success' });
    } else {
      showToast(res.error || 'Failed to create label', { type: 'error' });
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a task title', { type: 'error' });
      return;
    }
    if (!window.kanoDesktop?.tasks) {
      showToast('Desktop bridge unavailable', { type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      let isoDueDate: string | null = null;
      if (dueDate) {
        const parsed = new Date(dueDate);
        if (!isNaN(parsed.getTime())) {
          isoDueDate = parsed.toISOString();
        }
      }

      if (taskToEdit) {
        // Update task
        const res = await window.kanoDesktop.tasks.updateTask(taskToEdit.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          columnId,
          dueDate: isoDueDate,
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to update task');
        }

        // Synchronize label assignments
        const prevLabelIds = taskToEdit.labels ? taskToEdit.labels.map((l) => l.id) : [];
        const toAdd = selectedLabelIds.filter((id) => !prevLabelIds.includes(id));
        const toRemove = prevLabelIds.filter((id) => !selectedLabelIds.includes(id));

        for (const addId of toAdd) {
          await window.kanoDesktop.tasks.assignLabel(roomId, taskToEdit.id, addId);
        }
        for (const remId of toRemove) {
          await window.kanoDesktop.tasks.unassignLabel(taskToEdit.id, remId);
        }

        showToast('Task updated successfully', { type: 'success' });
      } else {
        // Create new task
        const res = await window.kanoDesktop.tasks.createTask(roomId, {
          title: title.trim(),
          columnId,
          description: description.trim() || undefined,
          priority,
          dueDate: isoDueDate,
          labels: selectedLabelIds,
        });

        if (!res.success || !res.task) {
          throw new Error(res.error || 'Failed to create task');
        }

        // Add pending checklists for newly created task
        for (const c of checklists) {
          await window.kanoDesktop.tasks.createChecklistItem(roomId, res.task.id, c.title);
        }

        showToast('Task created successfully', { type: 'success' });
      }

      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToEdit || !window.kanoDesktop?.tasks) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    setIsDeleting(true);
    try {
      const res = await window.kanoDesktop.tasks.deleteTask(taskToEdit.id);
      if (res.success) {
        showToast('Task deleted', { type: 'info' });
        if (onDeleted) onDeleted(taskToEdit.id);
        onSaved();
        onClose();
      } else {
        throw new Error(res.error || 'Failed to delete task');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete task', { type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={taskToEdit ? 'Edit Task' : 'New Task'}
      description="Manage task details, checklists, priority, and board status."
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          {taskToEdit ? (
            <Button
              type="button"
              variant="danger"
              size="md"
              iconLeft={<Trash2 className="w-4 h-4" />}
              isLoading={isDeleting}
              onClick={handleDeleteTask}
            >
              Delete Task
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              onClick={handleSave}
            >
              {taskToEdit ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
            Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Implement user authentication"
            autoFocus
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add context, acceptance criteria, or links..."
            rows={3}
            className="w-full text-xs rounded-lg border border-kano-border bg-kano-surface px-3 py-2 text-kano-text-primary placeholder:text-kano-text-muted focus:outline-none focus:ring-1 focus:ring-kano-accent focus:border-kano-accent resize-none transition-colors"
          />
        </div>

        {/* Column & Priority Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Column / Status */}
          <div>
            <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
              Kanban Column
            </label>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              className="w-full text-xs rounded-lg border border-kano-border bg-kano-surface px-3 py-2 text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent focus:border-kano-accent transition-colors"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name} ({col.statusKey})
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full text-xs rounded-lg border border-kano-border bg-kano-surface px-3 py-2 text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent focus:border-kano-accent transition-colors"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
            Due Date (Local Time)
          </label>
          <div className="relative">
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-kano-border bg-kano-surface px-3 py-2 text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent focus:border-kano-accent transition-colors"
            />
          </div>
          {dueDate && (
            <p className="text-[11px] text-kano-text-muted mt-1">
              Saved in UTC ISO 8601 for reliable multi-client display.
            </p>
          )}
        </div>

        {/* Checklists Section */}
        <div className="pt-2 border-t border-kano-border">
          <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-2">
            Checklist Items
          </label>
          <div className="space-y-1.5 mb-3">
            {checklists.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between p-2 rounded-md bg-kano-bg/60 border border-kano-border text-xs group"
              >
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={() => handleToggleChecklist(idx)}
                    className="rounded text-kano-accent focus:ring-0 cursor-pointer"
                  />
                  <span
                    className={`${
                      item.isCompleted ? 'line-through text-kano-text-muted' : 'text-kano-text-primary'
                    }`}
                  >
                    {item.title}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => handleDeleteChecklist(idx)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-kano-text-muted hover:text-rose-500 rounded transition-all"
                  aria-label="Delete checklist item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={newChecklistText}
              onChange={(e) => setNewChecklistText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddChecklist();
                }
              }}
              placeholder="Add a checklist item (press Enter)..."
              className="text-sm"
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              iconLeft={<Plus className="w-4 h-4" />}
              onClick={handleAddChecklist}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Labels Section */}
        <div className="pt-2 border-t border-kano-border">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider">
              Labels
            </label>
            <button
              type="button"
              onClick={() => setIsCreatingLabel(!isCreatingLabel)}
              className="text-xs text-kano-accent hover:underline flex items-center gap-1 font-medium"
            >
              <Plus className="w-3 h-3" />
              {isCreatingLabel ? 'Cancel' : 'New Label'}
            </button>
          </div>

          {/* New Label Creator */}
          {isCreatingLabel && (
            <div className="p-3 mb-3 rounded-lg border border-kano-border bg-kano-bg space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label name (e.g. Bug, Feature)"
                  className="text-sm flex-1"
                />
                <Button type="button" variant="primary" size="md" onClick={handleCreateLabel}>
                  Create
                </Button>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-kano-text-muted mr-1">Color:</span>
                {PRESET_LABEL_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setNewLabelColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      newLabelColor === hex ? 'scale-125 ring-2 ring-kano-accent ring-offset-1' : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available Labels Chips */}
          <div className="flex flex-wrap gap-1.5">
            {availableLabels.length === 0 ? (
              <span className="text-xs text-kano-text-muted italic">No labels created yet.</span>
            ) : (
              availableLabels.map((lbl) => {
                const isSelected = selectedLabelIds.includes(lbl.id);
                return (
                  <button
                    key={lbl.id}
                    type="button"
                    onClick={() => toggleLabel(lbl.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'ring-2 ring-kano-accent ring-offset-1'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: `${lbl.colorHex}20`,
                      color: lbl.colorHex,
                      border: `1px solid ${lbl.colorHex}40`,
                    }}
                  >
                    {lbl.name}
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
};
