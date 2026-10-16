import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type { RoomDTO, RoomMemberDTO, InvitationTokenDTO } from '../preload/types';

interface RawRoomMemberRow {
  role: 'owner' | 'member';
  joined_at: string;
  room: {
    id: string;
    name: string;
    description: string | null;
    owner_id: string;
    created_at: string;
    updated_at: string;
  } | null;
}

interface RawMemberProfileRow {
  user_id: string;
  room_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profiles: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export class RoomService {
  private manager: SupabaseManager;

  constructor(manager: SupabaseManager = defaultSupabaseManager) {
    this.manager = manager;
  }

  public async getRooms(): Promise<{ success: boolean; rooms: RoomDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, rooms: [], error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('room_members')
        .select('role, joined_at, room:rooms(id, name, description, owner_id, created_at, updated_at)')
        .order('joined_at', { ascending: false });

      if (error) {
        return { success: false, rooms: [], error: error.message };
      }

      const rows = (data || []) as unknown as RawRoomMemberRow[];
      const rooms: RoomDTO[] = [];

      for (const row of rows) {
        if (row.room) {
          rooms.push({
            id: row.room.id,
            name: row.room.name,
            description: row.room.description,
            ownerId: row.room.owner_id,
            role: row.role,
            createdAt: row.room.created_at,
            updatedAt: row.room.updated_at,
          });
        }
      }

      return { success: true, rooms };
    } catch (err: unknown) {
      return { success: false, rooms: [], error: err instanceof Error ? err.message : 'Failed to fetch rooms' };
    }
  }

  public async createRoom(
    name: string,
    description?: string
  ): Promise<{ success: boolean; room?: RoomDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Room name cannot be empty.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client.rpc('create_room', {
        p_name: name.trim(),
        p_description: description?.trim() || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as {
        id: string;
        name: string;
        description: string | null;
        owner_id: string;
        role: 'owner';
        created_at: string;
        updated_at: string;
      };

      const room: RoomDTO = {
        id: result.id,
        name: result.name,
        description: result.description,
        ownerId: result.owner_id,
        role: 'owner',
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };

      return { success: true, room };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Create room failed' };
    }
  }

  public async getRoomMembers(roomId: string): Promise<{ success: boolean; members: RoomMemberDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, members: [], error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('room_members')
        .select('user_id, room_id, role, joined_at, profiles(display_name, email, avatar_url)')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (error) {
        return { success: false, members: [], error: error.message };
      }

      const rows = (data || []) as unknown as RawMemberProfileRow[];
      const members: RoomMemberDTO[] = rows.map((r) => ({
        userId: r.user_id,
        roomId: r.room_id,
        role: r.role,
        joinedAt: r.joined_at,
        displayName: r.profiles?.display_name || null,
        email: r.profiles?.email || null,
        avatarUrl: r.profiles?.avatar_url || null,
      }));

      return { success: true, members };
    } catch (err: unknown) {
      return { success: false, members: [], error: err instanceof Error ? err.message : 'Failed to fetch members' };
    }
  }

  public async getInvitations(roomId: string): Promise<{ success: boolean; invitations: InvitationTokenDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, invitations: [], error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('invitation_tokens')
        .select('id, room_id, max_uses, uses_count, expires_at, is_revoked, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, invitations: [], error: error.message };
      }

      const invitations: InvitationTokenDTO[] = (data || []).map((row: any) => ({
        id: row.id,
        roomId: row.room_id,
        maxUses: row.max_uses,
        useCount: row.uses_count,
        expiresAt: row.expires_at,
        isRevoked: row.is_revoked,
        createdAt: row.created_at,
      }));

      return { success: true, invitations };
    } catch (err: unknown) {
      return { success: false, invitations: [], error: err instanceof Error ? err.message : 'Failed to fetch invitations' };
    }
  }

  public async generateInvitation(
    roomId: string,
    maxUses = 1,
    expiresAt?: string
  ): Promise<{ success: boolean; token?: string; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client.rpc('generate_invitation_token', {
        p_room_id: roomId,
        p_max_uses: maxUses,
        p_expires_at: expiresAt || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const token = data?.token as string | undefined;
      return { success: true, token };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to generate invitation token' };
    }
  }

  public async revokeInvitation(tokenId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client.rpc('revoke_invitation_token', {
        p_token_id: tokenId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.success === false) {
        return { success: false, error: data.error || 'Failed to revoke token' };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to revoke token' };
    }
  }

  public async removeMember(roomId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client.rpc('remove_room_member', {
        p_room_id: roomId,
        p_target_user_id: targetUserId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.success === false) {
        return { success: false, error: data.error || 'Failed to remove member' };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to remove member' };
    }
  }

  public async transferOwnership(roomId: string, newOwnerId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client.rpc('transfer_room_ownership', {
        p_room_id: roomId,
        p_new_owner_id: newOwnerId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.success === false) {
        return { success: false, error: data.error || 'Failed to transfer ownership' };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to transfer ownership' };
    }
  }

  public async redeemInvitation(
    token: string
  ): Promise<{ success: boolean; roomId?: string; alreadyMember?: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client.rpc('redeem_invitation_token', {
        p_token_plain: token.trim(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.success === false) {
        return { success: false, error: data.error || 'Failed to redeem invitation token' };
      }

      return {
        success: true,
        roomId: data.room_id,
        alreadyMember: data.already_member ?? false,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to redeem invitation' };
    }
  }
}

export const defaultRoomService = new RoomService();
