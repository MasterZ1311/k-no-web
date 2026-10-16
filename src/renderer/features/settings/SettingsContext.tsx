import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../../../preload/types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  sidebarCollapsed: false,
  notificationsEnabled: true,
  taskDueAlerts: true,
  roomActivityAlerts: true,
  reducedMotion: false,
  autoCheckUpdates: true,
};

interface SettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (patch: Partial<AppSettings>) => Promise<{ success: boolean; error?: string }>;
  clearCache: () => Promise<{ success: boolean; bytesFreed?: number; error?: string }>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Apply theme to DOM
  const applyTheme = useCallback((theme: AppSettings['theme']) => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System theme
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);

  // Apply reduced motion
  const applyReducedMotion = useCallback((reduced: boolean) => {
    if (typeof document === 'undefined') return;
    if (reduced) {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (window.kanoDesktop?.settings) {
      window.kanoDesktop.settings
        .getSettings()
        .then((loaded) => {
          if (isMounted) {
            setSettings(loaded);
            applyTheme(loaded.theme);
            applyReducedMotion(loaded.reducedMotion);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.warn('[SettingsProvider] Failed to load settings:', err);
          if (isMounted) setIsLoading(false);
        });

      const unsubscribe = window.kanoDesktop.settings.onSettingsChange((newSettings) => {
        if (isMounted) {
          setSettings(newSettings);
          applyTheme(newSettings.theme);
          applyReducedMotion(newSettings.reducedMotion);
        }
      });

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } else {
      setIsLoading(false);
    }
  }, [applyTheme, applyReducedMotion]);

  // Listen to system theme changes if theme === 'system'
  useEffect(() => {
    if (settings.theme !== 'system' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings.theme, applyTheme]);

  const updateSettings = async (patch: Partial<AppSettings>): Promise<{ success: boolean; error?: string }> => {
    if (!window.kanoDesktop?.settings) {
      const updated = { ...settings, ...patch };
      setSettings(updated);
      applyTheme(updated.theme);
      applyReducedMotion(updated.reducedMotion);
      return { success: true };
    }

    try {
      const res = await window.kanoDesktop.settings.updateSettings(patch);
      if (res.success && res.settings) {
        setSettings(res.settings);
        applyTheme(res.settings.theme);
        applyReducedMotion(res.settings.reducedMotion);
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to update settings.' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  };

  const clearCache = async (): Promise<{ success: boolean; bytesFreed?: number; error?: string }> => {
    if (!window.kanoDesktop?.settings) {
      return { success: true, bytesFreed: 0 };
    }

    try {
      return await window.kanoDesktop.settings.clearCache();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  };

  const value: SettingsContextValue = {
    settings,
    isLoading,
    updateSettings,
    clearCache,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
