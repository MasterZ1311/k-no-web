import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type { KanoDocContent, NoteDTO, ExportSummaryDTO } from '../preload/types';

export function sanitizeFilename(name: string): string {
  if (!name || !name.trim()) return 'untitled';
  const basename = name.split(/[/\\]/).pop() || 'untitled';
  const clean = basename
    .trim()
    .replace(/^(\.\.)+/, '')
    .replace(/[/\\?%*:|"<>]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
  return clean || 'untitled';
}

export function kanoDocToMarkdown(doc: KanoDocContent | undefined | null): string {
  if (!doc || !Array.isArray(doc.content)) return '';

  const lines: string[] = [];

  function renderInline(node: Record<string, unknown>): string {
    let text = typeof node.text === 'string' ? node.text : '';
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (typeof mark === 'object' && mark !== null) {
          const m = mark as { type: string; attrs?: Record<string, unknown> };
          if (m.type === 'bold') text = `**${text}**`;
          else if (m.type === 'italic') text = `*${text}*`;
          else if (m.type === 'strike') text = `~~${text}~~`;
          else if (m.type === 'code') text = `\`${text}\``;
          else if (m.type === 'link' && m.attrs?.href) text = `[${text}](${m.attrs.href})`;
        }
      }
    }
    return text;
  }

  function renderInlines(content: unknown[]): string {
    if (!Array.isArray(content)) return '';
    return content.map((c) => renderInline(c as Record<string, unknown>)).join('');
  }

  function walkBlock(block: Record<string, unknown>, depth = 0) {
    const type = block.type as string;
    const content = Array.isArray(block.content) ? block.content : [];
    const attrs = (block.attrs as Record<string, unknown>) || {};

    switch (type) {
      case 'heading': {
        const level = typeof attrs.level === 'number' ? Math.min(Math.max(attrs.level, 1), 6) : 1;
        const prefix = '#'.repeat(level);
        lines.push(`${prefix} ${renderInlines(content)}`);
        lines.push('');
        break;
      }
      case 'paragraph': {
        lines.push(renderInlines(content));
        lines.push('');
        break;
      }
      case 'bulletList': {
        for (const item of content) {
          const itemNode = item as Record<string, unknown>;
          const itemContent = Array.isArray(itemNode.content) ? itemNode.content : [];
          for (const sub of itemContent) {
            const subNode = sub as Record<string, unknown>;
            lines.push(`  `.repeat(depth) + `- ${renderInlines(subNode.content as unknown[])}`);
          }
        }
        lines.push('');
        break;
      }
      case 'orderedList': {
        let index = typeof attrs.start === 'number' ? attrs.start : 1;
        for (const item of content) {
          const itemNode = item as Record<string, unknown>;
          const itemContent = Array.isArray(itemNode.content) ? itemNode.content : [];
          for (const sub of itemContent) {
            const subNode = sub as Record<string, unknown>;
            lines.push(`  `.repeat(depth) + `${index}. ${renderInlines(subNode.content as unknown[])}`);
            index++;
          }
        }
        lines.push('');
        break;
      }
      case 'taskList':
      case 'checkList': {
        for (const item of content) {
          const itemNode = item as Record<string, unknown>;
          const itemAttrs = (itemNode.attrs as Record<string, unknown>) || {};
          const isChecked = itemAttrs.checked === true;
          const box = isChecked ? '[x]' : '[ ]';
          const itemContent = Array.isArray(itemNode.content) ? itemNode.content : [];
          let itemText = '';
          for (const sub of itemContent) {
            const subNode = sub as Record<string, unknown>;
            if (subNode.type === 'paragraph' && Array.isArray(subNode.content)) {
              itemText += renderInlines(subNode.content);
            } else if (subNode.text) {
              itemText += renderInline(subNode);
            }
          }
          if (!itemText && itemContent.length > 0) {
            itemText = renderInlines(itemContent);
          }
          lines.push(`- ${box} ${itemText}`);
        }
        lines.push('');
        break;
      }
      case 'codeBlock': {
        const lang = typeof attrs.language === 'string' ? attrs.language : '';
        const codeText = content.map((c: any) => c.text || '').join('');
        lines.push(`\`\`\`${lang}`);
        lines.push(codeText);
        lines.push('```');
        lines.push('');
        break;
      }
      case 'blockquote': {
        for (const sub of content) {
          const subNode = sub as Record<string, unknown>;
          lines.push(`> ${renderInlines(subNode.content as unknown[])}`);
        }
        lines.push('');
        break;
      }
      case 'horizontalRule': {
        lines.push('---');
        lines.push('');
        break;
      }
      case 'attachment': {
        const filename = attrs.filename || 'attachment';
        const storagePath = attrs.storagePath || '';
        lines.push(`📎 [Attachment: ${filename}](${storagePath})`);
        lines.push('');
        break;
      }
      default: {
        if (content.length > 0) {
          lines.push(renderInlines(content));
          lines.push('');
        }
        break;
      }
    }
  }

  for (const block of doc.content) {
    if (typeof block === 'object' && block !== null) {
      walkBlock(block as Record<string, unknown>);
    }
  }

  return lines.join('\n').trim();
}

export function formatNoteMarkdownWithFrontmatter(note: NoteDTO, folderName?: string): string {
  const frontmatter = [
    '---',
    `title: "${note.title.replace(/"/g, '\\"')}"`,
    `id: "${note.id}"`,
    `room_id: "${note.roomId}"`,
    ...(folderName ? [`folder: "${folderName.replace(/"/g, '\\"')}"`] : []),
    `version: ${note.version}`,
    `isFavorite: ${Boolean(note.isFavorite)}`,
    `isPinned: ${Boolean(note.isPinned)}`,
    `created_at: "${note.createdAt}"`,
    `updated_at: "${note.updatedAt}"`,
    ...(note.plainTextSummary ? [`summary: "${note.plainTextSummary.replace(/"/g, '\\"')}"`] : []),
    '---',
    '',
  ].join('\n');

  const body = kanoDocToMarkdown(note.content);
  return `${frontmatter}${body}\n`;
}

export function formatNoteJsonExport(note: NoteDTO, folderName?: string): string {
  const exportPayload = {
    $schema: 'https://kano.app/schemas/export-v1.json',
    format: 'kano/export/v1',
    schemaVersion: 1,
    exportType: 'note',
    exportedAt: new Date().toISOString(),
    generator: 'káno̱ web v1.0.0',
    note: {
      id: note.id,
      roomId: note.roomId,
      folderId: note.folderId,
      folderName: folderName || null,
      title: note.title,
      version: note.version,
      isFavorite: note.isFavorite,
      isPinned: note.isPinned,
      isDeleted: note.isDeleted,
      deletedAt: note.deletedAt,
      plainTextSummary: note.plainTextSummary,
      content: note.content,
      createdBy: note.createdBy,
      updatedBy: note.updatedBy,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
  };
  return JSON.stringify(exportPayload, null, 2);
}

function triggerBrowserDownload(filename: string, content: string, mimeType: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export class ExportService {
  constructor(private supabaseManager: SupabaseManager = defaultSupabaseManager) {}

  async exportNote(
    noteId: string,
    format: 'markdown' | 'json'
  ): Promise<{ success: boolean; content?: string; filename?: string; error?: string }> {
    const client = this.supabaseManager.getClient();
    if (!client) {
      return { success: false, error: 'Not authenticated or configured' };
    }

    try {
      const { data, error } = await client
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .eq('is_deleted', false)
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Note not found' };
      }

      const note: NoteDTO = {
        id: data.id,
        roomId: data.room_id,
        folderId: data.folder_id,
        title: data.title,
        content: data.content,
        plainTextSummary: data.plain_text_summary,
        isFavorite: data.is_favorite,
        isPinned: data.is_pinned,
        isDeleted: data.is_deleted,
        deletedAt: data.deleted_at,
        version: data.version,
        createdBy: data.created_by,
        updatedBy: data.updated_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      const baseName = sanitizeFilename(note.title);
      if (format === 'markdown') {
        const content = formatNoteMarkdownWithFrontmatter(note);
        const filename = `${baseName}.md`;
        triggerBrowserDownload(filename, content, 'text/markdown;charset=utf-8');
        return { success: true, content, filename };
      } else {
        const content = formatNoteJsonExport(note);
        const filename = `${baseName}.kano.json`;
        triggerBrowserDownload(filename, content, 'application/json;charset=utf-8');
        return { success: true, content, filename };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Export failed' };
    }
  }

  async exportRoom(roomId: string, format: 'markdown' | 'json'): Promise<ExportSummaryDTO> {
    const client = this.supabaseManager.getClient();
    if (!client) {
      return {
        success: false,
        format,
        exportedNotesCount: 0,
        exportedFoldersCount: 0,
        exportedAttachmentsCount: 0,
        skippedCount: 0,
        errors: ['Not authenticated or configured'],
      };
    }

    try {
      const { data: folders, error: folderErr } = await client
        .from('folders')
        .select('id, name, parent_id')
        .eq('room_id', roomId)
        .eq('is_deleted', false);

      if (folderErr) {
        return {
          success: false,
          format,
          exportedNotesCount: 0,
          exportedFoldersCount: 0,
          exportedAttachmentsCount: 0,
          skippedCount: 0,
          errors: [folderErr.message],
        };
      }

      const { data: notes, error: noteErr } = await client
        .from('notes')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_deleted', false);

      if (noteErr) {
        return {
          success: false,
          format,
          exportedNotesCount: 0,
          exportedFoldersCount: folders?.length || 0,
          exportedAttachmentsCount: 0,
          skippedCount: 0,
          errors: [noteErr.message],
        };
      }

      const { data: attachments } = await client
        .from('attachments')
        .select('id, filename, size_bytes')
        .eq('room_id', roomId);

      // Trigger summary download
      const summaryPayload = {
        exportedAt: new Date().toISOString(),
        roomId,
        foldersCount: folders?.length || 0,
        notesCount: notes?.length || 0,
        attachmentsCount: attachments?.length || 0,
        notes: (notes || []).map((n) => ({
          id: n.id,
          title: n.title,
          updatedAt: n.updated_at,
        })),
      };

      triggerBrowserDownload(
        `room-export-${roomId.slice(0, 8)}.json`,
        JSON.stringify(summaryPayload, null, 2),
        'application/json;charset=utf-8'
      );

      return {
        success: true,
        format,
        exportedNotesCount: notes?.length || 0,
        exportedFoldersCount: folders?.length || 0,
        exportedAttachmentsCount: attachments?.length || 0,
        skippedCount: 0,
        errors: [],
      };
    } catch (err: any) {
      return {
        success: false,
        format,
        exportedNotesCount: 0,
        exportedFoldersCount: 0,
        exportedAttachmentsCount: 0,
        skippedCount: 0,
        errors: [err.message || 'Room export failed'],
      };
    }
  }
}

export const defaultExportService = new ExportService();
