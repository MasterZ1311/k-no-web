import type { KanoDocContent } from '../../../preload/types';

export interface KanoNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: KanoNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
  [key: string]: unknown;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
  [key: string]: unknown;
}

/**
 * Transforms a canonical kano/doc/v1 AST into ProseMirror/TipTap compatible AST.
 * Handles mapping of checkList -> taskList and checkItem -> taskItem while
 * ensuring full backward/forward compatibility and preserving unknown nodes.
 */
export function kanoDocToTipTap(kanoDoc: KanoDocContent | undefined | null): TipTapNode {
  if (!kanoDoc || kanoDoc.type !== 'doc' || !Array.isArray(kanoDoc.content)) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  function transformNode(node: KanoNode): TipTapNode {
    if (!node || typeof node !== 'object') {
      return { type: 'paragraph' };
    }

    let targetType = node.type;
    const targetAttrs = node.attrs ? { ...node.attrs } : undefined;

    // Type mapping from kano/doc/v1 to TipTap
    if (node.type === 'checkList') {
      targetType = 'taskList';
    } else if (node.type === 'checkItem') {
      targetType = 'taskItem';
      if (!targetAttrs || typeof targetAttrs.checked !== 'boolean') {
        // Default checked to false if missing
        if (!targetAttrs) {
          return {
            type: 'taskItem',
            attrs: { checked: false },
            content: node.content ? node.content.map(transformNode) : undefined,
            marks: node.marks,
            text: node.text,
          };
        }
        targetAttrs.checked = false;
      }
    }

    const transformed: TipTapNode = {
      type: targetType,
      attrs: targetAttrs,
    };

    if (typeof node.text === 'string') {
      transformed.text = node.text;
    }

    if (Array.isArray(node.marks)) {
      transformed.marks = [...node.marks];
    }

    if (Array.isArray(node.content)) {
      transformed.content = node.content.map(transformNode);
    }

    return transformed;
  }

  const tipTapContent = kanoDoc.content.map((child) => transformNode(child as KanoNode));

  return {
    type: 'doc',
    content: tipTapContent.length > 0 ? tipTapContent : [{ type: 'paragraph' }],
  };
}

/**
 * Transforms ProseMirror/TipTap AST back into canonical kano/doc/v1 AST.
 * Maps taskList -> checkList, taskItem -> checkItem, and stamps schemaVersion: 1.
 */
export function tipTapToKanoDoc(tipTapDoc: TipTapNode | Record<string, unknown> | undefined | null): KanoDocContent {
  if (!tipTapDoc || typeof tipTapDoc !== 'object') {
    return {
      schemaVersion: 1,
      type: 'doc',
      content: [],
    };
  }

  function transformNode(node: TipTapNode): KanoNode {
    if (!node || typeof node !== 'object') {
      return { type: 'paragraph' };
    }

    let targetType = node.type;
    const targetAttrs = node.attrs ? { ...node.attrs } : undefined;

    // Type mapping from TipTap to kano/doc/v1
    if (node.type === 'taskList') {
      targetType = 'checkList';
    } else if (node.type === 'taskItem') {
      targetType = 'checkItem';
      if (!targetAttrs || typeof targetAttrs.checked !== 'boolean') {
        if (!targetAttrs) {
          return {
            type: 'checkItem',
            attrs: { checked: false },
            content: node.content ? node.content.map(transformNode) : undefined,
            marks: node.marks,
            text: node.text,
          };
        }
        targetAttrs.checked = false;
      }
    }

    const transformed: KanoNode = {
      type: targetType,
      attrs: targetAttrs,
    };

    if (typeof node.text === 'string') {
      transformed.text = node.text;
    }

    if (Array.isArray(node.marks)) {
      transformed.marks = [...node.marks];
    }

    if (Array.isArray(node.content)) {
      transformed.content = node.content.map(transformNode);
    }

    return transformed;
  }

  const rawContent = Array.isArray((tipTapDoc as TipTapNode).content)
    ? (tipTapDoc as TipTapNode).content!
    : [];

  const kanoContent = rawContent.map((node) => transformNode(node as TipTapNode));

  return {
    schemaVersion: 1,
    type: 'doc',
    content: kanoContent as Array<Record<string, unknown>>,
  };
}

/**
 * Extracts a normalized, single-line plain text summary from a document AST
 * for full-text search indexing and preview snippets.
 */
export function extractPlainTextSummary(
  doc: KanoDocContent | TipTapNode | undefined | null,
  maxLength = 240
): string {
  if (!doc || typeof doc !== 'object') return '';

  const pieces: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;

    if (typeof obj.text === 'string') {
      pieces.push(obj.text);
    }

    if (Array.isArray(obj.content)) {
      for (const child of obj.content) {
        walk(child);
      }
    }
  }

  walk(doc);

  return pieces
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
