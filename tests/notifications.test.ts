import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../src/services/notificationService';
import { SettingsService } from '../src/services/settingsService';

describe('NotificationService (Web)', () => {
  let settingsService: SettingsService;
  let notificationService: NotificationService;
  let mockNotificationInstances: any[] = [];

  beforeEach(() => {
    localStorage.clear();
    mockNotificationInstances = [];

    // Mock HTML5 Notification API on window
    class MockWebNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn().mockResolvedValue('granted');

      public title: string;
      public options: any;
      public onclick: any = null;

      constructor(title: string, options: any) {
        this.title = title;
        this.options = options;
        mockNotificationInstances.push(this);
      }
    }

    (window as any).Notification = MockWebNotification;

    settingsService = new SettingsService();
    notificationService = new NotificationService(settingsService);
  });

  it('checks if Web Notifications are supported', () => {
    expect(notificationService.isSupported()).toBe(true);
  });

  it('shows notification when enabled and permitted', async () => {
    const res = await notificationService.show({
      title: 'Task Due',
      body: 'Complete the migration',
      category: 'task_due',
    });

    expect(res.success).toBe(true);
    expect(res.shown).toBe(true);
    expect(mockNotificationInstances.length).toBe(1);
    expect(mockNotificationInstances[0].title).toBe('Task Due');
    expect(mockNotificationInstances[0].options.body).toBe('Complete the migration');
  });

  it('suppresses notification when user disabled notifications in settings', async () => {
    await settingsService.updateSettings({ notificationsEnabled: false });

    const res = await notificationService.show({
      title: 'Task Due',
      body: 'Complete the migration',
    });

    expect(res.success).toBe(true);
    expect(res.shown).toBe(false);
    expect(res.reason).toContain('disabled');
    expect(mockNotificationInstances.length).toBe(0);
  });

  it('deduplicates identical notifications dispatched within window', async () => {
    const p1 = await notificationService.show({
      id: 'task-123',
      title: 'Task Due',
      body: 'Complete work',
    });
    expect(p1.shown).toBe(true);

    const p2 = await notificationService.show({
      id: 'task-123',
      title: 'Task Due',
      body: 'Complete work',
    });
    expect(p2.shown).toBe(false);
    expect(p2.reason).toContain('Duplicate');
    expect(mockNotificationInstances.length).toBe(1);
  });

  it('triggers click listeners when notification is clicked', async () => {
    let clickedPayload: any = null;
    notificationService.onNotificationClick((payload) => {
      clickedPayload = payload;
    });

    await notificationService.show({
      title: 'Review Note',
      body: 'Click to open',
      roomId: 'room-1',
      route: '/notes',
    });

    expect(mockNotificationInstances.length).toBe(1);
    mockNotificationInstances[0].onclick();

    expect(clickedPayload).toEqual({
      roomId: 'room-1',
      route: '/notes',
    });
  });
});
