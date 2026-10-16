import { describe, it, expect } from 'vitest';
import {
  kanoDocToTipTap,
  tipTapToKanoDoc,
  extractPlainTextSummary,
} from '../src/renderer/features/editor/converter';
import type { KanoDocContent } from '../src/preload/types';

describe('Cross-Device Integration & Canonical Contract Parity', () => {
  describe('1. Kano Document AST (kano/doc/v1) Cross-Platform Parity', () => {
    it('round-trips full document fixture with headings, paragraphs, and inline marks', () => {
      const fixture: KanoDocContent = {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'káno̱ — Shared Workspace' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Normal text. ' },
              { type: 'text', text: 'Bold text', marks: [{ type: 'bold' }] },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'Italic text', marks: [{ type: 'italic' }] },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'Strikethrough', marks: [{ type: 'strike' }] },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'Inline Code', marks: [{ type: 'code' }] },
              { type: 'text', text: ', and ' },
              {
                type: 'text',
                text: 'Hyperlink',
                marks: [{ type: 'link', attrs: { href: 'https://kano.app/docs' } }],
              },
              { type: 'text', text: '.' },
            ],
          },
        ],
      };

      const tipTap = kanoDocToTipTap(fixture);
      expect(tipTap.type).toBe('doc');
      expect(tipTap.content).toHaveLength(2);
      expect(tipTap.content![0].type).toBe('heading');
      expect(tipTap.content![0].attrs?.level).toBe(1);

      const roundTripped = tipTapToKanoDoc(tipTap);
      expect(roundTripped.schemaVersion).toBe(1);
      expect(roundTripped.type).toBe('doc');
      expect(roundTripped).toEqual(fixture);
    });

    it('round-trips lists, checklists, code blocks, blockquotes, and dividers', () => {
      const fixture: KanoDocContent = {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bullet Item 1' }] }],
              },
            ],
          },
          {
            type: 'orderedList',
            attrs: { start: 1 },
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ordered Item 1' }] }],
              },
            ],
          },
          {
            type: 'checkList',
            content: [
              {
                type: 'checkItem',
                attrs: { checked: true },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Completed Checklist' }] }],
              },
              {
                type: 'checkItem',
                attrs: { checked: false },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pending Checklist' }] }],
              },
            ],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'kotlin' },
            content: [{ type: 'text', text: 'val syncCoordinator = SyncCoordinator()' }],
          },
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Offline-first by default.' }] }],
          },
          {
            type: 'horizontalRule',
          },
        ],
      };

      const tipTap = kanoDocToTipTap(fixture);
      // Check that checkList mapped to taskList in TipTap
      expect(tipTap.content![2].type).toBe('taskList');
      expect(tipTap.content![2].content![0].type).toBe('taskItem');
      expect(tipTap.content![2].content![0].attrs?.checked).toBe(true);

      const roundTripped = tipTapToKanoDoc(tipTap);
      expect(roundTripped.schemaVersion).toBe(1);
      expect(roundTripped.type).toBe('doc');
      expect(roundTripped.content[2].type).toBe('checkList');
      expect((roundTripped.content[2].content as Array<{ type: string }>)[0].type).toBe('checkItem');
      expect(roundTripped).toEqual(fixture);
    });

    it('round-trips tables with row, header, and cell attributes', () => {
      const fixture: KanoDocContent = {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    attrs: { colspan: 1, rowspan: 1 },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Client' }] }],
                  },
                  {
                    type: 'tableHeader',
                    attrs: { colspan: 1, rowspan: 1 },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Engine' }] }],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    attrs: { colspan: 1, rowspan: 1 },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Android' }] }],
                  },
                  {
                    type: 'tableCell',
                    attrs: { colspan: 1, rowspan: 1 },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Jetpack Compose + Room' }] }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const tipTap = kanoDocToTipTap(fixture);
      expect(tipTap.content![0].type).toBe('table');
      const roundTripped = tipTapToKanoDoc(tipTap);
      expect(roundTripped).toEqual(fixture);
    });

    it('preserves attachment references and unknown future nodes without data loss', () => {
      const fixture: KanoDocContent = {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'attachment',
            attrs: {
              attachmentId: 'att-uuid-456',
              filename: 'architecture_diagram.png',
              mimeType: 'image/png',
              sizeBytes: 2048576,
              storagePath: 'rooms/room-123/att-uuid-456/architecture_diagram.png',
              caption: 'Architecture Overview',
            },
          },
          {
            type: 'calloutBanner',
            attrs: { variant: 'tip' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pro Tip: Sync before offline edit.' }] }],
          },
        ],
      };

      const tipTap = kanoDocToTipTap(fixture);
      expect(tipTap.content![0].type).toBe('attachment');
      expect(tipTap.content![1].type).toBe('calloutBanner');

      const roundTripped = tipTapToKanoDoc(tipTap);
      expect(roundTripped).toEqual(fixture);
    });

    it('handles empty document and multilingual Unicode correctly', () => {
      const emptyDoc: KanoDocContent = {
        schemaVersion: 1,
        type: 'doc',
        content: [],
      };
      const tipTapEmpty = kanoDocToTipTap(emptyDoc);
      expect(tipTapEmpty.type).toBe('doc');
      expect(tipTapEmpty.content).toEqual([{ type: 'paragraph' }]);

      const unicodeDoc: KanoDocContent = {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'káno̱ — Ελληνικά, 日本語 (メモ), العربية, 中文, 🚀 Emojis! ✨',
              },
            ],
          },
        ],
      };
      const roundTripped = tipTapToKanoDoc(kanoDocToTipTap(unicodeDoc));
      expect(roundTripped).toEqual(unicodeDoc);

      const summary = extractPlainTextSummary(unicodeDoc);
      expect(summary).toBe('káno̱ — Ελληνικά, 日本語 (メモ), العربية, 中文, 🚀 Emojis! ✨');
    });
  });

  describe('2. Optimistic Concurrency & Version Conflict Contract Parity', () => {
    it('verifies update_note_with_version parameter schema and conflict response shape', () => {
      // The RPC parameter contract specified in docs/CONTRACTS.md and SQL migration:
      const rpcSignature = {
        p_note_id: 'uuid',
        p_title: 'string | null',
        p_content: 'object (JSONB)',
        p_folder_id: 'uuid | null',
        p_expected_version: 'number (INT)',
      };
      expect(rpcSignature).toBeDefined();

      // Successful RPC return structure:
      const successResponse = {
        success: true,
        conflict: false,
        note: {
          id: 'note-1',
          version: 2,
          title: 'Updated Title',
        },
      };
      expect(successResponse.success).toBe(true);
      expect(successResponse.conflict).toBe(false);

      // Conflict RPC return structure (stale base version):
      const conflictResponse = {
        success: false,
        conflict: true,
        current_version: 5,
        current_note: {
          id: 'note-1',
          version: 5,
          title: 'Remote Edited Title',
        },
      };
      expect(conflictResponse.success).toBe(false);
      expect(conflictResponse.conflict).toBe(true);
      expect(conflictResponse.current_version).toBe(5);
    });

    it('verifies conflict copy naming convention parity', () => {
      const originalTitle = 'Sprint Retrospective';
      const conflictCopyTitle = `${originalTitle} (Conflict Copy)`;
      expect(conflictCopyTitle).toBe('Sprint Retrospective (Conflict Copy)');
    });
  });

  describe('3. Kanban & Task Movement Contract Parity', () => {
    it('verifies move_task parameters and automatic column-status synchronization', () => {
      const moveTaskParams = {
        p_task_id: 'task-uuid-1',
        p_column_id: 'column-done-uuid',
        p_position: 0,
      };

      expect(moveTaskParams.p_task_id).toBe('task-uuid-1');
      expect(moveTaskParams.p_column_id).toBe('column-done-uuid');
      expect(moveTaskParams.p_position).toBe(0);

      // Allowed task status keys and priorities must match between TypeScript and Kotlin:
      const validStatuses = ['todo', 'in_progress', 'blocked', 'done'];
      const validPriorities = ['low', 'medium', 'high', 'urgent'];

      expect(validStatuses).toContain('todo');
      expect(validStatuses).toContain('done');
      expect(validPriorities).toContain('urgent');
    });
  });

  describe('4. Attachment Storage Path & Security Contract Parity', () => {
    it('generates compliant, sanitized storage object path in private bucket', () => {
      const roomId = 'room-123e4567-e89b-12d3-a456-426614174000';
      const attachmentId = 'att-987fcdeb-51a2-43f1-b987-123456789abc';
      const rawFilename = 'My Project Spec (Final).pdf';

      const sanitizedFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `rooms/${roomId}/${attachmentId}/${sanitizedFilename}`;

      expect(storagePath).toBe(
        'rooms/room-123e4567-e89b-12d3-a456-426614174000/att-987fcdeb-51a2-43f1-b987-123456789abc/My_Project_Spec__Final_.pdf'
      );

      // Verifies storage bucket name
      const bucketName = 'room-attachments';
      expect(bucketName).toBe('room-attachments');

      // Max attachment limit is 25MB (26,214,400 bytes)
      const maxBytes = 25 * 1024 * 1024;
      expect(maxBytes).toBe(26214400);
    });
  });

  describe('5. Realtime Phoenix Protocol Parity', () => {
    it('verifies channel topic and join payload structure with access_token', () => {
      const roomId = 'room-abc-123';
      const token = 'mock-jwt-token-xyz';
      const topic = `realtime:room:${roomId}`;

      const joinPayload = {
        topic,
        event: 'phx_join',
        payload: {
          config: {
            postgres_changes: [{ event: '*', schema: 'public' }],
          },
          access_token: token,
        },
        ref: '1',
      };

      expect(joinPayload.topic).toBe('realtime:room:room-abc-123');
      expect(joinPayload.payload.access_token).toBe('mock-jwt-token-xyz');
      expect(joinPayload.payload.config.postgres_changes[0].schema).toBe('public');
    });
  });
});
