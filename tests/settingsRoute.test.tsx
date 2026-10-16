import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsRoute } from '../src/renderer/routes/SettingsRoute';
import { SettingsProvider } from '../src/renderer/features/settings/SettingsContext';
import { AuthProvider } from '../src/renderer/features/auth/AuthContext';
import { RoomProvider } from '../src/renderer/features/rooms/RoomContext';
import { RealtimeProvider } from '../src/renderer/features/realtime/RealtimeContext';
import { ToastProvider } from '../src/renderer/design-system/ToastProvider';
import { mockDefaultUser } from './setup';

describe('SettingsRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSettings = () => {
    return render(
      <ToastProvider>
        <SettingsProvider>
          <AuthProvider initialStatus={{ isConfigured: true, user: mockDefaultUser }}>
            <RoomProvider>
              <RealtimeProvider>
                <SettingsRoute />
              </RealtimeProvider>
            </RoomProvider>
          </AuthProvider>
        </SettingsProvider>
      </ToastProvider>
    );
  };

  it('renders all key settings sections', async () => {
    renderSettings();

    expect(await screen.findByText('Workspace & Client Settings')).toBeInTheDocument();
    expect(screen.getByText('Appearance & Display')).toBeInTheDocument();
    expect(screen.getByText('Workspace Navigation')).toBeInTheDocument();
    expect(screen.getByText('Windows Desktop Notifications')).toBeInTheDocument();
    expect(screen.getByText('Realtime Synchronization')).toBeInTheDocument();
    expect(screen.getByText('Storage & Cache')).toBeInTheDocument();
    expect(screen.getByText('Account & Active Session')).toBeInTheDocument();
  });

  it('allows switching color theme', async () => {
    const updateSettingsSpy = vi.fn().mockResolvedValue({
      success: true,
      settings: {
        theme: 'dark',
        sidebarCollapsed: false,
        notificationsEnabled: true,
        taskDueAlerts: true,
        roomActivityAlerts: true,
        reducedMotion: false,
        autoCheckUpdates: true,
      },
    });

    window.kanoDesktop.settings.updateSettings = updateSettingsSpy;

    renderSettings();

    const darkThemeButton = await screen.findByRole('button', { name: /dark/i });
    fireEvent.click(darkThemeButton);

    await waitFor(() => {
      expect(updateSettingsSpy).toHaveBeenCalledWith({ theme: 'dark' });
    });
  });

  it('dispatches a test desktop notification', async () => {
    const showNotificationSpy = vi.fn().mockResolvedValue({ success: true, shown: true });
    window.kanoDesktop.notifications.show = showNotificationSpy;

    renderSettings();

    const testButton = await screen.findByRole('button', { name: /send test alert/i });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(showNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'káno̱ Notification Test',
          category: 'system',
        })
      );
    });
  });

  it('triggers local cache clearing', async () => {
    const clearCacheSpy = vi.fn().mockResolvedValue({ success: true, bytesFreed: 1048576 });
    window.kanoDesktop.settings.clearCache = clearCacheSpy;

    renderSettings();

    const clearButton = await screen.findByRole('button', { name: /clear cache/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(clearCacheSpy).toHaveBeenCalled();
    });
  });

  it('opens sign-out confirmation dialog and handles cancel and confirm', async () => {
    const signOutSpy = vi.fn().mockResolvedValue({ success: true });
    window.kanoDesktop.auth.signOut = signOutSpy;

    renderSettings();

    const signOutBtn = await screen.findByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    // Confirmation dialog should appear
    expect(screen.getByText('Sign Out of káno̱')).toBeInTheDocument();

    // Test Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Sign Out of káno̱')).not.toBeInTheDocument();
      expect(signOutSpy).not.toHaveBeenCalled();
    });

    // Open again and confirm
    fireEvent.click(signOutBtn);
    expect(screen.getByText('Sign Out of káno̱')).toBeInTheDocument();

    const confirmSignOutBtn = screen.getAllByRole('button', { name: /sign out/i })[1];
    fireEvent.click(confirmSignOutBtn);

    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalled();
    });
  });
});
