import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  RealtimeStatus,
  RealtimeTable,
  RealtimeEventType,
  RealtimeInvalidationEvent,
  PresenceUser,
  NoteComment,
} from '../preload/types';
import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';

const RECOGNIZED_TABLES: Set<string> = new Set([
  'notes',
  'folders',
  'tasks',
  'task_checklists',
  'task_labels',
  'task_label_assignments',
  'boards',
  'board_columns',
  'calendar_events',
  'room_members',
  'activity_logs',
]);

export class RealtimeService {
  private supabaseManager: SupabaseManager;
  private currentChannel: RealtimeChannel | null = null;
  private activeRoomId: string | null = null;
  private status: RealtimeStatus = 'disconnected';

  private statusListeners: Set<(status: RealtimeStatus) => void> = new Set();
  private invalidationListeners: Set<(event: RealtimeInvalidationEvent) => void> = new Set();
  private presenceListeners: Set<(users: PresenceUser[]) => void> = new Set();
  private commentListeners: Set<(comment: NoteComment) => void> = new Set();
  private currentPresenceState: Map<string, PresenceUser> = new Map();
  private lastTrackedPresence: Partial<PresenceUser> | null = null;

  constructor(supabaseManager: SupabaseManager = defaultSupabaseManager) {
    this.supabaseManager = supabaseManager;
  }

  public getStatus(): RealtimeStatus {
    return this.status;
  }

  public getActiveRoomId(): string | null {
    return this.activeRoomId;
  }

  private setStatus(newStatus: RealtimeStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    for (const listener of this.statusListeners) {
      try {
        listener(newStatus);
      } catch (err) {
        console.warn('[RealtimeService] Error in status listener:', err);
      }
    }
  }

  private emitInvalidation(event: RealtimeInvalidationEvent): void {
    for (const listener of this.invalidationListeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('[RealtimeService] Error in invalidation listener:', err);
      }
    }
  }

  public async subscribeRoom(roomId: string): Promise<{ success: boolean; error?: string }> {
    if (!roomId || typeof roomId !== 'string') {
      return { success: false, error: 'A valid roomId is required to subscribe.' };
    }

    // Already subscribed to this room
    if (this.activeRoomId === roomId && this.currentChannel) {
      return { success: true };
    }

    // Unsubscribe from existing room channel if switching
    if (this.currentChannel) {
      await this.unsubscribeRoom();
    }

    const client = this.supabaseManager.getClient();
    if (!client || !this.supabaseManager.isConfigured()) {
      this.setStatus('disconnected');
      return { success: false, error: 'Supabase client is not configured or authenticated.' };
    }

    this.activeRoomId = roomId;
    this.setStatus('connecting');

    try {
      const channelTopic = `realtime:room:${roomId}`;
      const channel = client.channel(channelTopic);

      // Listen for postgres changes on public schema
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        (payload: {
          table: string;
          eventType: string;
          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        }) => {
          if (!this.activeRoomId) return;

          const table = payload.table;
          if (!RECOGNIZED_TABLES.has(table)) {
            return;
          }

          // Filter by roomId when present on the entity
          const payloadRoomId = (payload.new?.room_id || payload.old?.room_id) as string | undefined;
          if (payloadRoomId && payloadRoomId !== this.activeRoomId) {
            return;
          }

          // Construct minimal sanitized invalidation payload
          const invalidationEvent: RealtimeInvalidationEvent = {
            roomId: this.activeRoomId,
            table: table as RealtimeTable,
            eventType: (payload.eventType as RealtimeEventType) || 'UPDATE',
            id: (payload.new?.id || payload.old?.id || undefined) as string | undefined,
            timestamp: new Date().toISOString(),
          };

          this.emitInvalidation(invalidationEvent);
        }
      );

      // Presence synchronization
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        this.handlePresenceSync(state);
      });

      // Collaborative broadcast events (e.g. comments, replies)
      channel.on('broadcast', { event: 'comment' }, (payload: { payload: NoteComment }) => {
        if (payload?.payload) {
          this.emitComment(payload.payload);
        }
      });

      channel.subscribe((status, err) => {
        if (err) {
          console.warn('[RealtimeService] Channel subscribe error:', err);
          this.setStatus('error');
          return;
        }

        switch (status) {
          case 'SUBSCRIBED':
            this.setStatus('connected');
            if (this.lastTrackedPresence) {
              channel.track(this.lastTrackedPresence).catch(() => {});
            }
            break;
          case 'TIMED_OUT':
          case 'CHANNEL_ERROR':
            this.setStatus('error');
            break;
          case 'CLOSED':
            this.setStatus('disconnected');
            break;
          default:
            break;
        }
      });

      this.currentChannel = channel;
      return { success: true };
    } catch (err) {
      this.setStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  private handlePresenceSync(state: Record<string, unknown[]>): void {
    const usersMap = new Map<string, PresenceUser>();
    for (const key of Object.keys(state)) {
      const presences = state[key] as Array<Partial<PresenceUser>>;
      if (Array.isArray(presences)) {
        for (const p of presences) {
          if (p.userId) {
            usersMap.set(p.userId, {
              userId: p.userId,
              name: p.name || 'Collaborator',
              email: p.email || '',
              avatarUrl: p.avatarUrl,
              color: p.color || '#10b981',
              currentRoute: p.currentRoute,
              currentNoteId: p.currentNoteId,
              onlineAt: p.onlineAt || new Date().toISOString(),
            });
          }
        }
      }
    }
    this.currentPresenceState = usersMap;
    this.emitPresence(Array.from(usersMap.values()));
  }

  private emitPresence(users: PresenceUser[]): void {
    for (const listener of this.presenceListeners) {
      try {
        listener(users);
      } catch (err) {
        console.warn('[RealtimeService] Error in presence listener:', err);
      }
    }
  }

  private emitComment(comment: NoteComment): void {
    for (const listener of this.commentListeners) {
      try {
        listener(comment);
      } catch (err) {
        console.warn('[RealtimeService] Error in comment listener:', err);
      }
    }
  }

  public async trackPresence(state: Partial<PresenceUser>): Promise<{ success: boolean; error?: string }> {
    this.lastTrackedPresence = { ...this.lastTrackedPresence, ...state };
    if (!this.currentChannel) {
      if (state.userId) {
        this.currentPresenceState.set(state.userId, {
          userId: state.userId,
          name: state.name || 'You',
          email: state.email || '',
          color: state.color || '#10b981',
          currentRoute: state.currentRoute,
          currentNoteId: state.currentNoteId,
          onlineAt: state.onlineAt || new Date().toISOString(),
          ...state,
        });
        this.emitPresence(Array.from(this.currentPresenceState.values()));
      }
      return { success: true };
    }

    try {
      await this.currentChannel.track(this.lastTrackedPresence);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  public async getPresenceState(): Promise<PresenceUser[]> {
    return Array.from(this.currentPresenceState.values());
  }

  public onPresenceChange(callback: (users: PresenceUser[]) => void): () => void {
    this.presenceListeners.add(callback);
    callback(Array.from(this.currentPresenceState.values()));
    return () => {
      this.presenceListeners.delete(callback);
    };
  }

  public async broadcastComment(comment: NoteComment): Promise<{ success: boolean; error?: string }> {
    this.emitComment(comment);

    if (this.currentChannel) {
      try {
        await this.currentChannel.send({
          type: 'broadcast',
          event: 'comment',
          payload: comment,
        });
      } catch (err) {
        console.warn('[RealtimeService] Failed to broadcast comment:', err);
      }
    }
    return { success: true };
  }

  public onCommentBroadcast(callback: (comment: NoteComment) => void): () => void {
    this.commentListeners.add(callback);
    return () => {
      this.commentListeners.delete(callback);
    };
  }

  public async unsubscribeRoom(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentChannel) {
      this.activeRoomId = null;
      this.currentPresenceState.clear();
      this.setStatus('disconnected');
      return { success: true };
    }

    try {
      const client = this.supabaseManager.getClient();
      if (client && this.currentChannel) {
        await client.removeChannel(this.currentChannel);
      }
    } catch (err) {
      console.warn('[RealtimeService] Error removing channel:', err);
    } finally {
      this.currentChannel = null;
      this.activeRoomId = null;
      this.currentPresenceState.clear();
      this.setStatus('disconnected');
    }

    return { success: true };
  }

  public onStatusChange(callback: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public onInvalidation(callback: (event: RealtimeInvalidationEvent) => void): () => void {
    this.invalidationListeners.add(callback);
    return () => {
      this.invalidationListeners.delete(callback);
    };
  }

  public cleanup(): void {
    this.unsubscribeRoom().catch(() => {});
    this.statusListeners.clear();
    this.invalidationListeners.clear();
    this.presenceListeners.clear();
    this.commentListeners.clear();
  }
}

export const defaultRealtimeService = new RealtimeService();

