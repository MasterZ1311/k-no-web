import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import type { CalendarEventDTO, TaskDTO } from '../../../preload/types';
import { Dialog } from '../../design-system/Dialog';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { useToast } from '../../design-system/ToastProvider';

export interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  initialDate?: Date;
  eventToEdit?: CalendarEventDTO | null;
  tasks?: TaskDTO[];
  onSaved: () => void;
  onDeleted?: (eventId: string) => void;
}

export const EventDialog: React.FC<EventDialogProps> = ({
  isOpen,
  onClose,
  roomId,
  initialDate,
  eventToEdit,
  tasks = [],
  onSaved,
  onDeleted,
}) => {
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [taskId, setTaskId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description || '');
      setIsAllDay(eventToEdit.isAllDay);
      setTaskId(eventToEdit.taskId || '');

      const s = new Date(eventToEdit.startTime);
      const e = new Date(eventToEdit.endTime);

      if (!isNaN(s.getTime())) {
        const offset = s.getTimezoneOffset() * 60000;
        setStartTime(new Date(s.getTime() - offset).toISOString().slice(0, 16));
      }
      if (!isNaN(e.getTime())) {
        const offset = e.getTimezoneOffset() * 60000;
        setEndTime(new Date(e.getTime() - offset).toISOString().slice(0, 16));
      }
    } else {
      setTitle('');
      setDescription('');
      setIsAllDay(false);
      setTaskId('');

      const base = initialDate ? new Date(initialDate) : new Date();
      // Start at current hour rounded
      base.setMinutes(0, 0, 0);
      const offset = base.getTimezoneOffset() * 60000;
      const startLocal = new Date(base.getTime() - offset).toISOString().slice(0, 16);

      // Default end 1 hour later
      const endLocal = new Date(base.getTime() + 3600000 - offset).toISOString().slice(0, 16);

      setStartTime(startLocal);
      setEndTime(endLocal);
    }
  }, [isOpen, eventToEdit, initialDate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Event title is required', { type: 'error' });
      return;
    }
    if (!startTime || !endTime) {
      showToast('Start and end times are required', { type: 'error' });
      return;
    }

    const sDate = new Date(startTime);
    const eDate = new Date(endTime);
    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
      showToast('Invalid date format', { type: 'error' });
      return;
    }
    if (eDate < sDate) {
      showToast('End time cannot be earlier than start time', { type: 'error' });
      return;
    }

    if (!window.kanoDesktop?.calendar) {
      showToast('Desktop bridge unavailable', { type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: sDate.toISOString(),
        endTime: eDate.toISOString(),
        isAllDay,
        taskId: taskId.trim() ? taskId.trim() : null,
      };

      if (eventToEdit) {
        const res = await window.kanoDesktop.calendar.updateEvent(eventToEdit.id, payload);
        if (!res.success) throw new Error(res.error || 'Failed to update event');
        showToast('Event updated successfully', { type: 'success' });
      } else {
        const res = await window.kanoDesktop.calendar.createEvent(roomId, payload);
        if (!res.success) throw new Error(res.error || 'Failed to create event');
        showToast('Event scheduled successfully', { type: 'success' });
      }

      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!eventToEdit || !window.kanoDesktop?.calendar) return;
    if (!confirm('Are you sure you want to delete this event?')) return;

    setIsDeleting(true);
    try {
      const res = await window.kanoDesktop.calendar.deleteEvent(eventToEdit.id);
      if (res.success) {
        showToast('Event deleted', { type: 'info' });
        if (onDeleted) onDeleted(eventToEdit.id);
        onSaved();
        onClose();
      } else {
        throw new Error(res.error || 'Failed to delete event');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete event', { type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={eventToEdit ? 'Edit Calendar Event' : 'Schedule Event'}
      description="Plan workspace meetings, milestones, and deadlines."
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {eventToEdit ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              iconLeft={<Trash2 className="w-3.5 h-3.5" />}
              isLoading={isDeleting}
              onClick={handleDelete}
            >
              Delete Event
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              onClick={handleSave}
            >
              {eventToEdit ? 'Save Changes' : 'Schedule Event'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
            Event Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint Planning / Design Review"
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
            placeholder="Event details, agenda, or location notes..."
            rows={2}
            className="w-full text-xs rounded-lg border border-kano-border bg-kano-surface px-3 py-2 text-kano-text-primary placeholder:text-kano-text-muted focus:outline-none focus:ring-1 focus:ring-kano-accent focus:border-kano-accent resize-none transition-colors"
          />
        </div>

        {/* All Day Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-kano-text-primary">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="rounded text-kano-accent focus:ring-0 cursor-pointer"
            />
            <span>All-day event</span>
          </label>
        </div>

        {/* Start & End Times */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="event-start-time" className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
              Start Time *
            </label>
            <input
              id="event-start-time"
              aria-label="Start Time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full text-xs rounded-lg border border-kano-border bg-kano-surface px-3 py-2 text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent focus:border-kano-accent transition-colors"
            />
          </div>

          <div>
            <label htmlFor="event-end-time" className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
              End Time *
            </label>
            <input
              id="event-end-time"
              aria-label="End Time"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full text-xs rounded-lg border border-kano-border bg-kano-surface px-3 py-2 text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent focus:border-kano-accent transition-colors"
            />
          </div>
        </div>

        {/* Optional Linked Task */}
        {tasks.length > 0 && (
          <div className="pt-2 border-t border-kano-border">
            <label className="block text-xs font-semibold text-kano-text-secondary uppercase tracking-wider mb-1">
              Link to Task (Optional)
            </label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="w-full text-xs rounded-lg border border-kano-border bg-kano-surface px-3 py-2 text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent focus:border-kano-accent transition-colors"
            >
              <option value="">-- No linked task --</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.priority})
                </option>
              ))}
            </select>
          </div>
        )}
      </form>
    </Dialog>
  );
};
