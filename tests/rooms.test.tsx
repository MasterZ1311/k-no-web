import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { RoomService } from '../src/services/roomService';
import { SupabaseManager } from '../src/services/supabaseClient';
import { RoomProvider } from '../src/renderer/features/rooms/RoomContext';
import { AuthProvider } from '../src/renderer/features/auth/AuthContext';
import { ToastProvider } from '../src/renderer/design-system/ToastProvider';
import { WorkspaceSwitcher } from '../src/renderer/shell/WorkspaceSwitcher';
import { CreateRoomDialog } from '../src/renderer/features/rooms/CreateRoomDialog';
import { JoinRoomDialog } from '../src/renderer/features/rooms/JoinRoomDialog';
import { ManageMembersDialog } from '../src/renderer/features/rooms/ManageMembersDialog';
import { mockDefaultUser } from './setup';

describe('káno̱ Desktop Rooms & Membership Management', () => {
  // --------------------------------------------------------------------------
  // 1. Main Process RoomService Unit Tests
  // --------------------------------------------------------------------------
  describe('RoomService (Main Process)', () => {
    it('maps Supabase room_members query results to canonical RoomDTOs', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              role: 'owner',
              joined_at: '2026-01-01T00:00:00Z',
              room: {
                id: 'room-1',
                name: 'Engineering Workspace',
                description: 'Core engineering projects',
                owner_id: 'usr-1',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
              },
            },
          ],
          error: null,
        }),
      };

      const mockClient = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      const manager = new SupabaseManager();
      manager.setCustomClient(mockClient, true);

      const roomService = new RoomService(manager);
      const res = await roomService.getRooms();

      expect(res.success).toBe(true);
      expect(res.rooms).toHaveLength(1);
      expect(res.rooms[0].name).toBe('Engineering Workspace');
      expect(res.rooms[0].role).toBe('owner');
    });

    it('invokes create_room RPC with trimmed parameters', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          id: 'room-2',
          name: 'Product Planning',
          description: null,
          owner_id: 'usr-1',
          role: 'owner',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        error: null,
      });

      const mockClient = { rpc: mockRpc } as any;
      const manager = new SupabaseManager();
      manager.setCustomClient(mockClient, true);

      const roomService = new RoomService(manager);
      const res = await roomService.createRoom('   Product Planning   ');

      expect(res.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('create_room', {
        p_name: 'Product Planning',
        p_description: null,
      });
      expect(res.room?.id).toBe('room-2');
    });

    it('invokes generate_invitation_token RPC with expiration and max uses', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          token: 'mock-token-hex-48',
          room_id: 'room-1',
        },
        error: null,
      });

      const mockClient = { rpc: mockRpc } as any;
      const manager = new SupabaseManager();
      manager.setCustomClient(mockClient, true);

      const roomService = new RoomService(manager);
      const res = await roomService.generateInvitation('room-1', 5, '2026-12-31T23:59:59Z');

      expect(res.success).toBe(true);
      expect(res.token).toBe('mock-token-hex-48');
      expect(mockRpc).toHaveBeenCalledWith('generate_invitation_token', {
        p_room_id: 'room-1',
        p_max_uses: 5,
        p_expires_at: '2026-12-31T23:59:59Z',
      });
    });

    it('invokes redeem_invitation_token RPC', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          room_id: 'room-joined-42',
          already_member: false,
        },
        error: null,
      });

      const mockClient = { rpc: mockRpc } as any;
      const manager = new SupabaseManager();
      manager.setCustomClient(mockClient, true);

      const roomService = new RoomService(manager);
      const res = await roomService.redeemInvitation('  my-plain-token  ');

      expect(res.success).toBe(true);
      expect(res.roomId).toBe('room-joined-42');
      expect(mockRpc).toHaveBeenCalledWith('redeem_invitation_token', {
        p_token_plain: 'my-plain-token',
      });
    });
  });

  // --------------------------------------------------------------------------
  // 2. Renderer Room Components & Dialogs
  // --------------------------------------------------------------------------
  describe('Room UI Dialogs & Switching', () => {
    it('renders WorkspaceSwitcher with active room name and role badge', () => {
      render(
        <ToastProvider>
          <AuthProvider initialStatus={{ isConfigured: true, user: mockDefaultUser }}>
            <RoomProvider>
              <WorkspaceSwitcher isCollapsed={false} />
            </RoomProvider>
          </AuthProvider>
        </ToastProvider>
      );

      expect(screen.getByText('Personal Workspace')).toBeInTheDocument();
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    it('creates a new room via CreateRoomDialog', async () => {
      const handleClose = vi.fn();
      render(
        <ToastProvider>
          <AuthProvider initialStatus={{ isConfigured: true, user: mockDefaultUser }}>
            <RoomProvider>
              <CreateRoomDialog isOpen={true} onClose={handleClose} />
            </RoomProvider>
          </AuthProvider>
        </ToastProvider>
      );

      const nameInput = screen.getByLabelText(/Room Name/i);
      fireEvent.change(nameInput, { target: { value: 'New Test Room' } });

      const submitBtn = screen.getByRole('button', { name: /Create Room/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it('redeems token via JoinRoomDialog', async () => {
      const handleClose = vi.fn();
      render(
        <ToastProvider>
          <AuthProvider initialStatus={{ isConfigured: true, user: mockDefaultUser }}>
            <RoomProvider>
              <JoinRoomDialog isOpen={true} onClose={handleClose} />
            </RoomProvider>
          </AuthProvider>
        </ToastProvider>
      );

      const tokenInput = screen.getByPlaceholderText(/Paste your 48-character invitation token/i);
      fireEvent.change(tokenInput, { target: { value: 'abcdef0123456789abcdef0123456789abcdef0123456789' } });

      const joinBtn = screen.getByRole('button', { name: /Join Room/i });
      fireEvent.click(joinBtn);

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it('renders ManageMembersDialog and allows owner to generate invitations', async () => {
      render(
        <ToastProvider>
          <AuthProvider initialStatus={{ isConfigured: true, user: mockDefaultUser }}>
            <RoomProvider>
              <ManageMembersDialog isOpen={true} onClose={vi.fn()} />
            </RoomProvider>
          </AuthProvider>
        </ToastProvider>
      );

      // Verify members tab is rendered
      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();

      // Switch to Invitations tab
      const invTabBtn = screen.getByRole('button', { name: /Invitations/i });
      fireEvent.click(invTabBtn);

      // Click generate invitation token
      const generateBtn = screen.getByRole('button', { name: /Generate Invitation Token/i });
      fireEvent.click(generateBtn);

      // Plaintext token display appears
      expect(await screen.findByText(/Active Plaintext Token/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
    });
  });
});
