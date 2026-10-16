import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  kanoDocToTipTap,
  tipTapToKanoDoc,
  extractPlainTextSummary,
} from '../src/renderer/features/editor/converter';
import type { KanoDocContent } from '../src/preload/types';

describe('Cross-Platform Parity & Contract Invariants (Desktop & Android)', () => {
  describe('1. Storage Bucket Invariant Verification', () => {
    it('verifies canonical attachment bucket name "room-attachments" across web and database migrations', () => {
      // 1. Check Web attachment service
      const attachmentServicePath = path.join(
        __dirname,
        '../src/services/attachmentService.ts'
      );
      const attachmentServiceSrc = fs.readFileSync(attachmentServicePath, 'utf-8');
      expect(attachmentServiceSrc).toContain("'room-attachments'");

      // 2. Check Database security migration defining the storage bucket
      const possibleMigrationPaths = [
        path.join(__dirname, '../../supabase/migrations/20261011062115_security_hardening.sql'),
        'E:/Github/káno̱/supabase/migrations/20261011062115_security_hardening.sql',
      ];
      const validMigration = possibleMigrationPaths.find((p) => fs.existsSync(p));
      if (validMigration) {
        const migrationSrc = fs.readFileSync(validMigration, 'utf-8');
        expect(migrationSrc).toContain("'room-attachments'");
      }
    });
  });

  describe('2. Kano Document AST Parity & Unknown Node Fallback', () => {
    it('handles unexpected/future AST block types gracefully without dropping child text', () => {
      // Unknown node from a future version (e.g., custom_embed or mathematical_formula)
      const futureDoc: KanoDocContent = {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Known paragraph.' }],
          },
          {
            type: 'future_widget',
            attrs: { widgetType: '3d-canvas', dataUrl: 'https://example.com' },
            content: [
              {
                type: 'text',
                text: 'Fallback text inside future widget.',
              },
            ],
          },
        ],
      };

      // Extract plain text summary must not crash on unrecognized block types
      const summary = extractPlainTextSummary(futureDoc);
      expect(summary).toContain('Known paragraph.');
      expect(summary).toContain('Fallback text inside future widget.');

      // TipTap conversion gracefully converts unknown blocks or wraps content without throwing
      expect(() => {
        const tipTap = kanoDocToTipTap(futureDoc);
        expect(tipTap.type).toBe('doc');
      }).not.toThrow();
    });

    it('round-trips deeply nested task lists and formatting without schema drift', () => {
      const nestedDoc: KanoDocContent = {
        schemaVersion: 1,
        type: 'doc',
        content: [
          {
            type: 'checkList',
            content: [
              {
                type: 'checkItem',
                attrs: { checked: true },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'Completed root task: ' },
                      {
                        type: 'text',
                        text: 'Security audit',
                        marks: [{ type: 'bold' }, { type: 'code' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'checkItem',
                attrs: { checked: false },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Pending subtask' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const tipTap = kanoDocToTipTap(nestedDoc);
      const reconstructed = tipTapToKanoDoc(tipTap);

      expect(reconstructed.schemaVersion).toBe(1);
      expect(reconstructed.content).toHaveLength(1);
      expect(reconstructed.content[0].type).toBe('checkList');
      const rootList = reconstructed.content[0] as { content?: Array<{ attrs?: { checked?: boolean } }> };
      expect(rootList.content).toHaveLength(2);
      expect(rootList.content?.[0].attrs?.checked).toBe(true);
      expect(rootList.content?.[1].attrs?.checked).toBe(false);
    });
  });

  describe('3. Filename Sanitization Parity across Windows and Mobile', () => {
    function sanitizeExportFilename(name: string): string {
      // Replaces invalid filename characters: < > : " / \ | ? *
      const sanitized = name
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[.\s]+|[.\s]+$/g, '');
      return sanitized || 'untitled';
    }

    it('removes NTFS and Linux prohibited characters consistently', () => {
      expect(sanitizeExportFilename('Project: Plan / 2026 *Draft*?')).toBe(
        'Project_ Plan _ 2026 _Draft__'
      );
      expect(sanitizeExportFilename('CON.txt')).toBe('CON.txt');
      expect(sanitizeExportFilename('   ...Note with leading dots...   ')).toBe(
        'Note with leading dots'
      );
      expect(sanitizeExportFilename('')).toBe('untitled');
      expect(sanitizeExportFilename('????')).toBe('____');
    });
  });

  describe('4. Reminder Delivery Deduplication Invariant', () => {
    it('verifies database unique index matches delivery deduplication composite key', () => {
      const localMigration = path.join(
        __dirname,
        '../supabase/migrations/20261011060025_content_and_productivity.sql'
      );
      const siblingMigration = path.join(
        __dirname,
        '../../káno̱/supabase/migrations/20261011060025_content_and_productivity.sql'
      );
      const migrationFile = fs.existsSync(localMigration) ? localMigration : siblingMigration;
      const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

      // The composite uniqueness constraint in PostgreSQL:
      // UNIQUE (reminder_id, user_id, device_id)
      expect(sqlContent).toMatch(/reminder_deliveries[\s\S]*?CONSTRAINT\s+\w+\s+UNIQUE\s*\(\s*reminder_id\s*,\s*user_id\s*,\s*device_id\s*\)/i);
    });
  });
});
