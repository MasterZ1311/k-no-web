import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import { NotificationService, defaultNotificationService } from './notificationService';
import { SettingsService, defaultSettingsService } from './settingsService';
import type { ReminderDTO } from '../preload/types';

export interface RawReminderRow {
  id: string;
  room_id: string;
  task_id: string | null;
  event_id: string | null;
  trigger_time: string;
  offset_minutes: number;
  status: 'pending' | 'delivered' | 'dismissed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function mapRawReminder(row: RawReminderRow): ReminderDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    taskId: row.task_id,
    eventId: row.event_id,
    triggerTime: row.trigger_time,
    offsetMinutes: row.offset_minutes,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ReminderService {
  private manager: SupabaseManager;
  private notificationService: NotificationService;
  private settingsService: SettingsService;
  private deviceId: string;
  private activeTimers = new Map<string, any>();
  private activeReminders = new Map<string, ReminderDTO>();
  private deliveredOccurrences = new Set<string>();
  private getNow: () => number;
  private currentRoomId: string | null = null;

  public static readonly LATENESS_WINDOW_MS = 600_000; // 10 minutes

  constructor(
    manager: SupabaseManager = defaultSupabaseManager,
    notificationService: NotificationService = defaultNotificationService,
    settingsService: SettingsService = defaultSettingsService,
    customDeviceId?: string,
    getNow: () => number = () => Date.now(),
    _powerMonitor?: any
  ) {
    this.manager = manager;
    this.notificationService = notificationService;
    this.settingsService = settingsService;
    this.getNow = getNow;
    this.deviceId = customDeviceId || this.initDeviceId();
  }

  private initDeviceId(): string {
    if (typeof window === 'undefined') return `web-${getUUID()}`;
    try {
      const stored = localStorage.getItem('kano_web_device_id');
      if (stored && stored.length > 0) return stored;
      const newId = `web-${getUUID()}`;
      localStorage.setItem('kano_web_device_id', newId);
      return newId;
    } catch {
      return `web-${getUUID()}`;
    }
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getActiveTimerCount(): number {
    return this.activeTimers.size;
  }

  public getActiveReminders(): ReminderDTO[] {
    return Array.from(this.activeReminders.values());
  }

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  public async scheduleReminder(
    reminder: ReminderDTO
  ): Promise<{ success: boolean; scheduled: boolean; status: string; reason?: string }> {
    if (reminder.status !== 'pending') {
      this.cancelReminder(reminder.id);
      return { success: true, scheduled: false, status: reminder.status };
    }

    const triggerInstant = new Date(reminder.triggerTime).getTime();
    if (isNaN(triggerInstant)) {
      return { success: false, scheduled: false, status: 'error', reason: 'Invalid triggerTime format.' };
    }

    const targetEpochMs = triggerInstant - reminder.offsetMinutes * 60 * 1000;
    const now = this.getNow();
    const delay = targetEpochMs - now;

    if (delay < -ReminderService.LATENESS_WINDOW_MS) {
      this.cancelReminder(reminder.id);
      await this.markMissed(reminder);
      return { success: true, scheduled: false, status: 'missed', reason: 'Reminder expired beyond bounded lateness window.' };
    }

    if (delay <= 0) {
      this.cancelReminder(reminder.id);
      const deliveryResult = await this.deliverReminder(reminder);
      return { success: true, scheduled: false, status: 'delivered', reason: deliveryResult.reason };
    }

    this.cancelReminder(reminder.id);

    const timer = setTimeout(async () => {
      await this.deliverReminder(reminder);
    }, delay);

    this.activeTimers.set(reminder.id, timer);
    this.activeReminders.set(reminder.id, reminder);

    return { success: true, scheduled: true, status: 'scheduled' };
  }

  public cancelReminder(reminderId: string): void {
    const timer = this.activeTimers.get(reminderId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(reminderId);
    }
    this.activeReminders.delete(reminderId);
  }

  public async rescheduleAll(reminders: ReminderDTO[]): Promise<void> {
    const newIds = new Set(reminders.map((r) => r.id));

    for (const activeId of Array.from(this.activeTimers.keys())) {
      if (!newIds.has(activeId)) {
        this.cancelReminder(activeId);
      }
    }

    for (const reminder of reminders) {
      if (reminder.status === 'pending') {
        await this.scheduleReminder(reminder);
      } else {
        this.cancelReminder(reminder.id);
      }
    }
  }

  public async deliverReminder(
    reminder: ReminderDTO
  ): Promise<{ success: boolean; shown: boolean; reason?: string }> {
    const scheduledFor = reminder.triggerTime;
    const occurrenceKey = `${reminder.id}:${scheduledFor}`;

    if (this.deliveredOccurrences.has(occurrenceKey)) {
      this.cancelReminder(reminder.id);
      return { success: true, shown: false, reason: 'Occurrence already delivered on this device.' };
    }

    if (!this.manager.isConfigured()) {
      return { success: false, shown: false, reason: 'Backend is not configured.' };
    }

    const client = this.manager.getClient();
    if (!client) {
      return { success: false, shown: false, reason: 'Supabase client unavailable.' };
    }

    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      return { success: false, shown: false, reason: 'User is not authenticated.' };
    }
    const currentUserId = authData.user.id;

    let title = 'Scheduled Reminder';
    let message = 'You have an upcoming item';
    let targetRoute = '/tasks';

    if (reminder.taskId) {
      const { data: task, error: taskError } = await client
        .from('tasks')
        .select('id, title, due_date, status, is_deleted')
        .eq('id', reminder.taskId)
        .single();

      if (taskError || !task || task.is_deleted || task.status === 'done') {
        await this.markDismissed(reminder.id);
        this.cancelReminder(reminder.id);
        return { success: true, shown: false, reason: 'Target task completed or deleted.' };
      }

      title = task.title;
      message = task.due_date ? `Due: ${task.due_date}` : 'Upcoming task deadline';
      targetRoute = '/tasks';
    } else if (reminder.eventId) {
      const { data: event, error: eventError } = await client
        .from('calendar_events')
        .select('id, title, start_time')
        .eq('id', reminder.eventId)
        .single();

      if (eventError || !event) {
        await this.markDismissed(reminder.id);
        this.cancelReminder(reminder.id);
        return { success: true, shown: false, reason: 'Target calendar event deleted or not found.' };
      }

      title = event.title;
      message = `Event starts at: ${event.start_time}`;
      targetRoute = '/calendar';
    }

    const settings = await this.settingsService.getSettings();
    const displayTitle = settings.privacyPreviewMode ? 'káno̱ Reminder' : title;
    const displayMessage = settings.privacyPreviewMode ? 'You have an upcoming scheduled item' : message;

    const showResult = await this.notificationService.show({
      id: reminder.id,
      title: displayTitle,
      body: displayMessage,
      roomId: reminder.roomId,
      route: targetRoute,
      category: 'task_due',
    });

    if (showResult.shown) {
      this.deliveredOccurrences.add(occurrenceKey);
      this.cancelReminder(reminder.id);

      const nowIso = new Date(this.getNow()).toISOString();

      try {
        await client.from('reminder_deliveries').insert({
          id: getUUID(),
          reminder_id: reminder.id,
          user_id: currentUserId,
          device_id: this.deviceId,
          scheduled_for: scheduledFor,
          delivered_at: nowIso,
        });
      } catch {
        // Handled
      }

      try {
        await client
          .from('reminders')
          .update({ status: 'delivered', updated_at: nowIso })
          .eq('id', reminder.id);
      } catch {
        // Non-blocking
      }

      return { success: true, shown: true };
    }

    return { success: true, shown: false, reason: showResult.reason || 'Notification suppressed.' };
  }

  public async handleSystemWake(): Promise<void> {
    const now = this.getNow();
    const pending = Array.from(this.activeReminders.values());

    for (const reminder of pending) {
      const triggerInstant = new Date(reminder.triggerTime).getTime();
      const targetEpochMs = triggerInstant - reminder.offsetMinutes * 60 * 1000;

      if (targetEpochMs <= now) {
        this.cancelReminder(reminder.id);
        const delay = targetEpochMs - now;

        if (delay < -ReminderService.LATENESS_WINDOW_MS) {
          await this.markMissed(reminder);
        } else {
          await this.deliverReminder(reminder);
        }
      }
    }
  }

  private async markMissed(reminder: ReminderDTO): Promise<void> {
    this.cancelReminder(reminder.id);
    if (!this.manager.isConfigured()) return;
    const client = this.manager.getClient();
    if (!client) return;

    try {
      await client
        .from('reminders')
        .update({ status: 'dismissed', updated_at: new Date(this.getNow()).toISOString() })
        .eq('id', reminder.id);
    } catch {
      // Ignored
    }
  }

  private async markDismissed(reminderId: string): Promise<void> {
    if (!this.manager.isConfigured()) return;
    const client = this.manager.getClient();
    if (!client) return;

    try {
      await client
        .from('reminders')
        .update({ status: 'dismissed', updated_at: new Date(this.getNow()).toISOString() })
        .eq('id', reminderId);
    } catch {
      // Ignored
    }
  }

  public onSignOut(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    this.activeReminders.clear();
    this.deliveredOccurrences.clear();
    this.currentRoomId = null;
  }

  public async onRoomSwitched(roomId: string): Promise<void> {
    this.onSignOut();
    this.currentRoomId = roomId;

    const result = await this.getReminders(roomId);
    if (result.success && result.reminders) {
      await this.rescheduleAll(result.reminders);
    }
  }

  public async getReminders(
    roomId: string
  ): Promise<{ success: boolean; reminders: ReminderDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, reminders: [], error: 'Backend is not configured.' };
    }
    if (!roomId) {
      return { success: false, reminders: [], error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('reminders')
        .select('*')
        .eq('room_id', roomId)
        .order('trigger_time', { ascending: true });

      if (error) {
        return { success: false, reminders: [], error: error.message };
      }

      const rows = (data || []) as RawReminderRow[];
      return { success: true, reminders: rows.map(mapRawReminder) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, reminders: [], error: message };
    }
  }

  public async createReminder(
    roomId: string,
    payload: {
      taskId?: string | null;
      eventId?: string | null;
      triggerTime: string;
      offsetMinutes?: number;
    }
  ): Promise<{ success: boolean; reminder?: ReminderDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!roomId) {
      return { success: false, error: 'Valid roomId is required.' };
    }
    if (!payload.taskId && !payload.eventId) {
      return { success: false, error: 'Reminder requires either taskId or eventId.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data: authData } = await client.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        return { success: false, error: 'User is not authenticated.' };
      }

      const nowIso = new Date(this.getNow()).toISOString();
      const insertRow = {
        room_id: roomId,
        task_id: payload.taskId || null,
        event_id: payload.eventId || null,
        trigger_time: payload.triggerTime,
        offset_minutes: payload.offsetMinutes ?? 0,
        status: 'pending',
        created_by: userId,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data, error } = await client.from('reminders').insert(insertRow).select().single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to create reminder.' };
      }

      const created = mapRawReminder(data as RawReminderRow);
      await this.scheduleReminder(created);
      return { success: true, reminder: created };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  public async updateReminder(
    reminderId: string,
    payload: {
      triggerTime?: string;
      offsetMinutes?: number;
      status?: 'pending' | 'delivered' | 'dismissed' | 'cancelled';
    }
  ): Promise<{ success: boolean; reminder?: ReminderDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!reminderId) {
      return { success: false, error: 'Valid reminderId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date(this.getNow()).toISOString(),
      };
      if (payload.triggerTime !== undefined) updateData.trigger_time = payload.triggerTime;
      if (payload.offsetMinutes !== undefined) updateData.offset_minutes = payload.offsetMinutes;
      if (payload.status !== undefined) updateData.status = payload.status;

      const { data, error } = await client
        .from('reminders')
        .update(updateData)
        .eq('id', reminderId)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to update reminder.' };
      }

      const updated = mapRawReminder(data as RawReminderRow);
      if (updated.status === 'pending') {
        await this.scheduleReminder(updated);
      } else {
        this.cancelReminder(reminderId);
      }

      return { success: true, reminder: updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  public async deleteReminder(reminderId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!reminderId) {
      return { success: false, error: 'Valid reminderId is required.' };
    }

    this.cancelReminder(reminderId);

    const client = this.manager.getClient()!;
    try {
      const { error } = await client.from('reminders').delete().eq('id', reminderId);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  public cleanup(): void {
    this.onSignOut();
  }
}

export const defaultReminderService = new ReminderService();
