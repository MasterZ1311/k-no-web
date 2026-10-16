import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TasksRoute } from '../src/renderer/routes/TasksRoute';
import { RoomProvider } from '../src/renderer/features/rooms/RoomContext';
import { AuthProvider } from '../src/renderer/features/auth/AuthContext';
import { ToastProvider } from '../src/renderer/design-system/ToastProvider';
import type { TaskDTO, BoardColumnDTO } from '../src/preload/types';
import { mockDefaultRoom } from './setup';

const mockColumns: BoardColumnDTO[] = [
  { id: 'col-todo', boardId: 'board-1', roomId: mockDefaultRoom.id, name: 'To Do', statusKey: 'todo', position: 0, createdAt: '', updatedAt: '' },
  { id: 'col-progress', boardId: 'board-1', roomId: mockDefaultRoom.id, name: 'In Progress', statusKey: 'in_progress', position: 1, createdAt: '', updatedAt: '' },
  { id: 'col-blocked', boardId: 'board-1', roomId: mockDefaultRoom.id, name: 'Blocked', statusKey: 'blocked', position: 2, createdAt: '', updatedAt: '' },
  { id: 'col-done', boardId: 'board-1', roomId: mockDefaultRoom.id, name: 'Done', statusKey: 'done', position: 3, createdAt: '', updatedAt: '' },
];

const mockSampleTasks: TaskDTO[] = [
  {
    id: 'task-1',
    roomId: mockDefaultRoom.id,
    columnId: 'col-todo',
    status: 'todo',
    title: 'Setup PostgreSQL migrations',
    description: 'Ensure all tables have RLS enabled.',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
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
    checklists: [
      { id: 'chk-1', taskId: 'task-1', roomId: mockDefaultRoom.id, title: 'Draft schema', isCompleted: true, position: 0, createdAt: '', updatedAt: '' },
      { id: 'chk-2', taskId: 'task-1', roomId: mockDefaultRoom.id, title: 'Apply RLS policies', isCompleted: false, position: 1, createdAt: '', updatedAt: '' },
    ],
    labels: [
      { id: 'lbl-1', roomId: mockDefaultRoom.id, name: 'Backend', colorHex: '#3b82f6', createdAt: '' },
    ],
  },
  {
    id: 'task-2',
    roomId: mockDefaultRoom.id,
    columnId: 'col-done',
    status: 'done',
    title: 'Configure Electron security',
    description: 'Sandbox enabled and context isolation on.',
    priority: 'urgent',
    dueDate: null,
    completedAt: new Date().toISOString(),
    assigneeId: null,
    folderId: null,
    noteId: null,
    position: 0,
    isDeleted: false,
    deletedAt: null,
    version: 2,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checklists: [],
    labels: [],
  },
];

const renderTasksRoute = () => {
  return render(
    <AuthProvider>
      <RoomProvider>
        <ToastProvider>
          <TasksRoute />
        </ToastProvider>
      </RoomProvider>
    </AuthProvider>
  );
};

describe('káno̱ Desktop Tasks & Checklists', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    window.kanoDesktop.boards.getBoard = vi.fn().mockResolvedValue({
      success: true,
      columns: mockColumns,
    });

    window.kanoDesktop.tasks.getTasks = vi.fn().mockResolvedValue({
      success: true,
      tasks: [...mockSampleTasks],
    });

    window.kanoDesktop.tasks.getLabels = vi.fn().mockResolvedValue({
      success: true,
      labels: [
        { id: 'lbl-1', roomId: mockDefaultRoom.id, name: 'Backend', colorHex: '#3b82f6', createdAt: '' },
        { id: 'lbl-2', roomId: mockDefaultRoom.id, name: 'Frontend', colorHex: '#10b981', createdAt: '' },
      ],
    });
  });

  it('renders tasks list with status tabs and task cards', async () => {
    renderTasksRoute();

    expect(screen.getByRole('heading', { name: /Tasks & Checklists/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
      expect(screen.getByText('Configure Electron security')).toBeInTheDocument();
    });

    // Check tabs show counts
    expect(screen.getByRole('button', { name: /All Tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /To Do/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Completed/i })).toBeInTheDocument();

    // Check labels and checklists progress indicator
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('filters tasks by status tab', async () => {
    renderTasksRoute();

    await waitFor(() => {
      expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    });

    // Click "Completed" tab
    fireEvent.click(screen.getByRole('button', { name: /Completed/i }));

    // Task 2 should be visible, Task 1 should not
    expect(screen.getByText('Configure Electron security')).toBeInTheDocument();
    expect(screen.queryByText('Setup PostgreSQL migrations')).not.toBeInTheDocument();

    // Click "To Do" tab
    fireEvent.click(screen.getByRole('button', { name: /To Do/i }));
    expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    expect(screen.queryByText('Configure Electron security')).not.toBeInTheDocument();
  });

  it('filters tasks by search input', async () => {
    renderTasksRoute();

    await waitFor(() => {
      expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search tasks, descriptions, or labels/i);
    fireEvent.change(searchInput, { target: { value: 'PostgreSQL' } });

    expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    expect(screen.queryByText('Configure Electron security')).not.toBeInTheDocument();

    // Search by label
    fireEvent.change(searchInput, { target: { value: 'Backend' } });
    expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    expect(screen.queryByText('Configure Electron security')).not.toBeInTheDocument();
  });

  it('opens New Task dialog, creates a task with checklist, and refreshes', async () => {
    window.kanoDesktop.tasks.createTask = vi.fn().mockResolvedValue({
      success: true,
      task: {
        id: 'task-3',
        roomId: mockDefaultRoom.id,
        columnId: 'col-todo',
        status: 'todo',
        title: 'New Offline Store Feature',
        description: 'Persistent SQLite queue',
        priority: 'urgent',
        dueDate: null,
        completedAt: null,
        assigneeId: null,
        folderId: null,
        noteId: null,
        position: 1,
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
    });

    window.kanoDesktop.tasks.createChecklistItem = vi.fn().mockResolvedValue({
      success: true,
      checklist: {
        id: 'chk-new-1',
        roomId: mockDefaultRoom.id,
        taskId: 'task-3',
        title: 'Write unit tests',
        isCompleted: false,
        position: 0,
        createdAt: '',
        updatedAt: '',
      },
    });

    renderTasksRoute();

    await waitFor(() => {
      expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    });

    // Click "New Task"
    fireEvent.click(screen.getByRole('button', { name: /New Task/i }));

    expect(screen.getByRole('dialog', { name: /New Task/i })).toBeInTheDocument();

    // Fill title
    const titleInput = screen.getByPlaceholderText(/e\.g\. Implement user authentication/i);
    fireEvent.change(titleInput, { target: { value: 'New Offline Store Feature' } });

    // Fill description
    const descInput = screen.getByPlaceholderText(/Add context, acceptance criteria/i);
    fireEvent.change(descInput, { target: { value: 'Persistent SQLite queue' } });

    // Add checklist item
    const checkInput = screen.getByPlaceholderText(/Add a checklist item/i);
    fireEvent.change(checkInput, { target: { value: 'Write unit tests' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));

    expect(screen.getByText('Write unit tests')).toBeInTheDocument();

    // Submit task
    fireEvent.click(screen.getByRole('button', { name: /^Create Task$/i }));

    await waitFor(() => {
      expect(window.kanoDesktop.tasks.createTask).toHaveBeenCalledWith(
        mockDefaultRoom.id,
        expect.objectContaining({
          title: 'New Offline Store Feature',
          description: 'Persistent SQLite queue',
        })
      );
      expect(window.kanoDesktop.tasks.createChecklistItem).toHaveBeenCalled();
    });
  });

  it('toggles task completion using checkbox', async () => {
    window.kanoDesktop.boards.moveTask = vi.fn().mockResolvedValue({
      success: true,
      task: {
        ...mockSampleTasks[0],
        status: 'done',
        columnId: 'col-done',
        completedAt: new Date().toISOString(),
      },
    });

    renderTasksRoute();

    await waitFor(() => {
      expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    });

    // Click checkbox for first task
    const checkButtons = screen.getAllByRole('checkbox');
    fireEvent.click(checkButtons[0]);

    await waitFor(() => {
      expect(window.kanoDesktop.boards.moveTask).toHaveBeenCalledWith('task-1', 'col-done');
    });
  });

  it('deletes a task from the edit dialog', async () => {
    window.kanoDesktop.tasks.deleteTask = vi.fn().mockResolvedValue({
      success: true,
    });

    // Mock confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderTasksRoute();

    await waitFor(() => {
      expect(screen.getByText('Setup PostgreSQL migrations')).toBeInTheDocument();
    });

    // Click task row to edit
    fireEvent.click(screen.getByText('Setup PostgreSQL migrations'));

    expect(screen.getByRole('dialog', { name: /Edit Task/i })).toBeInTheDocument();

    // Click delete button
    fireEvent.click(screen.getByRole('button', { name: /Delete Task/i }));

    await waitFor(() => {
      expect(window.kanoDesktop.tasks.deleteTask).toHaveBeenCalledWith('task-1');
    });
  });
});
