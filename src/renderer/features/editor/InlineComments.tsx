import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  RotateCcw,
  Trash2,
  X,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';
import type { NoteComment, NoteCommentReply } from '../../../preload/types';

interface InlineCommentsProps {
  noteId: string;
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  pendingHighlightText?: string;
  onClearPendingHighlight?: () => void;
}

export const InlineComments: React.FC<InlineCommentsProps> = ({
  noteId,
  roomId,
  isOpen,
  onClose,
  pendingHighlightText,
  onClearPendingHighlight,
}) => {
  const { user } = useAuth();
  const { broadcastComment, subscribeComment } = useRealtime();

  const [comments, setComments] = useState<NoteComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Storage key for persistent caching
  const storageKey = `kano_comments_${noteId}`;

  // Load comments from local storage on mount / note change
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setComments(JSON.parse(stored));
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
  }, [noteId, storageKey]);

  // Save to local storage whenever comments change
  const saveComments = (newComments: NoteComment[]) => {
    setComments(newComments);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newComments));
    } catch {}
  };

  // Subscribe to real-time incoming comments from peers
  useEffect(() => {
    const unsubscribe = subscribeComment((incomingComment) => {
      if (incomingComment.noteId !== noteId) return;

      setComments((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === incomingComment.id);
        let next: NoteComment[];
        if (existingIdx !== -1) {
          next = [...prev];
          next[existingIdx] = incomingComment;
        } else {
          next = [incomingComment, ...prev];
        }
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    });

    return () => unsubscribe();
  }, [noteId, subscribeComment, storageKey]);

  // Focus input when opened with pending highlight
  useEffect(() => {
    if (isOpen && pendingHighlightText && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, pendingHighlightText]);

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !user) return;

    const newComment: NoteComment = {
      id: `comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      noteId,
      roomId,
      authorId: user.id,
      authorName: user.displayName || user.email?.split('@')[0] || 'You',
      authorEmail: user.email || '',
      content: newCommentText.trim(),
      highlightedText: pendingHighlightText?.trim() || undefined,
      resolved: false,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    const nextComments = [newComment, ...comments];
    saveComments(nextComments);
    setNewCommentText('');
    if (onClearPendingHighlight) onClearPendingHighlight();

    // Broadcast in real-time to other collaborators
    await broadcastComment(newComment);
  };

  const handleAddReply = async (commentId: string) => {
    const text = replyTextMap[commentId]?.trim();
    if (!text || !user) return;

    const reply: NoteCommentReply = {
      id: `reply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      authorId: user.id,
      authorName: user.displayName || user.email?.split('@')[0] || 'You',
      authorEmail: user.email || '',
      content: text,
      createdAt: new Date().toISOString(),
    };

    let updatedComment: NoteComment | null = null;
    const nextComments = comments.map((c) => {
      if (c.id === commentId) {
        updatedComment = {
          ...c,
          replies: [...c.replies, reply],
        };
        return updatedComment;
      }
      return c;
    });

    saveComments(nextComments);
    setReplyTextMap((prev) => ({ ...prev, [commentId]: '' }));

    if (updatedComment) {
      await broadcastComment(updatedComment);
    }
  };

  const handleToggleResolve = async (commentId: string) => {
    let updatedComment: NoteComment | null = null;
    const nextComments = comments.map((c) => {
      if (c.id === commentId) {
        updatedComment = {
          ...c,
          resolved: !c.resolved,
        };
        return updatedComment;
      }
      return c;
    });

    saveComments(nextComments);

    if (updatedComment) {
      await broadcastComment(updatedComment);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const nextComments = comments.filter((c) => c.id !== commentId);
    saveComments(nextComments);
  };

  const filteredComments = comments.filter((c) => {
    if (filter === 'open') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  if (!isOpen) return null;

  return (
    <div
      role="complementary"
      aria-label="Discussion Threads"
      className="w-80 md:w-88 border-l border-kano-border bg-kano-surface/95 backdrop-blur-xl flex flex-col h-full shadow-lg z-30 select-none animate-in slide-in-from-right-2 duration-150"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-kano-border flex items-center justify-between bg-kano-bg/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-kano-accent" />
          <h3 className="text-xs font-semibold text-kano-text-primary">
            Comments & Discussion ({unresolvedCount})
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comments panel"
          className="p-1 rounded-lg text-kano-text-muted hover:text-kano-text-primary hover:bg-kano-surface-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center px-3 py-2 border-b border-kano-border bg-kano-surface text-[11px] font-medium gap-1">
        <button
          type="button"
          onClick={() => setFilter('open')}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            filter === 'open'
              ? 'bg-kano-accent/15 text-kano-accent font-semibold'
              : 'text-kano-text-muted hover:text-kano-text-primary'
          }`}
        >
          Open ({unresolvedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('resolved')}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            filter === 'resolved'
              ? 'bg-kano-accent/15 text-kano-accent font-semibold'
              : 'text-kano-text-muted hover:text-kano-text-primary'
          }`}
        >
          Resolved ({comments.length - unresolvedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-kano-accent/15 text-kano-accent font-semibold'
              : 'text-kano-text-muted hover:text-kano-text-primary'
          }`}
        >
          All ({comments.length})
        </button>
      </div>

      {/* New Comment Input Box */}
      <form onSubmit={handleCreateComment} className="p-3 border-b border-kano-border bg-kano-bg/40">
        {pendingHighlightText && (
          <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border-l-2 border-amber-500 text-[11px] text-kano-text-secondary italic">
            <span className="font-semibold text-amber-500 not-italic block mb-0.5">Quoting text:</span>
            "{pendingHighlightText.slice(0, 120)}{pendingHighlightText.length > 120 ? '...' : ''}"
          </div>
        )}
        <div className="relative">
          <textarea
            ref={inputRef}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Start a discussion or leave feedback..."
            rows={2}
            className="w-full text-xs p-2.5 rounded-lg bg-kano-surface border border-kano-border placeholder:text-kano-text-muted text-kano-text-primary focus:outline-none focus:ring-1 focus:ring-kano-accent resize-none shadow-subtle"
          />
          <button
            type="submit"
            disabled={!newCommentText.trim()}
            className="absolute right-2 bottom-2.5 p-1 rounded-md bg-kano-accent text-white disabled:opacity-40 hover:opacity-90 transition-opacity shadow-xs"
            title="Post comment"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredComments.length === 0 ? (
          <div className="py-12 text-center text-kano-text-muted text-xs flex flex-col items-center justify-center">
            <Sparkles className="w-6 h-6 text-kano-text-muted/40 mb-2" />
            <span>No {filter} comments on this note.</span>
            <span className="text-[10px] mt-1 text-kano-text-muted/80">
              Highlight text in the editor to start a discussion.
            </span>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const isAuthor = user && comment.authorId === user.id;
            return (
              <div
                key={comment.id}
                className={`p-3 rounded-xl border transition-all text-xs ${
                  comment.resolved
                    ? 'bg-kano-bg/50 border-kano-border/60 opacity-75'
                    : 'bg-kano-surface border-kano-border shadow-subtle'
                }`}
              >
                {/* Quoted Snippet */}
                {comment.highlightedText && (
                  <div className="mb-2 p-1.5 rounded-md bg-amber-500/10 border-l-2 border-amber-500 text-[10px] text-kano-text-secondary italic">
                    "{comment.highlightedText}"
                  </div>
                )}

                {/* Comment Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-kano-accent/20 text-kano-accent flex items-center justify-center font-bold text-[9px] shrink-0">
                      {(comment.authorName[0] || 'U').toUpperCase()}
                    </div>
                    <span className="font-semibold text-kano-text-primary truncate">
                      {comment.authorName}
                    </span>
                    <span className="text-[10px] text-kano-text-muted">
                      {new Date(comment.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleResolve(comment.id)}
                      title={comment.resolved ? 'Reopen discussion' : 'Mark as resolved'}
                      className={`p-1 rounded hover:bg-kano-surface-hover transition-colors ${
                        comment.resolved ? 'text-emerald-500' : 'text-kano-text-muted hover:text-emerald-500'
                      }`}
                    >
                      {comment.resolved ? (
                        <RotateCcw className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {isAuthor && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        title="Delete comment"
                        className="p-1 rounded text-kano-text-muted hover:text-rose-500 hover:bg-kano-surface-hover transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment Body */}
                <p className="text-kano-text-primary text-xs leading-relaxed whitespace-pre-wrap break-words">
                  {comment.content}
                </p>

                {/* Threaded Replies */}
                {comment.replies.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-kano-border/60 space-y-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-1.5 pl-2 text-[11px]">
                        <CornerDownRight className="w-3 h-3 text-kano-text-muted shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-kano-text-primary">
                              {reply.authorName}
                            </span>
                            <span className="text-[9px] text-kano-text-muted">
                              {new Date(reply.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-kano-text-secondary mt-0.5 break-words">
                            {reply.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                <div className="mt-2.5 pt-2 border-t border-kano-border/50 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={replyTextMap[comment.id] || ''}
                    onChange={(e) =>
                      setReplyTextMap((prev) => ({ ...prev, [comment.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddReply(comment.id);
                      }
                    }}
                    placeholder="Reply to thread..."
                    className="flex-1 text-[11px] px-2 py-1 rounded-md bg-kano-bg border border-kano-border text-kano-text-primary placeholder:text-kano-text-muted focus:outline-none focus:ring-1 focus:ring-kano-accent"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddReply(comment.id)}
                    disabled={!replyTextMap[comment.id]?.trim()}
                    className="p-1 rounded-md bg-kano-surface hover:bg-kano-surface-hover border border-kano-border text-kano-text-primary disabled:opacity-40 transition-colors"
                  >
                    <Send className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
