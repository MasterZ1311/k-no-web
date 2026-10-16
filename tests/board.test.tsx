import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoardRoute } from '../src/renderer/routes/BoardRoute';
import { RoomProvider } from '../src/renderer/features/rooms/RoomContext';
import { AuthProvider } from '../src/renderer/features/auth/AuthContext';
import { ToastProvider } from '../src/renderer/design-system/ToastProvider';
import type { TaskDTO, BoardColumnDTO, BoardDTO } from '../src/preload/types';
import { mockDefaultRoom } from './setup';

const mockBoard: BoardDTO = {
  id: 'board-1',
  roomId: mockDefaultRoom.id,
  name: 'Main Kanban Board',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockColumns: BoardColumnDTO[] = [
  { id: 'col-todo', boardId: 'board-1', roomId: mockDefaultRoom.id, name: 'To Do', statusKey: 'todo', position: 0, createdAt: '', updatedAt: '' },
  { id: 'col-progress', boardId: 'board-1', roomId: mockDefaultRoom.id, name: 'In Progress', statusKey: 'in_progress', position: 1, createdAt: '', updatedAt: '' },
  { id: 'col-blocked', boardId: 'board-1', roomId: mockDefaultRoom.id, name: 'Blocked', statusKey: 'blocked', position: 2, createdAt: '', updatedAt: '' },
  { id: 'col-done', boardId: 'board-1', roomId: mockDefaultRoom.id, name: 'Done', statusKey: 'done', position: 3, createdAt: '', updatedAt: '' },
];

const mockTasks: TaskDTO[] = [
  {
    id: 'task-1',
    roomId: mockDefaultRoom.id,
    columnId: 'col-todo',
    status: 'todo',
    title: 'Implement drag-and-drop',
    description: 'HTML5 drag events with visual drop feedback',
    priority: 'high',
    dueDate: null,
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
    labels: [{ id: 'lbl-1', roomId: mockDefaultRoom.id, name: 'Frontend', colorHex: '#3b82f6', createdAt: '' }],
  },
  {
    id: 'task-2',
    roomId: mockDefaultRoom.id,
    columnId: 'col-progress',
    status: 'in_progress',
    title: 'Write IPC handlers',
    description: 'Typed channels and services',
    priority: 'medium',
    dueDate: null,
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

const renderBoardRoute = () => {
  return render(
    <AuthProvider>
      <RoomProvider>
        <ToastProvider>
          <BoardRoute />
        </ToastProvider>
      </RoomProvider>
    </AuthProvider>
  );
};

describe('káno̱ Desktop Kanban Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    window.kanoDesktop.boards.getBoard = vi.fn().mockResolvedValue({
      success: true,
      board: mockBoard,
      columns: mockColumns,
    });

    window.kanoDesktop.tasks.getTasks = vi.fn().mockResolvedValue({
      success: true,
      tasks: [...mockTasks],
    });

    window.kanoDesktop.tasks.getLabels = vi.fn().mockResolvedValue({
      success: true,
      labels: [],
    });
  });

  it('renders 4 columns with appropriate task cards', async () => {
    renderBoardRoute();

    expect(screen.getByRole('heading', { name: /Main Kanban Board/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Blocked')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    // Check task titles
    expect(screen.getByText('Implement drag-and-drop')).toBeInTheDocument();
    expect(screen.getByText('Write IPC handlers')).toBeInTheDocument();

    // Check empty columns have placeholder
    expect(screen.getAllByText('No cards here')).toHaveLength(2); // Blocked and Done
  });

  it('moves task card to another column via accessible menu', async () => {
    window.kanoDesktop.boards.moveTask = vi.fn().mockResolvedValue({
      success: true,
      task: {
        ...mockTasks[0],
        columnId: 'col-progress',
        status: 'in_progress',
      },
    });

    renderBoardRoute();

    await waitFor(() => {
      expect(screen.getByText('Implement drag-and-drop')).toBeInTheDocument();
    });

    // Open options dropdown on task card
    const optionsButtons = screen.getAllByRole('button', { name: /Task options/i });
    fireEvent.click(optionsButtons[0]);

    // Click "Move to In Progress"
    const moveItem = screen.getByText('Move to In Progress');
    fireEvent.click(moveItem);

    await waitFor(() => {
      expect(window.kanoDesktop.boards.moveTask).toHaveBeenCalledWith(
        'task-1',
        'col-progress',
        expect.any(Number)
      );
    });
  });

  it('rolls back optimistic move if moveTask RPC fails', async () => {
    window.kanoDesktop.boards.moveTask = vi.fn().mockResolvedValue({
      success: false,
      error: 'Network timeout',
    });

    renderBoardRoute();

    await waitFor(() => {
      expect(screen.getByText('Implement drag-and-drop')).toBeInTheDocument();
    });

    // Trigger move
    const optionsButtons = screen.getAllByRole('button', { name: /Task options/i });
    fireEvent.click(optionsButtons[0]);
    fireEvent.click(screen.getByText('Move to Done'));

    // Should call moveTask and then display toast error while rolling back
    await waitFor(() => {
      expect(window.kanoDesktop.boards.moveTask).toHaveBeenCalledWith('task-1', 'col-done', expect.any(Number));
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });
  });

  it('opens New Task dialog with column preselected when column + button is clicked', async () => {
    renderBoardRoute();

    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /Add task to /i });
    // Click on In Progress column's + button
    fireEvent.click(addButtons[1]);

    expect(screen.getByRole('dialog', { name: /New Task/i })).toBeInTheDocument();

    // Check column selector is pre-selected to In Progress
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('col-progress');
  });
});
