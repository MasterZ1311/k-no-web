import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type { NoteDTO, NoteUpdateResult, KanoDocContent } from '../preload/types';

interface RawNoteRow {
  id: string;
  room_id: string;
  folder_id: string | null;
  title: string;
  content: KanoDocContent;
  plain_text_summary: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function extractPlainTextSummary(content: KanoDocContent | undefined, maxLength = 240): string {
  if (!content || !Array.isArray(content.content)) return '';
  const pieces: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (typeof node.text === 'string') {
      pieces.push(node.text);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (typeof child === 'object' && child !== null) {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }

  walk(content as unknown as Record<string, unknown>);
  return pieces.join(' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function mapRawNote(row: RawNoteRow): NoteDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    folderId: row.folder_id,
    title: row.title,
    content: row.content,
    plainTextSummary: row.plain_text_summary,
    isFavorite: row.is_favorite,
    isPinned: row.is_pinned,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class NoteService {
  private manager: SupabaseManager;

  constructor(manager: SupabaseManager = defaultSupabaseManager) {
    this.manager = manager;
  }

  public async getNotes(
    roomId: string,
    options?: { folderId?: string | null; isFavorite?: boolean; isPinned?: boolean }
  ): Promise<{ success: boolean; notes: NoteDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, notes: [], error: 'Backend is not configured.' };
    }

    if (!roomId || typeof roomId !== 'string') {
      return { success: false, notes: [], error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      let query = client
        .from('notes')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_deleted', false);

      if (options?.folderId !== undefined) {
        if (options.folderId === null) {
          query = query.is('folder_id', null);
        } else {
          query = query.eq('folder_id', options.folderId);
        }
      }

      if (options?.isFavorite !== undefined) {
        query = query.eq('is_favorite', options.isFavorite);
      }

      if (options?.isPinned !== undefined) {
        query = query.eq('is_pinned', options.isPinned);
      }

      const { data, error } = await query
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) {
        return { success: false, notes: [], error: error.message };
      }

      const rows = (data || []) as RawNoteRow[];
      return { success: true, notes: rows.map(mapRawNote) };
    } catch (err: unknown) {
      return {
        success: false,
        notes: [],
        error: err instanceof Error ? err.message : 'Failed to fetch notes.',
      };
    }
  }

  public async getNote(noteId: string): Promise<{ success: boolean; note?: NoteDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid noteId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, note: mapRawNote(data as RawNoteRow) };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch note.',
      };
    }
  }

  public async createNote(
    roomId: string,
    folderId?: string | null,
    title?: string,
    content?: KanoDocContent
  ): Promise<{ success: boolean; note?: NoteDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!roomId || typeof roomId !== 'string') {
      return { success: false, error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const initialTitle = (title || '').trim() || 'Untitled';
      const initialContent: KanoDocContent =
        content && content.type === 'doc' && content.schemaVersion === 1
          ? content
          : { schemaVersion: 1, type: 'doc', content: [] };
      const summary = extractPlainTextSummary(initialContent);
      const cleanFolderId = folderId && folderId.trim().length > 0 ? folderId.trim() : null;

      const { data, error } = await client
        .from('notes')
        .insert({
          room_id: roomId,
          folder_id: cleanFolderId,
          title: initialTitle,
          content: initialContent,
          plain_text_summary: summary || null,
        })
        .select('*')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, note: mapRawNote(data as RawNoteRow) };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create note.',
      };
    }
  }

  public async updateNoteWithVersion(
    noteId: string,
    expectedVersion: number,
    title?: string,
    content?: KanoDocContent,
    folderId?: string | null
  ): Promise<NoteUpdateResult> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid noteId is required.' };
    }

    if (typeof expectedVersion !== 'number') {
      return { success: false, error: 'Valid expectedVersion number is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const cleanFolderId = folderId && folderId.trim().length > 0 ? folderId.trim() : null;

      // Invoke atomic RPC with row-level concurrency lock
      const { data, error } = await client.rpc('update_note_with_version', {
        p_note_id: noteId,
        p_title: title !== undefined ? title.trim() || 'Untitled' : null,
        p_content: content !== undefined ? content : null,
        p_folder_id: cleanFolderId,
        p_expected_version: expectedVersion,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const rpcResult = data as {
        success: boolean;
        conflict?: boolean;
        current_version?: number;
        current_note?: RawNoteRow;
        note?: RawNoteRow;
        error?: string;
      };

      if (!rpcResult.success) {
        if (rpcResult.conflict) {
          return {
            success: false,
            conflict: true,
            currentVersion: rpcResult.current_version,
            currentNote: rpcResult.current_note ? mapRawNote(rpcResult.current_note) : undefined,
            error: 'Version conflict: note has been modified by another change.',
          };
        }
        return { success: false, error: rpcResult.error || 'Failed to update note.' };
      }

      // If content was modified, update plain_text_summary asynchronously for search indexing
      if (content !== undefined && rpcResult.note) {
        const summary = extractPlainTextSummary(content);
        await client
          .from('notes')
          .update({ plain_text_summary: summary || null })
          .eq('id', noteId);
      }

      return {
        success: true,
        conflict: false,
        note: rpcResult.note ? mapRawNote(rpcResult.note) : undefined,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update note.',
      };
    }
  }

  public async moveNote(noteId: string, folderId: string | null): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid noteId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const cleanFolderId = folderId && folderId.trim().length > 0 ? folderId.trim() : null;
      const { error } = await client
        .from('notes')
        .update({ folder_id: cleanFolderId })
        .eq('id', noteId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to move note.',
      };
    }
  }

  public async toggleFavorite(noteId: string, isFavorite: boolean): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid noteId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client
        .from('notes')
        .update({ is_favorite: Boolean(isFavorite) })
        .eq('id', noteId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle favorite.',
      };
    }
  }

  public async togglePin(noteId: string, isPinned: boolean): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid noteId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client
        .from('notes')
        .update({ is_pinned: Boolean(isPinned) })
        .eq('id', noteId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle pin.',
      };
    }
  }

  public async trashNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid noteId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client
        .from('notes')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', noteId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to trash note.',
      };
    }
  }

  public async restoreNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid noteId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data: note, error: fetchErr } = await client
        .from('notes')
        .select('folder_id')
        .eq('id', noteId)
        .single();

      if (fetchErr) {
        return { success: false, error: fetchErr.message };
      }

      let targetFolderId = note?.folder_id || null;

      if (targetFolderId) {
        const { data: folder } = await client
          .from('folders')
          .select('id, is_deleted')
          .eq('id', targetFolderId)
          .single();

        if (!folder || folder.is_deleted) {
          targetFolderId = null;
        }
      }

      const { error } = await client
        .from('notes')
        .update({
          is_deleted: false,
          deleted_at: null,
          folder_id: targetFolderId,
        })
        .eq('id', noteId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to restore note.',
      };
    }
  }

  public async permanentlyDeleteNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid noteId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete note permanently.',
      };
    }
  }

  public async getTrashNotes(roomId: string): Promise<{ success: boolean; notes: NoteDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, notes: [], error: 'Backend is not configured.' };
    }

    if (!roomId || typeof roomId !== 'string') {
      return { success: false, notes: [], error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('notes')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (error) {
        return { success: false, notes: [], error: error.message };
      }

      const rows = (data || []) as RawNoteRow[];
      return { success: true, notes: rows.map(mapRawNote) };
    } catch (err: unknown) {
      return {
        success: false,
        notes: [],
        error: err instanceof Error ? err.message : 'Failed to fetch trash notes.',
      };
    }
  }

  public async searchNotes(roomId: string, query: string): Promise<{ success: boolean; notes: NoteDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, notes: [], error: 'Backend is not configured.' };
    }

    if (!roomId || typeof roomId !== 'string') {
      return { success: false, notes: [], error: 'Valid roomId is required.' };
    }

    const trimmed = (query || '').trim();
    if (!trimmed) {
      return this.getNotes(roomId);
    }

    const client = this.manager.getClient()!;
    try {
      const escaped = trimmed.replace(/[%_]/g, '\\$&');
      const { data, error } = await client
        .from('notes')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        .or(`title.ilike.%${escaped}%,plain_text_summary.ilike.%${escaped}%`)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        return { success: false, notes: [], error: error.message };
      }

      const rows = (data || []) as RawNoteRow[];
      return { success: true, notes: rows.map(mapRawNote) };
    } catch (err: unknown) {
      return {
        success: false,
        notes: [],
        error: err instanceof Error ? err.message : 'Failed to search notes.',
      };
    }
  }
}

export const defaultNoteService = new NoteService();
