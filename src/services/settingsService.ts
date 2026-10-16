import type { AppSettings } from '../preload/types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  sidebarCollapsed: false,
  notificationsEnabled: true,
  taskDueAlerts: true,
  roomActivityAlerts: true,
  reducedMotion: false,
  autoCheckUpdates: true,
  privacyPreviewMode: false,
};

const STORAGE_KEY_SETTINGS = 'kano_web_settings';

export class SettingsService {
  private settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
  private listeners: Set<(settings: AppSettings) => void> = new Set();
  private isLoaded: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  private sanitize(raw: unknown): AppSettings {
    if (typeof raw !== 'object' || raw === null) {
      return { ...DEFAULT_APP_SETTINGS };
    }

    const obj = raw as Record<string, unknown>;
    const theme: AppSettings['theme'] =
      obj.theme === 'light' || obj.theme === 'dark' || obj.theme === 'system'
        ? obj.theme
        : DEFAULT_APP_SETTINGS.theme;

    return {
      theme,
      sidebarCollapsed:
        typeof obj.sidebarCollapsed === 'boolean' ? obj.sidebarCollapsed : DEFAULT_APP_SETTINGS.sidebarCollapsed,
      notificationsEnabled:
        typeof obj.notificationsEnabled === 'boolean'
          ? obj.notificationsEnabled
          : DEFAULT_APP_SETTINGS.notificationsEnabled,
      taskDueAlerts:
        typeof obj.taskDueAlerts === 'boolean' ? obj.taskDueAlerts : DEFAULT_APP_SETTINGS.taskDueAlerts,
      roomActivityAlerts:
        typeof obj.roomActivityAlerts === 'boolean'
          ? obj.roomActivityAlerts
          : DEFAULT_APP_SETTINGS.roomActivityAlerts,
      reducedMotion:
        typeof obj.reducedMotion === 'boolean' ? obj.reducedMotion : DEFAULT_APP_SETTINGS.reducedMotion,
      autoCheckUpdates:
        typeof obj.autoCheckUpdates === 'boolean' ? obj.autoCheckUpdates : DEFAULT_APP_SETTINGS.autoCheckUpdates,
      privacyPreviewMode:
        typeof obj.privacyPreviewMode === 'boolean'
          ? obj.privacyPreviewMode
          : DEFAULT_APP_SETTINGS.privacyPreviewMode,
    };
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      this.settings = { ...DEFAULT_APP_SETTINGS };
      this.isLoaded = true;
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = this.sanitize(parsed);
      } else {
        this.settings = { ...DEFAULT_APP_SETTINGS };
      }
    } catch (err) {
      console.warn('[SettingsService] Failed to load settings from localStorage, using defaults:', err);
      this.settings = { ...DEFAULT_APP_SETTINGS };
    }

    this.isLoaded = true;
  }

  public async getSettings(): Promise<AppSettings> {
    if (!this.isLoaded) {
      this.loadFromStorage();
    }
    return { ...this.settings };
  }

  public async updateSettings(
    patch: Partial<AppSettings>
  ): Promise<{ success: boolean; settings: AppSettings; error?: string }> {
    try {
      const current = await this.getSettings();
      const merged = this.sanitize({ ...current, ...patch });
      this.settings = merged;

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
      }

      for (const listener of this.listeners) {
        try {
          listener({ ...this.settings });
        } catch (err) {
          console.warn('[SettingsService] Error in settings listener:', err);
        }
      }

      return { success: true, settings: { ...this.settings } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, settings: { ...this.settings }, error: msg };
    }
  }

  public async clearCache(): Promise<{ success: boolean; bytesFreed?: number; error?: string }> {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
      return { success: true, bytesFreed: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  public onSettingsChange(callback: (settings: AppSettings) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const defaultSettingsService = new SettingsService();
