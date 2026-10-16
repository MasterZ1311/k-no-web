import { describe, it, expect } from 'vitest';
import {
  kanoDocToTipTap,
  tipTapToKanoDoc,
  extractPlainTextSummary,
} from '../src/renderer/features/editor/converter';
import type { KanoDocContent } from '../src/preload/types';

describe('kano/doc/v1 AST Converter', () => {
  it('handles null, undefined, or empty doc gracefully', () => {
    const fromNull = kanoDocToTipTap(null);
    expect(fromNull.type).toBe('doc');
    expect(fromNull.content).toEqual([{ type: 'paragraph' }]);

    const fromUndefined = kanoDocToTipTap(undefined);
    expect(fromUndefined.type).toBe('doc');

    const emptyKano = tipTapToKanoDoc(null);
    expect(emptyKano.schemaVersion).toBe(1);
    expect(emptyKano.type).toBe('doc');
    expect(emptyKano.content).toEqual([]);
  });

  it('converts kano/doc/v1 checkList/checkItem to TipTap taskList/taskItem', () => {
    const kanoDoc: KanoDocContent = {
      schemaVersion: 1,
      type: 'doc',
      content: [
        {
          type: 'checkList',
          content: [
            {
              type: 'checkItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 1 done' }] }],
            },
            {
              type: 'checkItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 2 pending' }] }],
            },
          ],
        },
      ],
    };

    const tipTap = kanoDocToTipTap(kanoDoc);
    expect(tipTap.content![0].type).toBe('taskList');
    const taskItems = tipTap.content![0].content!;
    expect(taskItems[0].type).toBe('taskItem');
    expect(taskItems[0].attrs?.checked).toBe(true);
    expect(taskItems[1].type).toBe('taskItem');
    expect(taskItems[1].attrs?.checked).toBe(false);

    // Convert back
    const roundTripped = tipTapToKanoDoc(tipTap);
    expect(roundTripped.schemaVersion).toBe(1);
    expect(roundTripped.type).toBe('doc');
    expect(roundTripped.content[0].type).toBe('checkList');
    const checkItems = (roundTripped.content[0].content as Array<{ type: string; attrs: { checked: boolean } }>);
    expect(checkItems[0].type).toBe('checkItem');
    expect(checkItems[0].attrs.checked).toBe(true);
    expect(checkItems[1].type).toBe('checkItem');
    expect(checkItems[1].attrs.checked).toBe(false);
  });

  it('preserves marks (bold, italic, strike, code, link) across round trip', () => {
    const kanoDoc: KanoDocContent = {
      schemaVersion: 1,
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Bold and link',
              marks: [
                { type: 'bold' },
                { type: 'link', attrs: { href: 'https://kano.app' } },
              ],
            },
          ],
        },
      ],
    };

    const tipTap = kanoDocToTipTap(kanoDoc);
    const textNode = tipTap.content![0].content![0];
    expect(textNode.marks).toHaveLength(2);
    expect(textNode.marks![0].type).toBe('bold');
    expect(textNode.marks![1].attrs?.href).toBe('https://kano.app');

    const backToKano = tipTapToKanoDoc(tipTap);
    expect(backToKano).toEqual(kanoDoc);
  });

  it('preserves headings, code blocks, blockquotes, and unknown nodes', () => {
    const kanoDoc: KanoDocContent = {
      schemaVersion: 1,
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Section Title' }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const a = 1;' }],
        },
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Wise quote' }] }],
        },
        {
          type: 'customCalloutNode',
          attrs: { calloutType: 'warning' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Be careful' }] }],
        },
      ],
    };

    const tipTap = kanoDocToTipTap(kanoDoc);
    expect(tipTap.content![0].attrs?.level).toBe(2);
    expect(tipTap.content![1].attrs?.language).toBe('typescript');
    expect(tipTap.content![3].type).toBe('customCalloutNode');

    const backToKano = tipTapToKanoDoc(tipTap);
    expect(backToKano).toEqual(kanoDoc);
  });

  it('extractPlainTextSummary correctly extracts and truncates text', () => {
    const kanoDoc: KanoDocContent = {
      schemaVersion: 1,
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Meeting Minutes' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Discussed project architecture ' },
            { type: 'text', text: 'and offline persistence.' },
          ],
        },
      ],
    };

    const summary = extractPlainTextSummary(kanoDoc, 50);
    expect(summary).toBe('Meeting Minutes Discussed project architecture and');
  });
});
