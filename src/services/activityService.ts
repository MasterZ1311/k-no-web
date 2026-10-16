import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type { ActivityLogDTO } from '../preload/types';

export interface RawActivityLogRow {
  id: string;
  room_id: string;
  actor_id: string | null;
  entity_type: ActivityLogDTO['entityType'];
  entity_id: string;
  action: ActivityLogDTO['action'];
  details: Record<string, unknown>;
  created_at: string;
  profiles?: {
    display_name: string | null;
    email: string | null;
  } | null;
}

export function mapRawActivityLog(row: RawActivityLogRow): ActivityLogDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    actorId: row.actor_id,
    actorName: row.profiles?.display_name || undefined,
    actorEmail: row.profiles?.email || undefined,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    details: row.details || {},
    createdAt: row.created_at,
  };
}

export class ActivityService {
  constructor(private supabaseManager: SupabaseManager = defaultSupabaseManager) {}

  async getActivityLogs(
    roomId: string,
    limit = 50,
    offset = 0
  ): Promise<{ success: boolean; logs: ActivityLogDTO[]; error?: string }> {
    if (!this.supabaseManager.isConfigured()) {
      return { success: false, logs: [], error: 'Backend is not configured.' };
    }
    if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
      return { success: false, logs: [], error: 'Valid roomId is required.' };
    }

    const client = this.supabaseManager.getClient();
    if (!client) {
      return { success: false, logs: [], error: 'Not authenticated' };
    }

    try {
      const { data, error } = await client
        .from('activity_logs')
        .select(`
          id,
          room_id,
          actor_id,
          entity_type,
          entity_id,
          action,
          details,
          created_at,
          profiles:actor_id (
            display_name,
            email
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return { success: false, logs: [], error: error.message };
      }

      const logs = ((data || []) as unknown as RawActivityLogRow[]).map(mapRawActivityLog);
      return { success: true, logs };
    } catch (err: any) {
      return { success: false, logs: [], error: err.message || 'Failed to fetch activity logs' };
    }
  }

  async logAction(
    roomId: string,
    entityType: string,
    entityId: string,
    action: string,
    details: Record<string, unknown> = {}
  ): Promise<{ success: boolean; logId?: string; error?: string }> {
    if (!this.supabaseManager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
      return { success: false, error: 'Valid roomId is required.' };
    }

    const client = this.supabaseManager.getClient();
    if (!client) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error } = await client.rpc('log_room_activity', {
        p_room_id: roomId,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_action: action,
        p_details: details,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, logId: data as string };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to log room activity' };
    }
  }
}

export const defaultActivityService = new ActivityService();
