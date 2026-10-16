import type { NotificationPayload } from '../preload/types';
import { SettingsService, defaultSettingsService } from './settingsService';

export interface ShowNotificationResult {
  success: boolean;
  shown: boolean;
  reason?: string;
}

export class NotificationService {
  private settingsService: SettingsService;
  private recentNotifications: Map<string, number> = new Map();
  private dedupWindowMs: number = 60_000;
  private clickListeners: Set<(payload: { roomId?: string; route?: string }) => void> = new Set();

  constructor(settingsService: SettingsService = defaultSettingsService) {
    this.settingsService = settingsService;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    return Notification.requestPermission();
  }

  private sanitizeText(text: string): string {
    return text.replace(/(eyJ[a-zA-Z0-9_-]{10,})/g, '[REDACTED_TOKEN]');
  }

  public async show(payload: NotificationPayload): Promise<ShowNotificationResult> {
    const settings = await this.settingsService.getSettings();

    // Check user preference toggles
    if (!settings.notificationsEnabled) {
      return { success: true, shown: false, reason: 'Notifications disabled by user preferences' };
    }
    if (payload.category === 'task_due' && !settings.taskDueAlerts) {
      return { success: true, shown: false, reason: 'Task deadline alerts disabled by user preferences' };
    }
    if (payload.category === 'activity' && !settings.roomActivityAlerts) {
      return { success: true, shown: false, reason: 'Room activity alerts disabled by user preferences' };
    }

    // Deduplication check
    const dedupKey = payload.id || `${payload.title}:${payload.body}`;
    const now = Date.now();
    const lastDispatched = this.recentNotifications.get(dedupKey);

    if (lastDispatched && now - lastDispatched < this.dedupWindowMs) {
      return { success: true, shown: false, reason: 'Duplicate notification suppressed within dedup window' };
    }
    this.recentNotifications.set(dedupKey, now);

    // Prune stale cache entries
    for (const [key, timestamp] of this.recentNotifications.entries()) {
      if (now - timestamp > this.dedupWindowMs * 2) {
        this.recentNotifications.delete(key);
      }
    }

    if (!this.isSupported()) {
      return { success: true, shown: false, reason: 'Web Notifications API not supported in this browser' };
    }

    try {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (Notification.permission !== 'granted') {
        return { success: true, shown: false, reason: 'Notification permission not granted' };
      }

      const sanitizedTitle = this.sanitizeText(payload.title);
      const sanitizedBody = this.sanitizeText(payload.body);

      const notification = new Notification(sanitizedTitle, {
        body: sanitizedBody,
        icon: '/icon.png',
        silent: Boolean(payload.silent),
      });

      notification.onclick = () => {
        window.focus();
        const clickData = { roomId: payload.roomId, route: payload.route };
        for (const listener of this.clickListeners) {
          try {
            listener(clickData);
          } catch (err) {
            console.warn('[NotificationService] Error in click listener:', err);
          }
        }
      };

      return { success: true, shown: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, shown: false, reason: msg };
    }
  }

  public onNotificationClick(callback: (payload: { roomId?: string; route?: string }) => void): () => void {
    this.clickListeners.add(callback);
    return () => {
      this.clickListeners.delete(callback);
    };
  }
}

export const defaultNotificationService = new NotificationService();
