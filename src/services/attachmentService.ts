import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type { AttachmentDTO } from '../preload/types';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
]);

const MAX_ATTACHMENT_BYTES = 26214400; // 25MB

interface RawAttachmentRow {
  id: string;
  room_id: string;
  note_id: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export function mapRawAttachment(row: RawAttachmentRow, signedUrl?: string): AttachmentDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    noteId: row.note_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    signedUrl,
  };
}

function getUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class AttachmentService {
  private manager: SupabaseManager;

  constructor(manager: SupabaseManager = defaultSupabaseManager) {
    this.manager = manager;
  }

  public async uploadAttachment(
    roomId: string,
    noteId: string | null,
    filename: string,
    mimeType: string,
    fileBytes: ArrayBuffer
  ): Promise<{ success: boolean; attachment?: AttachmentDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!roomId || typeof roomId !== 'string') {
      return { success: false, error: 'Valid roomId is required.' };
    }

    const cleanFilename = (filename || 'file').trim();
    if (!cleanFilename) {
      return { success: false, error: 'Valid filename is required.' };
    }

    const cleanMime = (mimeType || '').trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      return {
        success: false,
        error: `Unsupported MIME type: ${cleanMime}. Allowed formats: PNG, JPEG, WebP, GIF, PDF, plain text, and Markdown.`,
      };
    }

    const byteLength = fileBytes.byteLength;
    if (byteLength <= 0) {
      return { success: false, error: 'Cannot upload empty file.' };
    }

    if (byteLength > MAX_ATTACHMENT_BYTES) {
      return {
        success: false,
        error: `File size exceeds the 25MB limit (provided: ${(byteLength / (1024 * 1024)).toFixed(2)} MB).`,
      };
    }

    const attachmentId = getUUID();
    const sanitizedFilename = cleanFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `rooms/${roomId}/${attachmentId}/${sanitizedFilename}`;

    const client = this.manager.getClient()!;
    try {
      const dataPayload = new Uint8Array(fileBytes);

      // 1. Upload file to private storage bucket 'room-attachments'
      const { error: uploadError } = await client.storage
        .from('room-attachments')
        .upload(storagePath, dataPayload, {
          contentType: cleanMime,
          upsert: false,
        });

      if (uploadError) {
        return { success: false, error: `Storage upload failed: ${uploadError.message}` };
      }

      // 2. Insert attachment metadata row
      const { data: dbData, error: dbError } = await client
        .from('attachments')
        .insert({
          id: attachmentId,
          room_id: roomId,
          note_id: noteId && noteId.trim().length > 0 ? noteId.trim() : null,
          filename: cleanFilename,
          mime_type: cleanMime,
          size_bytes: byteLength,
          storage_path: storagePath,
        })
        .select('*')
        .single();

      if (dbError) {
        // Rollback storage file on DB error
        await client.storage.from('room-attachments').remove([storagePath]);
        return { success: false, error: `Metadata save failed: ${dbError.message}` };
      }

      // 3. Create signed read URL for immediate rendering (valid for 1 hour)
      const { data: urlData } = await client.storage
        .from('room-attachments')
        .createSignedUrl(storagePath, 3600);

      const attachment = mapRawAttachment(dbData as RawAttachmentRow, urlData?.signedUrl);
      return { success: true, attachment };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Attachment upload failed.',
      };
    }
  }

  public async getNoteAttachments(noteId: string): Promise<{ success: boolean; attachments: AttachmentDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, attachments: [], error: 'Backend is not configured.' };
    }

    if (!noteId || typeof noteId !== 'string') {
      return { success: false, attachments: [], error: 'Valid noteId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('attachments')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: true });

      if (error) {
        return { success: false, attachments: [], error: error.message };
      }

      const rows = (data || []) as RawAttachmentRow[];
      const attachmentsWithUrls: AttachmentDTO[] = await Promise.all(
        rows.map(async (row) => {
          const { data: urlData } = await client.storage
            .from('room-attachments')
            .createSignedUrl(row.storage_path, 3600);
          return mapRawAttachment(row, urlData?.signedUrl);
        })
      );

      return { success: true, attachments: attachmentsWithUrls };
    } catch (err: unknown) {
      return {
        success: false,
        attachments: [],
        error: err instanceof Error ? err.message : 'Failed to fetch attachments.',
      };
    }
  }

  public async deleteAttachment(attachmentId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!attachmentId || typeof attachmentId !== 'string') {
      return { success: false, error: 'Valid attachmentId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      // 1. Fetch storage_path before deleting record
      const { data, error: fetchError } = await client
        .from('attachments')
        .select('storage_path')
        .eq('id', attachmentId)
        .single();

      if (fetchError || !data) {
        return { success: false, error: fetchError?.message || 'Attachment not found.' };
      }

      const storagePath = data.storage_path;

      // 2. Delete database record
      const { error: dbError } = await client
        .from('attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) {
        return { success: false, error: dbError.message };
      }

      // 3. Remove from storage bucket
      if (storagePath) {
        await client.storage.from('room-attachments').remove([storagePath]);
      }

      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete attachment.',
      };
    }
  }

  public async getAttachmentSignedUrl(storagePath: string): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }

    if (!storagePath || typeof storagePath !== 'string') {
      return { success: false, error: 'Valid storagePath is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client.storage
        .from('room-attachments')
        .createSignedUrl(storagePath, 3600);

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to generate signed URL' };
      }

      return { success: true, signedUrl: data.signedUrl };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get signed URL',
      };
    }
  }
}

export const defaultAttachmentService = new AttachmentService();
