import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Keyboard,
  Info,
  CheckCircle2,
  Moon,
  Sun,
  Laptop,
  Bell,
  BellOff,
  Database,
  Trash2,
  LogOut,
  Radio,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useSettings } from '../features/settings/SettingsContext';
import { useAuth } from '../features/auth/AuthContext';
import { useRoom } from '../features/rooms/RoomContext';
import { useRealtime } from '../features/realtime/RealtimeContext';
import { useToast } from '../design-system/ToastProvider';
import { Button } from '../design-system/Button';
import { Dialog } from '../design-system/Dialog';
import type { ColorPalette } from '../../preload/types';

export const SettingsRoute: React.FC = () => {
  const { settings, updateSettings, clearCache } = useSettings();
  const { user, status: authStatus, signOut } = useAuth();
  const { activeRoom } = useRoom();
  const { status: realtimeStatus } = useRealtime();
  const { showToast } = useToast();

  const [appVersion, setAppVersion] = useState<string>('0.1.0-dev');
  const [platform, setPlatform] = useState<string>('Windows (Desktop)');
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState<boolean>(false);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  useEffect(() => {
    if (window.kanoDesktop) {
      window.kanoDesktop.getAppVersion().then(setAppVersion).catch(() => {});
      window.kanoDesktop
        .getPlatform()
        .then((p) => setPlatform(p === 'win32' ? 'Windows (win32)' : p))
        .catch(() => {});
    }
  }, []);

  const handleThemeChange = async (theme: 'system' | 'light' | 'dark') => {
    const res = await updateSettings({ theme });
    if (!res.success) {
      showToast(res.error || 'Failed to update theme', { type: 'error' });
    }
  };

  const handlePaletteChange = async (colorPalette: ColorPalette) => {
    const res = await updateSettings({ colorPalette });
    if (!res.success) {
      showToast(res.error || 'Failed to update color palette', { type: 'error' });
    }
  };

  const handleTestNotification = async () => {
    if (!window.kanoDesktop?.notifications) {
      showToast('Notifications bridge unavailable', { type: 'error' });
      return;
    }

    try {
      const res = await window.kanoDesktop.notifications.show({
        title: 'káno̱ Notification Test',
        body: 'Desktop notifications and alert preferences are configured correctly.',
        category: 'system',
      });

      if (res.shown) {
        showToast('Test notification dispatched', { type: 'success' });
      } else {
        showToast(`Notification suppressed: ${res.reason || 'Check settings'}`, { type: 'info' });
      }
    } catch (err) {
      showToast('Failed to trigger notification', { type: 'error' });
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const res = await clearCache();
      if (res.success) {
        showToast('Application cache cleared successfully', { type: 'success' });
      } else {
        showToast(res.error || 'Failed to clear cache', { type: 'error' });
      }
    } catch {
      showToast('Failed to clear cache', { type: 'error' });
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setIsSignOutDialogOpen(false);
      showToast('Signed out successfully', { type: 'info' });
    } catch {
      showToast('Failed to sign out', { type: 'error' });
    } finally {
      setIsSigningOut(false);
    }
  };


  const shortcuts = [
    { key: 'Ctrl + K', action: 'Open Search and Command Palette' },
    { key: 'Ctrl + N', action: 'Create New Note' },
    { key: 'Ctrl + Shift + N', action: 'Create New Task' },
    { key: 'Ctrl + 1', action: 'Navigate to Notes' },
    { key: 'Ctrl + 2', action: 'Navigate to Tasks' },
    { key: 'Ctrl + 3', action: 'Navigate to Board' },
    { key: 'Ctrl + 4', action: 'Navigate to Calendar' },
    { key: 'Ctrl + 5', action: 'Navigate to Activity' },
    { key: 'Ctrl + ,', action: 'Open Settings' },
    { key: 'Escape', action: 'Close dialogs, menus, and palettes' },
  ];

  const getStatusBadge = () => {
    switch (realtimeStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Connected
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {realtimeStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 select-none max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-kano-text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-kano-accent" />
          Workspace & Client Settings
        </h1>
        <p className="text-sm text-kano-text-muted mt-1">
          Customize your appearance, native notifications, realtime synchronization, and local data storage.
        </p>
      </div>

      {/* 1. Appearance & Theme */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 sm:p-6 shadow-subtle space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-kano-border">
          <Sparkles className="w-4 h-4 text-kano-accent" />
          <h3 className="text-base font-semibold text-kano-text-primary">Appearance & Display</h3>
        </div>

        <div className="space-y-5 text-sm">
          <div>
            <label className="font-semibold block text-kano-text-primary mb-2.5">Color Theme</label>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => handleThemeChange('system')}
                className={`flex flex-col items-center gap-2.5 p-3.5 rounded-xl border transition-all text-sm font-medium ${
                  settings.theme === 'system'
                    ? 'border-kano-accent bg-kano-accent-subtle/40 text-kano-accent font-semibold shadow-xs'
                    : 'border-kano-border hover:bg-kano-surface-hover text-kano-text-secondary'
                }`}
              >
                <Laptop className="w-5 h-5" />
                <span>System</span>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex flex-col items-center gap-2.5 p-3.5 rounded-xl border transition-all text-sm font-medium ${
                  settings.theme === 'light'
                    ? 'border-kano-accent bg-kano-accent-subtle/40 text-kano-accent font-semibold shadow-xs'
                    : 'border-kano-border hover:bg-kano-surface-hover text-kano-text-secondary'
                }`}
              >
                <Sun className="w-5 h-5" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex flex-col items-center gap-2.5 p-3.5 rounded-xl border transition-all text-sm font-medium ${
                  settings.theme === 'dark'
                    ? 'border-kano-accent bg-kano-accent-subtle/40 text-kano-accent font-semibold shadow-xs'
                    : 'border-kano-border hover:bg-kano-surface-hover text-kano-text-secondary'
                }`}
              >
                <Moon className="w-5 h-5" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Color Palette Selection */}
          <div className="pt-3 border-t border-kano-border/60">
            <label className="text-sm font-semibold block text-kano-text-primary mb-1">Color Palette</label>
            <p className="text-xs text-kano-text-muted mb-2.5">
              Choose the accent and tonal personality for your workspace.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl">
              {/* Vivid Emerald */}
              <button
                type="button"
                onClick={() => handlePaletteChange('emerald')}
                aria-label="Vivid Emerald Palette"
                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border transition-all text-left ${
                  (settings.colorPalette || 'emerald') === 'emerald'
                    ? 'border-kano-accent ring-2 ring-kano-accent/20 bg-kano-surface-hover/70 shadow-xs'
                    : 'border-kano-border hover:bg-kano-surface-hover/50 bg-kano-surface'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-kano-text-primary">Vivid Emerald</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#10b981] shadow-xs" />
                    <span className="w-4 h-4 rounded-full bg-[#0b0d11] border border-white/20" />
                    <span className="w-4 h-4 rounded-full bg-[#f8fafc] border border-black/10" />
                  </div>
                </div>
                <span className="text-xs text-kano-text-muted">Linear precision graphite & mint</span>
              </button>

              {/* Luxury Taupe S */}
              <button
                type="button"
                onClick={() => handlePaletteChange('luxury-taupe')}
                aria-label="Luxury Taupe S Palette"
                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border transition-all text-left ${
                  settings.colorPalette === 'luxury-taupe'
                    ? 'border-[#EA1F0A] ring-2 ring-[#EA1F0A]/20 bg-kano-surface-hover/70 shadow-xs'
                    : 'border-kano-border hover:bg-kano-surface-hover/50 bg-kano-surface'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-kano-text-primary">Luxury Taupe S</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#EA1F0A] shadow-xs" />
                    <span className="w-4 h-4 rounded-full bg-[#000000] border border-white/20" />
                    <span className="w-4 h-4 rounded-full bg-[#F6F5F1] border border-black/10" />
                  </div>
                </div>
                <span className="text-xs text-kano-text-muted">Editorial crimson, pitch black & alabaster</span>
              </button>

              {/* Bygone */}
              <button
                type="button"
                onClick={() => handlePaletteChange('bygone')}
                aria-label="Bygone Palette"
                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border transition-all text-left ${
                  settings.colorPalette === 'bygone'
                    ? 'border-[#850805] ring-2 ring-[#850805]/20 bg-kano-surface-hover/70 shadow-xs'
                    : 'border-kano-border hover:bg-kano-surface-hover/50 bg-kano-surface'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-kano-text-primary">Bygone</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#850805] shadow-xs" />
                    <span className="w-4 h-4 rounded-full bg-[#402212]" />
                    <span className="w-4 h-4 rounded-full bg-[#FFF99F] border border-black/10" />
                    <span className="w-4 h-4 rounded-full bg-[#84784E]" />
                    <span className="w-4 h-4 rounded-full bg-[#1C241B]" />
                  </div>
                </div>
                <span className="text-xs text-kano-text-muted">Vintage sepia, parchment & burgundy</span>
              </button>

              {/* To-Do App */}
              <button
                type="button"
                onClick={() => handlePaletteChange('todo-app')}
                aria-label="To-Do App Palette"
                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border transition-all text-left ${
                  settings.colorPalette === 'todo-app'
                    ? 'border-[#25B3EC] ring-2 ring-[#25B3EC]/20 bg-kano-surface-hover/70 shadow-xs'
                    : 'border-kano-border hover:bg-kano-surface-hover/50 bg-kano-surface'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-kano-text-primary">To-Do App</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#FFFFFF] border border-black/15 shadow-xs" />
                    <span className="w-4 h-4 rounded-full bg-[#3A4793]" />
                    <span className="w-4 h-4 rounded-full bg-[#25B3EC]" />
                    <span className="w-4 h-4 rounded-full bg-[#9787EE]" />
                    <span className="w-4 h-4 rounded-full bg-[#FFBF3E]" />
                  </div>
                </div>
                <span className="text-xs text-kano-text-muted">Royal indigo, electric cyan & marigold</span>
              </button>

              {/* Studio Spectrum */}
              <button
                type="button"
                onClick={() => handlePaletteChange('spectrum')}
                aria-label="Studio Spectrum Palette"
                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border transition-all text-left ${
                  settings.colorPalette === 'spectrum'
                    ? 'border-[#7FC0FA] ring-2 ring-[#7FC0FA]/20 bg-kano-surface-hover/70 shadow-xs'
                    : 'border-kano-border hover:bg-kano-surface-hover/50 bg-kano-surface'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-kano-text-primary">Studio Spectrum</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#7FC0FA]" />
                    <span className="w-4 h-4 rounded-full bg-[#F0FA73]" />
                    <span className="w-4 h-4 rounded-full bg-[#FA2E23]" />
                  </div>
                </div>
                <span className="text-xs text-kano-text-muted">Creative multi-shade studio palette</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-kano-border/60 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold block text-kano-text-primary">Reduced Motion</span>
              <span className="text-xs text-kano-text-muted">Minimize interface animations and transitions.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-kano-accent" />
            </label>
          </div>
        </div>
      </div>

      {/* 2. Workspace & Navigation */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 shadow-subtle space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-kano-border">
          <Layers className="w-4 h-4 text-kano-accent" />
          <h3 className="text-base font-semibold text-kano-text-primary">Workspace Navigation</h3>
        </div>

        <div className="text-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold block text-kano-text-primary">Collapse Sidebar by Default</span>
              <span className="text-xs text-kano-text-muted">Keep sidebar collapsed on application launch to maximize workspace area.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.sidebarCollapsed}
                onChange={(e) => updateSettings({ sidebarCollapsed: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-kano-accent" />
            </label>
          </div>
        </div>
      </div>

      {/* 3. Native Notifications */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-kano-border">
          <div className="flex items-center gap-2.5">
            {settings.notificationsEnabled ? (
              <Bell className="w-4 h-4 text-kano-accent" />
            ) : (
              <BellOff className="w-4 h-4 text-kano-text-muted" />
            )}
            <h3 className="text-base font-semibold text-kano-text-primary">Windows Desktop Notifications</h3>
          </div>
          <Button variant="secondary" size="sm" onClick={handleTestNotification}>
            Send Test Alert
          </Button>
        </div>

        <div className="text-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold block text-kano-text-primary">Enable Desktop Notifications</span>
              <span className="text-xs text-kano-text-muted">Allow káno̱ to trigger native Windows notifications for reminders and updates.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-kano-accent" />
            </label>
          </div>

          <div
            className={`flex items-center justify-between pt-2 border-t border-kano-border/60 ${
              !settings.notificationsEnabled ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div>
              <span className="font-semibold block text-kano-text-primary">Task Deadline Alerts</span>
              <span className="text-xs text-kano-text-muted">Receive alerts for approaching task deadlines and scheduled milestones.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!settings.notificationsEnabled}
                checked={settings.taskDueAlerts}
                onChange={(e) => updateSettings({ taskDueAlerts: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-kano-accent" />
            </label>
          </div>

          <div
            className={`flex items-center justify-between pt-2 border-t border-kano-border/60 ${
              !settings.notificationsEnabled ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div>
              <span className="font-semibold block text-kano-text-primary">Room Activity Alerts</span>
              <span className="text-xs text-kano-text-muted">Notify when other members join or update documents in shared rooms.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!settings.notificationsEnabled}
                checked={settings.roomActivityAlerts}
                onChange={(e) => updateSettings({ roomActivityAlerts: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-kano-accent" />
            </label>
          </div>
        </div>
      </div>

      {/* 4. Realtime & Backend Infrastructure */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 shadow-subtle space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-kano-border">
          <Radio className="w-4 h-4 text-kano-accent" />
          <h3 className="text-base font-semibold text-kano-text-primary">Realtime Synchronization</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-kano-bg border border-kano-border space-y-1">
            <span className="text-xs text-kano-text-muted uppercase tracking-wider font-semibold block">
              Backend Service
            </span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-kano-text-primary">Supabase PostgreSQL</span>
              {authStatus?.isConfigured ? (
                <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  Configured
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs bg-slate-500/10 text-slate-500 font-semibold">
                  Local / Mock
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-kano-bg border border-kano-border space-y-1">
            <span className="text-xs text-kano-text-muted uppercase tracking-wider font-semibold block">
              Realtime Channel Status
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-kano-text-secondary">
                {activeRoom ? `room:${activeRoom.id.substring(0, 8)}...` : 'Inactive'}
              </span>
              {getStatusBadge()}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Storage & Cache Management */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 shadow-subtle space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-kano-border">
          <Database className="w-4 h-4 text-kano-accent" />
          <h3 className="text-base font-semibold text-kano-text-primary">Storage & Cache</h3>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="font-semibold block text-kano-text-primary">Clear Local Cache</span>
            <span className="text-xs text-kano-text-muted">Purge cached web assets and session buffers to recover disk space.</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClearCache}
            isLoading={isClearingCache}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
            Clear Cache
          </Button>
        </div>
      </div>

      {/* 6. Account & Session */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 shadow-subtle space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-kano-border">
          <LogOut className="w-4 h-4 text-kano-accent" />
          <h3 className="text-base font-semibold text-kano-text-primary">Account & Active Session</h3>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="font-semibold block text-kano-text-primary">
              {user?.displayName || 'Active User'}
            </span>
            <span className="text-xs text-kano-text-muted">{user?.email || 'Authenticated user'}</span>
          </div>
          <Button variant="danger" size="sm" onClick={() => setIsSignOutDialogOpen(true)}>
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* 7. Security Architecture Summary Card */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 shadow-subtle space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-kano-border">
          <Shield className="w-4 h-4 text-emerald-600" />
          <h3 className="text-base font-semibold text-kano-text-primary">Electron Security Posture</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-kano-bg border border-kano-border">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-semibold block text-kano-text-primary">Context Isolation</span>
              <span className="text-xs text-kano-text-muted">Enabled (Preload sandboxed bridge)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-kano-bg border border-kano-border">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-semibold block text-kano-text-primary">Node Integration</span>
              <span className="text-xs text-kano-text-muted">Disabled (Zero raw Node APIs in UI)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-kano-bg border border-kano-border">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-semibold block text-kano-text-primary">Renderer Sandbox</span>
              <span className="text-xs text-kano-text-muted">Active (V8 process sandboxing)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-kano-bg border border-kano-border">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-semibold block text-kano-text-primary">Credential Isolation</span>
              <span className="text-xs text-kano-text-muted">No auth tokens in localStorage</span>
            </div>
          </div>
        </div>
      </div>

      {/* 8. Keyboard Shortcuts Reference */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 shadow-subtle space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-kano-border">
          <Keyboard className="w-4 h-4 text-kano-accent" />
          <h3 className="text-base font-semibold text-kano-text-primary">Keyboard Shortcuts</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded-md hover:bg-kano-surface-hover"
            >
              <span className="text-kano-text-secondary">{sc.action}</span>
              <kbd className="px-2 py-0.5 rounded bg-kano-bg border border-kano-border text-kano-text-primary font-mono text-xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      {/* Brand & Vector Assets */}
      <div className="bg-kano-surface border border-kano-border rounded-xl p-5 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-kano-border">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-kano-accent" />
            <h3 className="text-base font-semibold text-kano-text-primary">Brand & Vector Assets</h3>
          </div>
          <span className="text-xs text-kano-text-muted">Official SVG Assets</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="p-3.5 rounded-lg bg-kano-bg border border-kano-border flex flex-col items-center justify-center gap-2 text-center">
            <img src="/logo-mark.svg" alt="Brand Mark" className="w-10 h-10 object-contain" />
            <span className="font-medium text-kano-text-primary text-xs">Brand Mark</span>
            <span className="text-xs text-kano-text-muted font-mono">logo-mark.svg</span>
          </div>
          <div className="p-3.5 rounded-lg bg-kano-bg border border-kano-border flex flex-col items-center justify-center gap-2 text-center">
            <img src="/logo-full.svg" alt="Full Logotype" className="h-10 w-full object-contain px-2" />
            <span className="font-medium text-kano-text-primary text-xs">Full Logotype</span>
            <span className="text-xs text-kano-text-muted font-mono">logo-full.svg</span>
          </div>
          <div className="p-3.5 rounded-lg bg-kano-bg border border-kano-border flex flex-col items-center justify-center gap-2 text-center">
            <img src="/logo-monochrome.svg" alt="Monochrome Mark" className="w-10 h-10 object-contain" />
            <span className="font-medium text-kano-text-primary text-xs">Monochrome Mark</span>
            <span className="text-xs text-kano-text-muted font-mono">logo-monochrome.svg</span>
          </div>
        </div>
      </div>

      {/* 9. Client Build Info */}
      <div className="p-4 rounded-xl bg-kano-bg border border-kano-border text-sm text-kano-text-muted flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo-mark.svg" alt="káno̱ logo" className="w-5 h-5 object-contain" />
          <span>káno̱ Desktop Client</span>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs">
          <span>Platform: {platform}</span>
          <span>Version: {appVersion}</span>
        </div>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <Dialog
        isOpen={isSignOutDialogOpen}
        onClose={() => setIsSignOutDialogOpen(false)}
        title="Sign Out of káno̱"
        description="Are you sure you want to sign out? Your active session on this device will be terminated."
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSignOutDialogOpen(false)}
              disabled={isSigningOut}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmSignOut}
              isLoading={isSigningOut}
            >
              Sign Out
            </Button>
          </>
        }
      >
        <p className="text-sm text-kano-text-secondary">
          You will need to sign back in with your credentials to access your rooms and documents. Any unsaved edits will be preserved in offline drafts.
        </p>
      </Dialog>
    </div>
  );
};
