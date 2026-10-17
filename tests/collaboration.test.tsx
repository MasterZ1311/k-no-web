import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PresenceAvatarStack } from '../src/renderer/features/realtime/PresenceAvatarStack';
import { InlineComments } from '../src/renderer/features/editor/InlineComments';
import { AuthProvider } from '../src/renderer/features/auth/AuthContext';
import { RoomProvider } from '../src/renderer/features/rooms/RoomContext';
import { RealtimeProvider } from '../src/renderer/features/realtime/RealtimeContext';
import { ToastProvider } from '../src/renderer/design-system/ToastProvider';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <AuthProvider>
      <RoomProvider>
        <RealtimeProvider>
          <ToastProvider>{ui}</ToastProvider>
        </RealtimeProvider>
      </RoomProvider>
    </AuthProvider>
  );
};

describe('Collaborative Space Features', () => {
  describe('PresenceAvatarStack Component', () => {
    it('renders user initials and online indicator', async () => {
      renderWithProviders(<PresenceAvatarStack />);
      
      await waitFor(() => {
        const avatarBtn = screen.getByRole('button', { name: /active collaborators in room/i });
        expect(avatarBtn).toBeInTheDocument();
      });
    });

    it('opens room presence popover on click with collaborator information', async () => {
      renderWithProviders(<PresenceAvatarStack />);

      await waitFor(() => {
        const avatarBtn = screen.getByRole('button', { name: /active collaborators in room/i });
        fireEvent.click(avatarBtn);
      });

      expect(screen.getByText(/room presence/i)).toBeInTheDocument();
      expect(screen.getByText(/simulate peer/i)).toBeInTheDocument();
    });
  });

  describe('InlineComments Component', () => {
    it('renders empty state when there are no comments', async () => {
      renderWithProviders(
        <InlineComments
          noteId="test-note-1"
          roomId="test-room-1"
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/comments & discussion/i)).toBeInTheDocument();
        expect(screen.getByText(/no open comments on this note/i)).toBeInTheDocument();
      });
    });

    it('creates a new comment and displays it in the thread', async () => {
      renderWithProviders(
        <InlineComments
          noteId="test-note-2"
          roomId="test-room-1"
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const textarea = await screen.findByPlaceholderText(/start a discussion or leave feedback/i);
      fireEvent.change(textarea, { target: { value: 'This is a collaborative inline comment.' } });

      const postBtn = screen.getByTitle(/post comment/i);
      fireEvent.click(postBtn);

      expect(screen.getByText('This is a collaborative inline comment.')).toBeInTheDocument();
    });

    it('displays quoted highlight when pendingHighlightText is provided', async () => {
      renderWithProviders(
        <InlineComments
          noteId="test-note-3"
          roomId="test-room-1"
          isOpen={true}
          onClose={vi.fn()}
          pendingHighlightText="Highlighted paragraph text"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/quoting text:/i)).toBeInTheDocument();
        expect(screen.getByText(/"Highlighted paragraph text"/)).toBeInTheDocument();
      });
    });
  });
});
