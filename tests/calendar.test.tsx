import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalendarRoute } from '../src/renderer/routes/CalendarRoute';
import { RoomProvider } from '../src/renderer/features/rooms/RoomContext';
import { AuthProvider } from '../src/renderer/features/auth/AuthContext';
import { ToastProvider } from '../src/renderer/design-system/ToastProvider';
import type { CalendarEventDTO, TaskDTO } from '../src/preload/types';
import { mockDefaultRoom } from './setup';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();

// Event on 15th of current month
const mockEventDate = new Date(currentYear, currentMonth, 15, 10, 0, 0);
const mockEventEndDate = new Date(currentYear, currentMonth, 15, 11, 0, 0);

const mockSampleEvents: CalendarEventDTO[] = [
  {
    id: 'ev-1',
    roomId: mockDefaultRoom.id,
    taskId: null,
    title: 'Architecture Review Meeting',
    description: 'Review Supabase RLS and room isolation contracts.',
    startTime: mockEventDate.toISOString(),
    endTime: mockEventEndDate.toISOString(),
    isAllDay: false,
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Task due on 15th of current month
const mockSampleTasks: TaskDTO[] = [
  {
    id: 'task-1',
    roomId: mockDefaultRoom.id,
    columnId: 'col-todo',
    status: 'todo',
    title: 'Deliver Prompt 11 Milestone',
    description: null,
    priority: 'urgent',
    dueDate: new Date(currentYear, currentMonth, 15, 18, 0, 0).toISOString(),
    completedAt: null,
    assigneeId: null,
    folderId: null,
    noteId: null,
    position: 0,
    isDeleted: false,
    deletedAt: null,
    version: 1,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checklists: [],
    labels: [],
  },
];

const renderCalendarRoute = () => {
  return render(
    <AuthProvider>
      <RoomProvider>
        <ToastProvider>
          <CalendarRoute />
        </ToastProvider>
      </RoomProvider>
    </AuthProvider>
  );
};

describe('káno̱ Desktop Calendar & Deadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    window.kanoDesktop.calendar.getEvents = vi.fn().mockResolvedValue({
      success: true,
      events: [...mockSampleEvents],
    });

    window.kanoDesktop.tasks.getTasks = vi.fn().mockResolvedValue({
      success: true,
      tasks: [...mockSampleTasks],
    });

    window.kanoDesktop.boards.getBoard = vi.fn().mockResolvedValue({
      success: true,
      columns: [],
    });
  });

  it('renders calendar month grid, weekdays, and navigation controls', async () => {
    renderCalendarRoute();

    expect(screen.getByRole('heading', { name: /Calendar & Deadlines/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Previous month/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Next month/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Today/i })).toBeInTheDocument();
    });
  });

  it('displays calendar events and task deadlines with distinct visual indicators', async () => {
    renderCalendarRoute();

    await waitFor(() => {
      // Event pill
      expect(screen.getByTitle('Architecture Review Meeting')).toBeInTheDocument();
      // Task pill
      expect(screen.getByTitle('Task Due: Deliver Prompt 11 Milestone')).toBeInTheDocument();
    });
  });

  it('updates selected day agenda when clicking on a date cell', async () => {
    renderCalendarRoute();

    await waitFor(() => {
      expect(screen.getByTitle('Architecture Review Meeting')).toBeInTheDocument();
    });

    // Click on the 15th cell
    const day15Elements = screen.getAllByText('15');
    // Find the cell button/div
    fireEvent.click(day15Elements[0].closest('div')!);

    // Check agenda updates to show both events and task deadlines for that day
    await waitFor(() => {
      expect(screen.getByText(/Calendar Events \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Task Deadlines \(1\)/i)).toBeInTheDocument();
    });
  });

  it('opens EventDialog and schedules a new calendar event', async () => {
    window.kanoDesktop.calendar.createEvent = vi.fn().mockResolvedValue({
      success: true,
      event: {
        id: 'ev-new',
        roomId: mockDefaultRoom.id,
        taskId: null,
        title: 'Team Retrospective',
        description: 'Sprint debrief',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        isAllDay: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    renderCalendarRoute();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Event/i })).toBeInTheDocument();
    });

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /New Event/i }));

    expect(screen.getByRole('dialog', { name: /Schedule Event/i })).toBeInTheDocument();

    // Fill title
    const titleInput = screen.getByPlaceholderText(/e\.g\. Sprint Planning/i);
    fireEvent.change(titleInput, { target: { value: 'Team Retrospective' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^Schedule Event$/i }));

    await waitFor(() => {
      expect(window.kanoDesktop.calendar.createEvent).toHaveBeenCalledWith(
        mockDefaultRoom.id,
        expect.objectContaining({
          title: 'Team Retrospective',
        })
      );
    });
  });

  it('validates that event end time cannot be earlier than start time', async () => {
    renderCalendarRoute();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Event/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /New Event/i }));

    const titleInput = await screen.findByPlaceholderText(/e\.g\. Sprint Planning/i);
    fireEvent.change(titleInput, { target: { value: 'Invalid Time Event' } });

    // Set end time earlier than start time using accessible label matchers
    const startInput = await screen.findByLabelText(/Start Time/i);
    const endInput = await screen.findByLabelText(/End Time/i);

    fireEvent.change(startInput, { target: { value: '2026-10-15T14:00' } });
    fireEvent.change(endInput, { target: { value: '2026-10-15T12:00' } });

    (window.kanoDesktop.calendar.createEvent as any).mockClear();

    fireEvent.click(screen.getByRole('button', { name: /^Schedule Event$/i }));

    // Should display toast error and not call API
    await waitFor(() => {
      expect(screen.getByText('End time cannot be earlier than start time')).toBeInTheDocument();
      expect(window.kanoDesktop.calendar.createEvent).not.toHaveBeenCalled();
    });
  });
});
