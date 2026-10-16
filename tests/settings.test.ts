import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsService, DEFAULT_APP_SETTINGS } from '../src/services/settingsService';

describe('SettingsService (Web)', () => {
  let service: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    service = new SettingsService();
  });

  it('loads default settings when localStorage is empty', async () => {
    const settings = await service.getSettings();

    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(settings.theme).toBe('system');
    expect(settings.notificationsEnabled).toBe(true);
    expect(settings.taskDueAlerts).toBe(true);
    expect(settings.roomActivityAlerts).toBe(true);
  });

  it('updates settings and persists to localStorage', async () => {
    const res = await service.updateSettings({
      theme: 'dark',
      sidebarCollapsed: true,
      notificationsEnabled: false,
    });

    expect(res.success).toBe(true);
    expect(res.settings.theme).toBe('dark');
    expect(res.settings.sidebarCollapsed).toBe(true);
    expect(res.settings.notificationsEnabled).toBe(false);

    // Verify persistence in a new instance
    const freshService = new SettingsService();
    const retrieved = await freshService.getSettings();
    expect(retrieved.theme).toBe('dark');
    expect(retrieved.sidebarCollapsed).toBe(true);
    expect(retrieved.notificationsEnabled).toBe(false);
  });

  it('notifies listeners when settings change', async () => {
    let notifiedSettings: any = null;
    const unsubscribe = service.onSettingsChange((s) => {
      notifiedSettings = s;
    });

    await service.updateSettings({ theme: 'light' });
    expect(notifiedSettings).not.toBeNull();
    expect(notifiedSettings?.theme).toBe('light');

    unsubscribe();
    notifiedSettings = null;
    await service.updateSettings({ theme: 'dark' });
    expect(notifiedSettings).toBeNull();
  });

  it('sanitizes invalid or malicious inputs gracefully', async () => {
    const res = await service.updateSettings({
      theme: 'invalid-theme' as any,
    });

    expect(res.success).toBe(true);
    expect(res.settings.theme).toBe('system');
  });

  it('clears caches cleanly without throwing', async () => {
    const res = await service.clearCache();
    expect(res.success).toBe(true);
  });
});
