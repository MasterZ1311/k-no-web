import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  RealtimeStatus,
  RealtimeTable,
  RealtimeEventType,
  RealtimeInvalidationEvent,
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

      channel.subscribe((status, err) => {
        if (err) {
          console.warn('[RealtimeService] Channel subscribe error:', err);
          this.setStatus('error');
          return;
        }

        switch (status) {
          case 'SUBSCRIBED':
            this.setStatus('connected');
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

  public async unsubscribeRoom(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentChannel) {
      this.activeRoomId = null;
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
  }
}

export const defaultRealtimeService = new RealtimeService();
