import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityService } from '../src/services/activityService';
import {
  sanitizeFilename,
  kanoDocToMarkdown,
  formatNoteMarkdownWithFrontmatter,
  formatNoteJsonExport,
} from '../src/services/exportService';
import type { KanoDocContent, NoteDTO } from '../src/preload/types';

describe('ActivityService & Activity Logging', () => {
  let mockSupabaseManager: any;
  let mockClient: any;
  let activityService: ActivityService;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    mockSupabaseManager = {
      isConfigured: vi.fn().mockReturnValue(true),
      getClient: vi.fn().mockReturnValue(mockClient),
    };

    activityService = new ActivityService(mockSupabaseManager);
  });

  it('rejects getActivityLogs if backend is not configured', async () => {
    mockSupabaseManager.isConfigured.mockReturnValue(false);
    const result = await activityService.getActivityLogs('room-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Backend is not configured');
    expect(result.logs).toEqual([]);
  });

  it('rejects getActivityLogs with invalid roomId', async () => {
    const result = await activityService.getActivityLogs('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid roomId is required');
  });

  it('fetches and maps activity logs with profile join and pagination', async () => {
    const mockDbRows = [
      {
        id: 'log-1',
        room_id: 'room-1',
        actor_id: 'user-1',
        entity_type: 'note',
        entity_id: 'note-1',
        action: 'created',
        details: { title: 'First Specification' },
        created_at: '2026-10-11T12:00:00Z',
        profiles: {
          display_name: 'Ada Lovelace',
          email: 'ada@kano.app',
        },
      },
      {
        id: 'log-2',
        room_id: 'room-1',
        actor_id: 'user-2',
        entity_type: 'folder',
        entity_id: 'folder-1',
        action: 'created',
        details: { name: 'Documentation' },
        created_at: '2026-10-11T12:05:00Z',
        profiles: null,
      },
    ];

    const mockQuery: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockDbRows, error: null }),
    };

    mockClient.from.mockReturnValue(mockQuery);

    const result = await activityService.getActivityLogs('room-1', 20, 0);

    expect(result.success).toBe(true);
    expect(result.logs.length).toBe(2);
    expect(result.logs[0].id).toBe('log-1');
    expect(result.logs[0].actorName).toBe('Ada Lovelace');
    expect(result.logs[0].actorEmail).toBe('ada@kano.app');
    expect(result.logs[0].entityType).toBe('note');
    expect(result.logs[0].action).toBe('created');
    expect(result.logs[0].details).toEqual({ title: 'First Specification' });

    // Fallback when profiles is null
    expect(result.logs[1].actorName).toBeUndefined();
    expect(result.logs[1].actorEmail).toBeUndefined();
  });

  it('calls log_room_activity RPC securely for new activity entries', async () => {
    mockClient.rpc.mockResolvedValue({
      data: 'log-uuid-999',
      error: null,
    });

    const result = await activityService.logAction(
      'room-1',
      'note',
      'note-123',
      'updated',
      { title: 'Updated Spec' }
    );

    expect(result.success).toBe(true);
    expect(result.logId).toBe('log-uuid-999');
    expect(mockClient.rpc).toHaveBeenCalledWith('log_room_activity', {
      p_room_id: 'room-1',
      p_entity_type: 'note',
      p_entity_id: 'note-123',
      p_action: 'updated',
      p_details: { title: 'Updated Spec' },
    });
  });

  it('handles log_room_activity RPC errors gracefully', async () => {
    mockClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Permission denied by room membership check' },
    });

    const result = await activityService.logAction(
      'room-1',
      'note',
      'note-123',
      'deleted'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied by room membership check');
  });
});

describe('ExportService & Data Fidelity', () => {
  it('sanitizeFilename() cleans illegal characters, path traversal, and strips control characters', () => {
    expect(sanitizeFilename('../../../evil.sh')).toBe('evil.sh');
    expect(sanitizeFilename('my:file*name?with"bad<chars>|')).toBe('my_file_name_with_bad_chars_');
    expect(sanitizeFilename('  whitespace   around  ')).toBe('whitespace around');
    expect(sanitizeFilename('   ')).toBe('untitled');
    expect(sanitizeFilename('a'.repeat(300))).toHaveLength(120);
  });

  it('kanoDocToMarkdown() correctly converts headings, lists, codeblocks, and text marks', () => {
    const doc: KanoDocContent = {
      schemaVersion: 1,
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Project Overview' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is a ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
            { type: 'text', text: ' and ' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
            { type: 'text', text: ' sentence.' },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const x: number = 42;' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item one' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item two' }],
                },
              ],
            },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task completed' }],
                },
              ],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task pending' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const markdown = kanoDocToMarkdown(doc);

    expect(markdown).toContain('# Project Overview');
    expect(markdown).toContain('This is a **bold** and *italic* sentence.');
    expect(markdown).toContain('```typescript\nconst x: number = 42;\n```');
    expect(markdown).toContain('- Item one');
    expect(markdown).toContain('- Item two');
    expect(markdown).toContain('- [x] Task completed');
    expect(markdown).toContain('- [ ] Task pending');
  });

  it('formatNoteMarkdownWithFrontmatter() includes clean YAML metadata header and content', () => {
    const mockNote: NoteDTO = {
      id: 'note-1234',
      roomId: 'room-5678',
      folderId: null,
      title: 'Meeting Notes',
      content: {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Discussing Q4 objectives.' }],
          },
        ],
      },
      plainTextSummary: 'Discussing Q4 objectives.',
      isFavorite: true,
      isPinned: false,
      isDeleted: false,
      deletedAt: null,
      version: 3,
      createdBy: 'user-ada',
      updatedBy: 'user-ada',
      createdAt: '2026-10-11T10:00:00Z',
      updatedAt: '2026-10-11T10:30:00Z',
    };

    const output = formatNoteMarkdownWithFrontmatter(mockNote, 'Engineering');

    expect(output).toContain('---');
    expect(output).toContain('id: "note-1234"');
    expect(output).toContain('title: "Meeting Notes"');
    expect(output).toContain('folder: "Engineering"');
    expect(output).toContain('version: 3');
    expect(output).toContain('isFavorite: true');
    expect(output).toContain('Discussing Q4 objectives.');
  });

  it('formatNoteJsonExport() produces lossless kano/export/v1 bundle with schema integrity', () => {
    const mockNote: NoteDTO = {
      id: 'note-1234',
      roomId: 'room-5678',
      folderId: 'folder-abc',
      title: 'Export Test',
      content: {
        schemaVersion: 1,
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
      },
      plainTextSummary: 'Hello world',
      isFavorite: false,
      isPinned: true,
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: '2026-10-11T10:00:00Z',
      updatedAt: '2026-10-11T10:00:00Z',
    };

    const jsonStr = formatNoteJsonExport(mockNote, 'Folder A');
    const parsed = JSON.parse(jsonStr);

    expect(parsed.$schema).toBe('https://kano.app/schemas/export-v1.json');
    expect(parsed.format).toBe('kano/export/v1');
    expect(parsed.note.id).toBe('note-1234');
    expect(parsed.note.title).toBe('Export Test');
    expect(parsed.note.folderName).toBe('Folder A');
    expect(parsed.note.content.schemaVersion).toBe(1);
    expect(parsed.exportedAt).toBeDefined();
  });
});
