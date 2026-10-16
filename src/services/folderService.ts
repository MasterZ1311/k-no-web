import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type { FolderDTO } from '../preload/types';

interface RawFolderRow {
  id: string;
  room_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export class FolderService {
  private manager: SupabaseManager;

  constructor(manager: SupabaseManager = defaultSupabaseManager) {
    this.manager = manager;
  }

  public async getFolders(roomId: string): Promise<{ success: boolean; folders: FolderDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, folders: [], error: 'Backend is not configured.' };
    }

    if (!roomId || typeof roomId !== 'string') {
      return { success: false, folders: [], error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      // Fetch active folders in room
      const { data: folderData, error: folderError } = await client
        .from('folders')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        .order('position', { ascending: true })
        .order('name', { ascending: true });

      if (folderError) {
        return { success: false, folders: [], error: folderError.message };
      }

      // Fetch note counts per folder in the room
      const { data: noteCounts, error: countError } = await client
        .from('notes')
        .select('folder_id')
        .eq('room_id', roomId)
        .eq('is_deleted', false);

      const countMap: Record<string, number> = {};
      if (!countError && noteCounts) {
        for (const row of noteCounts as Array<{ folder_id: string | null }>) {
          if (row.folder_id) {
            countMap[row.folder_id] = (countMap[row.folder_id] || 0) + 1;
          }
        }
      }

      const rows = (folderData || []) as RawFolderRow[];
      const folders: FolderDTO[] = rows.map((row) => ({
        id: row.id,
        roomId: row.room_id,
        parentId: row.parent_id,
        name: row.name,
        position: row.position,
        isDeleted: row.is_deleted,
        deletedAt: row.deleted_at,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        noteCount: countMap[row.id] || 0,
      }));

      return { success: true, folders };
    } catch (err: unknown) {
      return {
        success: false,
        folders: [],
        error: err instanceof Error ? err.message : 'Failed to fetch folders.',
      };
    }
  }

  public async createFolder(
    roomId: string,
    name: string,
    parentId?: string | null
  ): Promise<{ success: boolean; folder?: FolderDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!roomId || typeof roomId !== 'string') {
      return { success: false, error: 'Valid roomId is required.' };
    }

    const trimmedName = (name || '').trim();
    if (!trimmedName || trimmedName.length > 120) {
      return { success: false, error: 'Folder name must be between 1 and 120 characters.' };
    }

    const client = this.manager.getClient()!;
    try {
      const cleanParentId = parentId && parentId.trim().length > 0 ? parentId.trim() : null;

      const { data, error } = await client
        .from('folders')
        .insert({
          room_id: roomId,
          name: trimmedName,
          parent_id: cleanParentId,
        })
        .select('*')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const row = data as RawFolderRow;
      const folder: FolderDTO = {
        id: row.id,
        roomId: row.room_id,
        parentId: row.parent_id,
        name: row.name,
        position: row.position,
        isDeleted: row.is_deleted,
        deletedAt: row.deleted_at,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        noteCount: 0,
      };

      return { success: true, folder };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create folder.',
      };
    }
  }

  public async renameFolder(
    folderId: string,
    name: string
  ): Promise<{ success: boolean; folder?: FolderDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!folderId || typeof folderId !== 'string') {
      return { success: false, error: 'Valid folderId is required.' };
    }

    const trimmedName = (name || '').trim();
    if (!trimmedName || trimmedName.length > 120) {
      return { success: false, error: 'Folder name must be between 1 and 120 characters.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('folders')
        .update({ name: trimmedName })
        .eq('id', folderId)
        .select('*')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const row = data as RawFolderRow;
      const folder: FolderDTO = {
        id: row.id,
        roomId: row.room_id,
        parentId: row.parent_id,
        name: row.name,
        position: row.position,
        isDeleted: row.is_deleted,
        deletedAt: row.deleted_at,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      return { success: true, folder };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to rename folder.',
      };
    }
  }

  public async moveFolder(
    folderId: string,
    newParentId: string | null
  ): Promise<{ success: boolean; folder?: FolderDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!folderId || typeof folderId !== 'string') {
      return { success: false, error: 'Valid folderId is required.' };
    }

    if (newParentId === folderId) {
      return { success: false, error: 'A folder cannot be its own parent.' };
    }

    const client = this.manager.getClient()!;
    try {
      const cleanParentId = newParentId && newParentId.trim().length > 0 ? newParentId.trim() : null;

      const { data, error } = await client
        .from('folders')
        .update({ parent_id: cleanParentId })
        .eq('id', folderId)
        .select('*')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const row = data as RawFolderRow;
      const folder: FolderDTO = {
        id: row.id,
        roomId: row.room_id,
        parentId: row.parent_id,
        name: row.name,
        position: row.position,
        isDeleted: row.is_deleted,
        deletedAt: row.deleted_at,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      return { success: true, folder };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to move folder.',
      };
    }
  }

  public async deleteFolder(folderId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!folderId || typeof folderId !== 'string') {
      return { success: false, error: 'Valid folderId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      // Soft-delete folder
      const { error } = await client
        .from('folders')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', folderId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete folder.',
      };
    }
  }
}

export const defaultFolderService = new FolderService();
