import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type { CalendarEventDTO } from '../preload/types';

interface RawCalendarEventRow {
  id: string;
  room_id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapRawCalendarEvent(row: RawCalendarEventRow): CalendarEventDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    taskId: row.task_id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    isAllDay: row.is_all_day,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CalendarService {
  private manager: SupabaseManager;

  constructor(manager: SupabaseManager = defaultSupabaseManager) {
    this.manager = manager;
  }

  public async getEvents(
    roomId: string,
    startRange?: string,
    endRange?: string
  ): Promise<{ success: boolean; events: CalendarEventDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, events: [], error: 'Backend is not configured.' };
    }
    if (!roomId || typeof roomId !== 'string') {
      return { success: false, events: [], error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      let query = client
        .from('calendar_events')
        .select('*')
        .eq('room_id', roomId);

      if (startRange) {
        query = query.gte('end_time', startRange);
      }
      if (endRange) {
        query = query.lte('start_time', endRange);
      }

      const { data, error } = await query.order('start_time', { ascending: true });

      if (error) {
        return { success: false, events: [], error: error.message };
      }

      return {
        success: true,
        events: (data as RawCalendarEventRow[]).map(mapRawCalendarEvent),
      };
    } catch (err) {
      return {
        success: false,
        events: [],
        error: err instanceof Error ? err.message : 'Failed to retrieve calendar events.',
      };
    }
  }

  public async createEvent(
    roomId: string,
    payload: {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      isAllDay?: boolean;
      taskId?: string | null;
    }
  ): Promise<{ success: boolean; event?: CalendarEventDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!roomId) {
      return { success: false, error: 'Valid roomId is required.' };
    }
    if (!payload.title || !payload.title.trim()) {
      return { success: false, error: 'Event title cannot be empty.' };
    }
    if (!payload.startTime || !payload.endTime) {
      return { success: false, error: 'Start time and end time are required.' };
    }

    const start = new Date(payload.startTime);
    const end = new Date(payload.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { success: false, error: 'Invalid date/time format.' };
    }
    if (end < start) {
      return { success: false, error: 'End time cannot be earlier than start time.' };
    }

    const client = this.manager.getClient()!;
    try {
      const insertData = {
        room_id: roomId,
        title: payload.title.trim(),
        description: payload.description ? payload.description.trim() : null,
        start_time: payload.startTime,
        end_time: payload.endTime,
        is_all_day: Boolean(payload.isAllDay),
        task_id: payload.taskId || null,
      };

      const { data, error } = await client
        .from('calendar_events')
        .insert(insertData)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to create calendar event.' };
      }

      return {
        success: true,
        event: mapRawCalendarEvent(data as RawCalendarEventRow),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create calendar event.',
      };
    }
  }

  public async updateEvent(
    eventId: string,
    payload: {
      title?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
      isAllDay?: boolean;
      taskId?: string | null;
    }
  ): Promise<{ success: boolean; event?: CalendarEventDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!eventId) {
      return { success: false, error: 'Valid eventId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const updateData: Record<string, unknown> = {};

      if (payload.title !== undefined) {
        if (!payload.title.trim()) {
          return { success: false, error: 'Event title cannot be empty.' };
        }
        updateData.title = payload.title.trim();
      }
      if (payload.description !== undefined) {
        updateData.description = payload.description ? payload.description.trim() : null;
      }
      if (payload.startTime !== undefined) {
        updateData.start_time = payload.startTime;
      }
      if (payload.endTime !== undefined) {
        updateData.end_time = payload.endTime;
      }
      if (payload.isAllDay !== undefined) {
        updateData.is_all_day = payload.isAllDay;
      }
      if (payload.taskId !== undefined) {
        updateData.task_id = payload.taskId;
      }

      // Check dates if both or either updated
      if (payload.startTime || payload.endTime) {
        const { data: existing } = await client
          .from('calendar_events')
          .select('start_time, end_time')
          .eq('id', eventId)
          .single();

        if (existing) {
          const s = new Date(payload.startTime || existing.start_time);
          const e = new Date(payload.endTime || existing.end_time);
          if (e < s) {
            return { success: false, error: 'End time cannot be earlier than start time.' };
          }
        }
      }

      const { data, error } = await client
        .from('calendar_events')
        .update(updateData)
        .eq('id', eventId)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to update calendar event.' };
      }

      return {
        success: true,
        event: mapRawCalendarEvent(data as RawCalendarEventRow),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update calendar event.',
      };
    }
  }

  public async deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!eventId) {
      return { success: false, error: 'Valid eventId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client.from('calendar_events').delete().eq('id', eventId);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete calendar event.',
      };
    }
  }
}

export const defaultCalendarService = new CalendarService(defaultSupabaseManager);
