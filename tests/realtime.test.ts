import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtimeService } from '../src/services/realtimeService';
import type { SupabaseManager } from '../src/services/supabaseClient';

describe('RealtimeService', () => {
  let mockSupabaseManager: Partial<SupabaseManager>;
  let mockChannel: any;
  let mockClient: any;
  let channelCallbacks: Record<string, Function>;
  let subscribeStatusCallback: Function;

  beforeEach(() => {
    channelCallbacks = {};

    mockChannel = {
      on: vi.fn((event, _filter, callback) => {
        channelCallbacks[event] = callback;
        return mockChannel;
      }),
      subscribe: vi.fn((callback) => {
        subscribeStatusCallback = callback;
        return mockChannel;
      }),
    };

    mockClient = {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(async () => 'ok'),
    };

    mockSupabaseManager = {
      getClient: () => mockClient,
      isConfigured: () => true,
    };
  });

  it('starts in disconnected state', () => {
    const service = new RealtimeService(mockSupabaseManager as SupabaseManager);
    expect(service.getStatus()).toBe('disconnected');
    expect(service.getActiveRoomId()).toBeNull();
  });

  it('subscribes to room channel and transitions status to connected', async () => {
    const service = new RealtimeService(mockSupabaseManager as SupabaseManager);

    const statuses: string[] = [];
    service.onStatusChange((s) => statuses.push(s));

    const res = await service.subscribeRoom('room-123');
    expect(res.success).toBe(true);
    expect(service.getActiveRoomId()).toBe('room-123');
    expect(mockClient.channel).toHaveBeenCalledWith('realtime:room:room-123');
    expect(mockChannel.subscribe).toHaveBeenCalled();

    // Simulate SUBSCRIBED event from Supabase
    subscribeStatusCallback('SUBSCRIBED', null);

    expect(service.getStatus()).toBe('connected');
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('dispatches sanitized invalidation events on postgres_changes', async () => {
    const service = new RealtimeService(mockSupabaseManager as SupabaseManager);
    await service.subscribeRoom('room-123');
    subscribeStatusCallback('SUBSCRIBED', null);

    let receivedInvalidation: any = null;
    service.onInvalidation((event) => {
      receivedInvalidation = event;
    });

    // Simulate postgres change on 'notes'
    const postgresChangeHandler = channelCallbacks['postgres_changes'];
    expect(postgresChangeHandler).toBeDefined();

    postgresChangeHandler({
      table: 'notes',
      eventType: 'UPDATE',
      new: { id: 'note-456', room_id: 'room-123', title: 'Updated Secret Note', secret_token: '12345' },
      old: { id: 'note-456', room_id: 'room-123' },
    });

    expect(receivedInvalidation).not.toBeNull();
    expect(receivedInvalidation.table).toBe('notes');
    expect(receivedInvalidation.eventType).toBe('UPDATE');
    expect(receivedInvalidation.id).toBe('note-456');
    expect(receivedInvalidation.roomId).toBe('room-123');
    // Ensure sensitive content/tokens are NOT in the invalidation event
    expect(receivedInvalidation.title).toBeUndefined();
    expect(receivedInvalidation.secret_token).toBeUndefined();
  });

  it('ignores postgres changes for other rooms', async () => {
    const service = new RealtimeService(mockSupabaseManager as SupabaseManager);
    await service.subscribeRoom('room-123');
    subscribeStatusCallback('SUBSCRIBED', null);

    let receivedInvalidation: any = null;
    service.onInvalidation((event) => {
      receivedInvalidation = event;
    });

    const postgresChangeHandler = channelCallbacks['postgres_changes'];
    postgresChangeHandler({
      table: 'notes',
      eventType: 'UPDATE',
      new: { id: 'note-999', room_id: 'room-other-999' },
    });

    expect(receivedInvalidation).toBeNull();
  });

  it('ignores unrecognized tables', async () => {
    const service = new RealtimeService(mockSupabaseManager as SupabaseManager);
    await service.subscribeRoom('room-123');
    subscribeStatusCallback('SUBSCRIBED', null);

    let receivedInvalidation: any = null;
    service.onInvalidation((event) => {
      receivedInvalidation = event;
    });

    const postgresChangeHandler = channelCallbacks['postgres_changes'];
    postgresChangeHandler({
      table: 'secret_internal_logs',
      eventType: 'INSERT',
      new: { id: 'log-1', room_id: 'room-123' },
    });

    expect(receivedInvalidation).toBeNull();
  });

  it('unsubscribes cleanly and resets state', async () => {
    const service = new RealtimeService(mockSupabaseManager as SupabaseManager);
    await service.subscribeRoom('room-123');
    subscribeStatusCallback('SUBSCRIBED', null);

    const unsubRes = await service.unsubscribeRoom();
    expect(unsubRes.success).toBe(true);
    expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    expect(service.getStatus()).toBe('disconnected');
    expect(service.getActiveRoomId()).toBeNull();
  });

  it('automatically unsubscribes existing channel when switching rooms', async () => {
    const service = new RealtimeService(mockSupabaseManager as SupabaseManager);
    await service.subscribeRoom('room-1');
    subscribeStatusCallback('SUBSCRIBED', null);

    await service.subscribeRoom('room-2');
    expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    expect(service.getActiveRoomId()).toBe('room-2');
    expect(mockClient.channel).toHaveBeenCalledWith('realtime:room:room-2');
  });
});
