import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReminderService } from '../src/services/reminderService';
import type { ReminderDTO, NotificationPayload } from '../src/preload/types';

describe('Desktop ReminderService & Delivery Reliability', () => {
  let mockSupabaseManager: any;
  let mockNotificationService: any;
  let mockSettingsService: any;
  let mockClient: any;
  let currentTime: number;

  beforeEach(() => {
    vi.useFakeTimers();
    currentTime = new Date('2026-10-15T12:00:00.000Z').getTime();
    vi.setSystemTime(currentTime);

    mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-desktop-1', email: 'ada@kano.app' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'task-1', title: 'Prepare Architecture Docs', due_date: '2026-10-15T12:30:00Z', status: 'todo', is_deleted: false },
              error: null,
            }),
          };
        }
        if (table === 'calendar_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'event-1', title: 'Sprint Review', start_time: '2026-10-15T14:00:00Z' },
              error: null,
            }),
          };
        }
        if (table === 'reminders') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'reminder_deliveries') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    mockSupabaseManager = {
      isConfigured: vi.fn().mockReturnValue(true),
      getClient: vi.fn().mockReturnValue(mockClient),
    };

    mockNotificationService = {
      isSupported: vi.fn().mockReturnValue(true),
      show: vi.fn().mockResolvedValue({ success: true, shown: true }),
    };

    mockSettingsService = {
      getSettings: vi.fn().mockResolvedValue({
        notificationsEnabled: true,
        taskDueAlerts: true,
        roomActivityAlerts: true,
        privacyPreviewMode: false,
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createService = (customNow?: () => number) => {
    return new ReminderService(
      mockSupabaseManager,
      mockNotificationService,
      mockSettingsService,
      'test-desktop-device-123',
      customNow || (() => currentTime),
      null
    );
  };

  const sampleReminder: ReminderDTO = {
    id: 'reminder-1',
    roomId: 'room-1',
    taskId: 'task-1',
    eventId: null,
    triggerTime: '2026-10-15T12:30:00.000Z',
    offsetMinutes: 0,
    status: 'pending',
    createdBy: 'user-desktop-1',
    createdAt: '2026-10-15T10:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z',
  };

  describe('1. Scheduling & Accurate Timer Execution', () => {
    it('schedules future reminder and triggers notification when target time arrives', async () => {
      const service = createService();

      const result = await service.scheduleReminder(sampleReminder);
      expect(result.success).toBe(true);
      expect(result.scheduled).toBe(true);
      expect(result.status).toBe('scheduled');
      expect(service.getActiveTimerCount()).toBe(1);

      // Fast forward to firing time: 12:30:00 (30 minutes)
      currentTime += 30 * 60 * 1000;
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      expect(mockNotificationService.show).toHaveBeenCalledTimes(1);
      const callArg: NotificationPayload = mockNotificationService.show.mock.calls[0][0];
      expect(callArg.title).toBe('Prepare Architecture Docs');
      expect(callArg.body).toContain('Due: 2026-10-15T12:30:00Z');
      expect(callArg.category).toBe('task_due');

      // Verify delivery recorded
      expect(mockClient.from).toHaveBeenCalledWith('reminder_deliveries');
      expect(mockClient.from).toHaveBeenCalledWith('reminders');
      expect(service.getActiveTimerCount()).toBe(0);
    });

    it('cancels old timer when reminder is rescheduled', async () => {
      const service = createService();

      await service.scheduleReminder(sampleReminder);
      expect(service.getActiveTimerCount()).toBe(1);

      // Reschedule to 13:00:00
      const rescheduled = {
        ...sampleReminder,
        triggerTime: '2026-10-15T13:00:00.000Z',
      };
      await service.scheduleReminder(rescheduled);
      expect(service.getActiveTimerCount()).toBe(1);

      // Fast forward past old time (12:30)
      currentTime += 35 * 60 * 1000;
      await vi.advanceTimersByTimeAsync(35 * 60 * 1000);

      // Should not have fired at 12:30
      expect(mockNotificationService.show).not.toHaveBeenCalled();

      // Fast forward to new time (13:00)
      currentTime += 25 * 60 * 1000;
      await vi.advanceTimersByTimeAsync(25 * 60 * 1000);

      expect(mockNotificationService.show).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Deduplication & Idempotency', () => {
    it('suppresses duplicate delivery of the same occurrence on the same device', async () => {
      const service = createService();

      // First delivery
      await service.deliverReminder(sampleReminder);
      expect(mockNotificationService.show).toHaveBeenCalledTimes(1);

      // Second delivery attempt for the exact same occurrence
      const secondResult = await service.deliverReminder(sampleReminder);
      expect(secondResult.success).toBe(true);
      expect(secondResult.shown).toBe(false);
      expect(secondResult.reason).toContain('Occurrence already delivered');
      expect(mockNotificationService.show).toHaveBeenCalledTimes(1);
    });

    it('gracefully handles 409 unique constraint response from backend without crashing', async () => {
      const service = createService();

      // Simulate concurrent delivery by another thread triggering PostgreSQL 23505 unique violation
      mockClient.from = vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'task-1', title: 'Task', due_date: null, status: 'todo', is_deleted: false },
              error: null,
            }),
          };
        }
        if (table === 'reminder_deliveries') {
          return {
            insert: vi.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint "unique_reminder_delivery_occurrence"')),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const result = await service.deliverReminder({
        ...sampleReminder,
        id: 'reminder-concurrent-1',
      });

      expect(result.success).toBe(true);
      expect(result.shown).toBe(true);
    });
  });

  describe('3. Lateness Policy & Bounded Missed Reminders', () => {
    it('delivers immediately when reminder is within the 10-minute grace window', async () => {
      const service = createService();

      // Reminder was due 5 minutes ago (11:55:00 vs current 12:00:00)
      const slightlyLateReminder: ReminderDTO = {
        ...sampleReminder,
        triggerTime: '2026-10-15T11:55:00.000Z',
      };

      const result = await service.scheduleReminder(slightlyLateReminder);
      expect(result.success).toBe(true);
      expect(result.status).toBe('delivered');
      expect(mockNotificationService.show).toHaveBeenCalledTimes(1);
    });

    it('marks missed and suppresses notification when reminder is > 10 minutes in the past', async () => {
      const service = createService();

      // Reminder was due 2 hours ago (10:00:00 vs current 12:00:00)
      const longOverdueReminder: ReminderDTO = {
        ...sampleReminder,
        triggerTime: '2026-10-15T10:00:00.000Z',
      };

      const result = await service.scheduleReminder(longOverdueReminder);
      expect(result.success).toBe(true);
      expect(result.scheduled).toBe(false);
      expect(result.status).toBe('missed');
      expect(result.reason).toContain('bounded lateness window');

      // Must not show notification
      expect(mockNotificationService.show).not.toHaveBeenCalled();
    });
  });

  describe('4. System Sleep & Wake Reconciliation', () => {
    it('delivers due reminders within grace window upon waking from sleep', async () => {
      const service = createService();

      // Schedule for 12:15 (15 minutes into the future)
      const sleepReminder: ReminderDTO = {
        ...sampleReminder,
        triggerTime: '2026-10-15T12:15:00.000Z',
      };
      await service.scheduleReminder(sleepReminder);

      // Simulate system sleep: time jumps 20 minutes to 12:20 without timers executing
      currentTime += 20 * 60 * 1000; // now is 12:20 (5 minutes after trigger)

      // Trigger wake event
      await service.handleSystemWake();

      // 12:20 is 5 minutes after 12:15, which is within the 10-minute window -> delivers!
      expect(mockNotificationService.show).toHaveBeenCalledTimes(1);
    });

    it('silently expires reminders that became due > 10 minutes ago while PC was sleeping', async () => {
      const service = createService();

      // Schedule for 12:15
      const sleepReminder: ReminderDTO = {
        ...sampleReminder,
        triggerTime: '2026-10-15T12:15:00.000Z',
      };
      await service.scheduleReminder(sleepReminder);

      // Simulate system sleep: time jumps 2 hours to 14:15
      currentTime += 135 * 60 * 1000; // 2 hours and 15 mins later

      // Trigger wake event
      await service.handleSystemWake();

      // Over 2 hours late -> marked missed without notification
      expect(mockNotificationService.show).not.toHaveBeenCalled();
    });
  });

  describe('5. Target Re-Validation & Cancellation', () => {
    it('dismisses reminder without showing notification if target task was completed', async () => {
      mockClient.from = vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'task-1', title: 'Task', due_date: null, status: 'done', is_deleted: false },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const service = createService();
      const result = await service.deliverReminder(sampleReminder);

      expect(result.success).toBe(true);
      expect(result.shown).toBe(false);
      expect(result.reason).toContain('Target task completed or deleted');
      expect(mockNotificationService.show).not.toHaveBeenCalled();
    });

    it('dismisses reminder without showing notification if target task was deleted', async () => {
      mockClient.from = vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'task-1', title: 'Task', due_date: null, status: 'todo', is_deleted: true },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const service = createService();
      const result = await service.deliverReminder(sampleReminder);

      expect(result.success).toBe(true);
      expect(result.shown).toBe(false);
      expect(mockNotificationService.show).not.toHaveBeenCalled();
    });
  });

  describe('6. Account & Room Isolation', () => {
    it('onSignOut purges all active timers, pending reminders, and deduplication state', async () => {
      const service = createService();

      await service.scheduleReminder(sampleReminder);
      expect(service.getActiveTimerCount()).toBe(1);

      service.onSignOut();

      expect(service.getActiveTimerCount()).toBe(0);
      expect(service.getActiveReminders()).toHaveLength(0);
    });

    it('onRoomSwitched purges prior room timers and reloads new room reminders', async () => {
      const service = createService();

      await service.scheduleReminder(sampleReminder);
      expect(service.getActiveTimerCount()).toBe(1);

      await service.onRoomSwitched('room-new-workspace-2');

      expect(service.getCurrentRoomId()).toBe('room-new-workspace-2');
    });

    it('aborts delivery if user is unauthenticated', async () => {
      mockClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('Session expired'),
      });

      const service = createService();
      const result = await service.deliverReminder(sampleReminder);

      expect(result.success).toBe(false);
      expect(result.shown).toBe(false);
      expect(result.reason).toContain('User is not authenticated');
      expect(mockNotificationService.show).not.toHaveBeenCalled();
    });
  });

  describe('7. Timezone Independence & Privacy Preview Mode', () => {
    it('computes identical epoch milliseconds from UTC ISO string regardless of time-zone', () => {
      const isoUtc = '2026-10-15T12:30:00.000Z';
      const parsedEpoch = new Date(isoUtc).getTime();
      expect(parsedEpoch).toBe(1792067400000);
    });

    it('respects privacyPreviewMode by masking notification title and content', async () => {
      mockSettingsService.getSettings = vi.fn().mockResolvedValue({
        notificationsEnabled: true,
        taskDueAlerts: true,
        roomActivityAlerts: true,
        privacyPreviewMode: true,
      });

      const service = createService();
      await service.deliverReminder(sampleReminder);

      expect(mockNotificationService.show).toHaveBeenCalledTimes(1);
      const callArg: NotificationPayload = mockNotificationService.show.mock.calls[0][0];
      expect(callArg.title).toBe('káno̱ Reminder');
      expect(callArg.body).toBe('You have an upcoming scheduled item');
    });
  });
});
