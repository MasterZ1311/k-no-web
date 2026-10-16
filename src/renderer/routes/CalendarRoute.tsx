import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckSquare,
  AlertCircle,
  Edit2,
} from 'lucide-react';
import type { CalendarEventDTO, TaskDTO, BoardColumnDTO } from '../../preload/types';
import { useRoom } from '../features/rooms/RoomContext';
import { useToast } from '../design-system/ToastProvider';
import { Button } from '../design-system/Button';
import { EmptyState } from '../design-system/EmptyState';
import { LoadingState } from '../design-system/LoadingState';
import { EventDialog } from '../features/calendar/EventDialog';
import { TaskDialog } from '../features/tasks/TaskDialog';
import { useRealtimeInvalidation } from '../features/realtime/RealtimeContext';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarRoute: React.FC = () => {
  const { activeRoom, isLoading: isRoomLoading } = useRoom();
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [columns, setColumns] = useState<BoardColumnDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEventDTO | null>(null);

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TaskDTO | null>(null);

  const loadData = useCallback(async () => {
    if (!activeRoom || !window.kanoDesktop?.calendar || !window.kanoDesktop?.tasks) {
      setEvents([]);
      setTasks([]);
      setColumns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Range from start of previous month to end of next month to cover calendar grid
      const startRange = new Date(year, month - 1, 1).toISOString();
      const endRange = new Date(year, month + 2, 0, 23, 59, 59).toISOString();

      const [eventsRes, tasksRes, boardRes] = await Promise.all([
        window.kanoDesktop.calendar.getEvents(activeRoom.id, startRange, endRange),
        window.kanoDesktop.tasks.getTasks(activeRoom.id),
        window.kanoDesktop.boards ? window.kanoDesktop.boards.getBoard(activeRoom.id) : null,
      ]);

      if (eventsRes.success && eventsRes.events) {
        setEvents(eventsRes.events);
      }
      if (tasksRes.success && tasksRes.tasks) {
        setTasks(tasksRes.tasks);
      }
      if (boardRes && boardRes.success && boardRes.columns) {
        setColumns(boardRes.columns);
      }
    } catch (err) {
      console.error('[CalendarRoute] Load failed:', err);
      showToast('Failed to load calendar events', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [activeRoom, currentDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reconcile on realtime calendar/task invalidations
  useRealtimeInvalidation(['calendar_events', 'tasks'], () => {
    loadData();
  });

  // Calendar month navigation
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  // Build grid days for current month view
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Preceding padding days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }

    // Following padding days from next month to complete standard 35 or 42 grid
    const totalCells = days.length <= 35 ? 35 : 42;
    const remainingDays = totalCells - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Helper: check if two dates are same calendar day in local timezone
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Group events and tasks by day
  const itemsByDateString = useMemo(() => {
    const eventMap = new Map<string, CalendarEventDTO[]>();
    const taskMap = new Map<string, TaskDTO[]>();

    const getKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    // Map events
    events.forEach((ev) => {
      try {
        const s = new Date(ev.startTime);
        if (!isNaN(s.getTime())) {
          const key = getKey(s);
          const list = eventMap.get(key) || [];
          list.push(ev);
          eventMap.set(key, list);
        }
      } catch {
        // ignore date parse error
      }
    });

    // Map tasks by due_date
    tasks.forEach((t) => {
      if (t.dueDate) {
        try {
          const d = new Date(t.dueDate);
          if (!isNaN(d.getTime())) {
            const key = getKey(d);
            const list = taskMap.get(key) || [];
            list.push(t);
            taskMap.set(key, list);
          }
        } catch {
          // ignore date parse error
        }
      }
    });

    return { eventMap, taskMap, getKey };
  }, [events, tasks]);

  // Selected Day Items
  const selectedKey = itemsByDateString.getKey(selectedDate);
  const selectedDayEvents = itemsByDateString.eventMap.get(selectedKey) || [];
  const selectedDayTasks = itemsByDateString.taskMap.get(selectedKey) || [];

  const now = new Date();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 shrink-0 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-kano-text-primary flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-kano-accent" />
            Calendar & Deadlines
          </h1>
          <p className="text-xs text-kano-text-muted mt-1">
            UTC-consistent milestones, task deadlines, and local system reminder alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setEventToEdit(null);
              setIsEventDialogOpen(true);
            }}
          >
            New Event
          </Button>
        </div>
      </div>

      {isRoomLoading || isLoading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <LoadingState label="Loading calendar and deadlines..." />
        </div>
      ) : !activeRoom ? (
        <div className="flex-1 p-8">
          <EmptyState
            icon={<AlertCircle className="w-8 h-8 text-kano-accent" />}
            title="No Active Room"
            description="Select or create a workspace room to access calendar events and milestones."
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
        {/* Left: Month Grid */}
        <div className="flex-1 flex flex-col bg-kano-bg border border-kano-border rounded-xl p-4 min-h-0 overflow-hidden">
          {/* Calendar Controls */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-kano-border shrink-0">
            <h2 className="text-base font-bold text-kano-text-primary">
              {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" onClick={handleToday}>
                Today
              </Button>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1.5 rounded-md text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover border border-kano-border"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1.5 rounded-md text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover border border-kano-border"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-1 text-center py-1.5 shrink-0 border-b border-kano-border/60 text-xs font-semibold text-kano-text-muted uppercase tracking-wider">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-0.5">
                {w}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="flex-1 grid grid-cols-7 gap-1 min-h-0 overflow-y-auto pt-1">
            {calendarDays.map((cell, idx) => {
              const key = itemsByDateString.getKey(cell.date);
              const dayEvents = itemsByDateString.eventMap.get(key) || [];
              const dayTasks = itemsByDateString.taskMap.get(key) || [];
              const isToday = isSameDay(cell.date, now);
              const isSelected = isSameDay(cell.date, selectedDate);

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(cell.date)}
                  className={`flex flex-col p-1.5 min-h-[64px] rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-kano-accent bg-kano-surface ring-1 ring-kano-accent/40 shadow-xs'
                      : 'border-kano-border/60 bg-kano-surface/40 hover:bg-kano-surface hover:border-kano-border'
                  } ${!cell.isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  {/* Day Number Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-kano-accent text-white font-bold'
                          : isSelected
                          ? 'text-kano-accent font-bold'
                          : 'text-kano-text-secondary'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>

                    {/* Total item count indicator */}
                    {dayEvents.length + dayTasks.length > 0 && (
                      <span className="text-[9px] font-mono text-kano-text-muted">
                        {dayEvents.length + dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Day items preview pills */}
                  <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                    {/* Events Pill (Clock icon) */}
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        title={ev.title}
                        className="truncate text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1"
                      >
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}

                    {/* Tasks Pill (Check icon) */}
                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        title={`Task Due: ${t.title}`}
                        className={`truncate text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 border ${
                          t.status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 line-through opacity-80'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}
                      >
                        <CheckSquare className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}

                    {/* Overflow label */}
                    {dayEvents.length + dayTasks.length > 4 && (
                      <span className="text-[9px] text-kano-text-muted pl-1">
                        +{dayEvents.length + dayTasks.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Agenda */}
        <div className="w-full lg:w-80 flex flex-col bg-kano-bg border border-kano-border rounded-xl p-4 min-h-0 shrink-0">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-kano-border shrink-0">
            <div>
              <span className="text-xs font-semibold text-kano-text-muted uppercase tracking-wider block">
                Selected Day
              </span>
              <h3 className="text-sm font-bold text-kano-text-primary">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
            </div>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setEventToEdit(null);
                setIsEventDialogOpen(true);
              }}
            >
              Add
            </Button>
          </div>

          {/* Agenda Items List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {selectedDayEvents.length === 0 && selectedDayTasks.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-kano-border rounded-lg">
                <Clock className="w-6 h-6 text-kano-text-muted mx-auto mb-2 opacity-50" />
                <span className="text-xs font-medium text-kano-text-secondary block">
                  Nothing scheduled
                </span>
                <p className="text-[11px] text-kano-text-muted mt-0.5">
                  Plan meetings or assign task deadlines for this day.
                </p>
              </div>
            ) : (
              <>
                {/* Events Section */}
                {selectedDayEvents.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-kano-text-muted uppercase tracking-wider block mb-2">
                      Calendar Events ({selectedDayEvents.length})
                    </span>
                    <div className="space-y-2">
                      {selectedDayEvents.map((ev) => {
                        const s = new Date(ev.startTime);
                        const e = new Date(ev.endTime);
                        const timeText = ev.isAllDay
                          ? 'All Day'
                          : `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                        return (
                          <div
                            key={ev.id}
                            onClick={() => {
                              setEventToEdit(ev);
                              setIsEventDialogOpen(true);
                            }}
                            className="p-3 rounded-lg border border-kano-border bg-kano-surface hover:border-kano-accent/40 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-semibold text-kano-text-primary">
                                {ev.title}
                              </span>
                              <button
                                type="button"
                                aria-label="Edit event"
                                className="text-kano-text-muted hover:text-kano-text-primary p-0.5 rounded"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block mt-1">
                              {timeText}
                            </span>
                            {ev.description && (
                              <p className="text-[11px] text-kano-text-secondary mt-1 line-clamp-2">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tasks Section */}
                {selectedDayTasks.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-kano-text-muted uppercase tracking-wider block mb-2">
                      Task Deadlines ({selectedDayTasks.length})
                    </span>
                    <div className="space-y-2">
                      {selectedDayTasks.map((t) => {
                        const isDone = t.status === 'done';
                        const d = t.dueDate ? new Date(t.dueDate) : null;
                        const timeStr = d
                          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '';

                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setTaskToEdit(t);
                              setIsTaskDialogOpen(true);
                            }}
                            className={`p-3 rounded-lg border border-kano-border bg-kano-surface hover:border-kano-accent/40 cursor-pointer transition-colors ${
                              isDone ? 'opacity-70' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`text-xs font-semibold text-kano-text-primary ${
                                  isDone ? 'line-through text-kano-text-muted' : ''
                                }`}
                              >
                                {t.title}
                              </span>
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                                  isDone
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-amber-500/10 text-amber-600'
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>
                            {timeStr && (
                              <span className="text-[10px] font-mono text-kano-text-muted block mt-1">
                                Due at {timeStr}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Calendar Event Modal Dialog */}
      {activeRoom && (
        <EventDialog
          isOpen={isEventDialogOpen}
          onClose={() => {
            setIsEventDialogOpen(false);
            setEventToEdit(null);
          }}
          roomId={activeRoom.id}
          initialDate={selectedDate}
          eventToEdit={eventToEdit}
          tasks={tasks}
          onSaved={loadData}
          onDeleted={() => {
            loadData();
          }}
        />
      )}

      {/* Task Dialog when clicking task deadline from calendar */}
      {activeRoom && (
        <TaskDialog
          isOpen={isTaskDialogOpen}
          onClose={() => {
            setIsTaskDialogOpen(false);
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
