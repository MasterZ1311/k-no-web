import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotesRoute } from '../src/renderer/routes/NotesRoute';
import { TrashRoute } from '../src/renderer/routes/TrashRoute';
import { RoomProvider } from '../src/renderer/features/rooms/RoomContext';
import { ToastProvider } from '../src/renderer/design-system/ToastProvider';
import { AuthProvider } from '../src/renderer/features/auth/AuthContext';
import { createMockKanoDesktop, mockDefaultRoom, mockDefaultUser } from './setup';
import type { FolderDTO, NoteDTO } from '../src/preload/types';

describe('káno̱ Desktop Notes, Folders & Editor Persistence', () => {
  const initialFolders: FolderDTO[] = [
    {
      id: 'folder-1',
      roomId: mockDefaultRoom.id,
      parentId: null,
      name: 'Engineering',
      position: 0,
      isDeleted: false,
      deletedAt: null,
      createdBy: mockDefaultUser.id,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      noteCount: 1,
    },
  ];

  const initialNotes: NoteDTO[] = [
    {
      id: 'note-1',
      roomId: mockDefaultRoom.id,
      folderId: 'folder-1',
      title: 'Architecture Decisions',
      content: {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Documenting architectural principles.' }],
          },
        ],
      },
      plainTextSummary: 'Documenting architectural principles.',
      isFavorite: false,
      isPinned: false,
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: mockDefaultUser.id,
      updatedBy: mockDefaultUser.id,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <AuthProvider>
        <RoomProvider>
          <ToastProvider>{ui}</ToastProvider>
        </RoomProvider>
      </AuthProvider>
    );
  };

  it('renders room folders and notes list', async () => {
    const mockApi = createMockKanoDesktop({
      folders: {
        getFolders: vi.fn().mockResolvedValue({ success: true, folders: initialFolders }),
        createFolder: vi.fn(),
        renameFolder: vi.fn(),
        moveFolder: vi.fn(),
        deleteFolder: vi.fn(),
      },
      notes: {
        getNotes: vi.fn().mockResolvedValue({ success: true, notes: initialNotes }),
        getNote: vi.fn(),
        createNote: vi.fn(),
        updateNoteWithVersion: vi.fn(),
        moveNote: vi.fn(),
        toggleFavorite: vi.fn(),
        togglePin: vi.fn(),
        trashNote: vi.fn(),
        restoreNote: vi.fn(),
        permanentlyDeleteNote: vi.fn(),
        getTrashNotes: vi.fn().mockResolvedValue({ success: true, notes: [] }),
        searchNotes: vi.fn(),
      },
    });
    window.kanoDesktop = mockApi;

    renderWithProviders(<NotesRoute />);

    await waitFor(() => {
      expect(screen.getAllByText('Engineering').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Architecture Decisions').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('creates a new note when New Note button is clicked', async () => {
    const newNote: NoteDTO = {
      id: 'note-2',
      roomId: mockDefaultRoom.id,
      folderId: null,
      title: 'Untitled Note',
      content: { schemaVersion: 1, type: 'doc', content: [] },
      plainTextSummary: null,
      isFavorite: false,
      isPinned: false,
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: mockDefaultUser.id,
      updatedBy: mockDefaultUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createNoteSpy = vi.fn().mockResolvedValue({ success: true, note: newNote });

    const mockApi = createMockKanoDesktop({
      folders: {
        getFolders: vi.fn().mockResolvedValue({ success: true, folders: initialFolders }),
        createFolder: vi.fn(),
        renameFolder: vi.fn(),
        moveFolder: vi.fn(),
        deleteFolder: vi.fn(),
      },
      notes: {
        getNotes: vi.fn().mockResolvedValue({ success: true, notes: initialNotes }),
        getNote: vi.fn(),
        createNote: createNoteSpy,
        updateNoteWithVersion: vi.fn(),
        moveNote: vi.fn(),
        toggleFavorite: vi.fn(),
        togglePin: vi.fn(),
        trashNote: vi.fn(),
        restoreNote: vi.fn(),
        permanentlyDeleteNote: vi.fn(),
        getTrashNotes: vi.fn().mockResolvedValue({ success: true, notes: [] }),
        searchNotes: vi.fn(),
      },
    });
    window.kanoDesktop = mockApi;

    renderWithProviders(<NotesRoute />);

    await waitFor(() => {
      expect(screen.getByText('Architecture Decisions')).toBeInTheDocument();
    });

    const newNoteBtn = screen.getByRole('button', { name: /New Note/i });
    fireEvent.click(newNoteBtn);

    await waitFor(() => {
      expect(createNoteSpy).toHaveBeenCalledWith(
        mockDefaultRoom.id,
        null,
        'Untitled Note'
      );
    });
  });

  it('detects optimistic concurrency conflicts and displays the conflict banner', async () => {
    const updateSpy = vi.fn().mockResolvedValue({
      success: false,
      conflict: true,
      currentVersion: 2,
      currentNote: {
        ...initialNotes[0],
        title: 'Remote Edited Title',
        version: 2,
      },
      error: 'Version conflict',
    });

    const mockApi = createMockKanoDesktop({
      folders: {
        getFolders: vi.fn().mockResolvedValue({ success: true, folders: initialFolders }),
        createFolder: vi.fn(),
        renameFolder: vi.fn(),
        moveFolder: vi.fn(),
        deleteFolder: vi.fn(),
      },
      notes: {
        getNotes: vi.fn().mockResolvedValue({ success: true, notes: initialNotes }),
        getNote: vi.fn(),
        createNote: vi.fn(),
        updateNoteWithVersion: updateSpy,
        moveNote: vi.fn(),
        toggleFavorite: vi.fn(),
        togglePin: vi.fn(),
        trashNote: vi.fn(),
        restoreNote: vi.fn(),
        permanentlyDeleteNote: vi.fn(),
        getTrashNotes: vi.fn().mockResolvedValue({ success: true, notes: [] }),
        searchNotes: vi.fn(),
      },
    });
    window.kanoDesktop = mockApi;

    renderWithProviders(<NotesRoute />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Architecture Decisions')).toBeInTheDocument();
    });

    const titleInput = screen.getByDisplayValue('Architecture Decisions');
    fireEvent.change(titleInput, { target: { value: 'Local Title Edit' } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(screen.getByText(/Version Conflict:/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Overwrite Remote Version/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save as Conflict Copy/i })).toBeInTheDocument();
    });
  });

  it('moves note to trash when trash button is clicked', async () => {
    const trashSpy = vi.fn().mockResolvedValue({ success: true });

    const mockApi = createMockKanoDesktop({
      folders: {
        getFolders: vi.fn().mockResolvedValue({ success: true, folders: initialFolders }),
        createFolder: vi.fn(),
        renameFolder: vi.fn(),
        moveFolder: vi.fn(),
        deleteFolder: vi.fn(),
      },
      notes: {
        getNotes: vi.fn().mockResolvedValue({ success: true, notes: initialNotes }),
        getNote: vi.fn(),
        createNote: vi.fn(),
        updateNoteWithVersion: vi.fn(),
        moveNote: vi.fn(),
        toggleFavorite: vi.fn(),
        togglePin: vi.fn(),
        trashNote: trashSpy,
        restoreNote: vi.fn(),
        permanentlyDeleteNote: vi.fn(),
        getTrashNotes: vi.fn().mockResolvedValue({ success: true, notes: [] }),
        searchNotes: vi.fn(),
      },
    });
    window.kanoDesktop = mockApi;

    renderWithProviders(<NotesRoute />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Architecture Decisions')).toBeInTheDocument();
    });

    const trashBtn = screen.getByRole('button', { name: /Trash note/i });
    fireEvent.click(trashBtn);

    await waitFor(() => {
      expect(trashSpy).toHaveBeenCalledWith('note-1');
    });
  });

  it('renders trash route and restores soft-deleted notes', async () => {
    const trashedNote: NoteDTO = {
      ...initialNotes[0],
      isDeleted: true,
      deletedAt: '2026-01-02T12:00:00Z',
    };

    const restoreSpy = vi.fn().mockResolvedValue({ success: true });
    const deleteForeverSpy = vi.fn().mockResolvedValue({ success: true });

    const mockApi = createMockKanoDesktop({
      notes: {
        getNotes: vi.fn(),
        getNote: vi.fn(),
        createNote: vi.fn(),
        updateNoteWithVersion: vi.fn(),
        moveNote: vi.fn(),
        toggleFavorite: vi.fn(),
        togglePin: vi.fn(),
        trashNote: vi.fn(),
        restoreNote: restoreSpy,
        permanentlyDeleteNote: deleteForeverSpy,
        getTrashNotes: vi.fn().mockResolvedValue({ success: true, notes: [trashedNote] }),
        searchNotes: vi.fn(),
      },
    });
    window.kanoDesktop = mockApi;

    renderWithProviders(<TrashRoute />);

    await waitFor(() => {
      expect(screen.getByText('Architecture Decisions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Forever/i })).toBeInTheDocument();
    });

    // Test restore
    fireEvent.click(screen.getByRole('button', { name: /Restore/i }));
    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledWith('note-1');
    });
  });
});
