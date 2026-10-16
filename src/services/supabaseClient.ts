import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface BackendConfig {
  url: string | null;
  isConfigured: boolean;
}

export const STORAGE_KEY_URL = 'kano_web_supabase_url';
export const STORAGE_KEY_ANON_KEY = 'kano_web_supabase_anon_key';

export class SupabaseManager {
  private client: SupabaseClient | null = null;
  private configured: boolean = false;
  private url: string | null = null;

  constructor() {
    this.initFromEnvOrStorage();
  }

  public initFromEnvOrStorage(): void {
    let rawUrl = '';
    let rawKey = '';

    // 1. Check browser localStorage
    if (typeof window !== 'undefined') {
      try {
        rawUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
        rawKey = localStorage.getItem(STORAGE_KEY_ANON_KEY) || '';
      } catch {
        // Ignored in SSR or restricted storage environments
      }
    }

    // 2. Fallback to Vite / Vercel Environment Variables
    if (!rawUrl && typeof import.meta !== 'undefined' && import.meta.env) {
      rawUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
    }
    if (!rawKey && typeof import.meta !== 'undefined' && import.meta.env) {
      rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
    }

    if (!rawUrl || !rawKey) {
      this.configured = false;
      this.client = null;
      this.url = null;
      return;
    }

    try {
      const parsedUrl = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        console.warn('[SupabaseManager] Invalid URL protocol:', parsedUrl.protocol);
        this.configured = false;
        return;
      }

      this.url = rawUrl;
      this.client = createClient(rawUrl, rawKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
      this.configured = true;
    } catch (err) {
      console.warn('[SupabaseManager] Failed to initialize Supabase client:', err);
      this.configured = false;
      this.client = null;
    }
  }

  public setCustomConfig(url: string, anonKey: string): { success: boolean; error?: string } {
    try {
      const cleanUrl = url.trim();
      const cleanKey = anonKey.trim();

      if (!cleanUrl || !cleanKey) {
        return { success: false, error: 'URL and Anon Key cannot be empty.' };
      }

      const parsed = new URL(cleanUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { success: false, error: 'URL must start with http:// or https://' };
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
        localStorage.setItem(STORAGE_KEY_ANON_KEY, cleanKey);
      }

      this.url = cleanUrl;
      this.client = createClient(cleanUrl, cleanKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
      this.configured = true;
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  public clearCustomConfig(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_URL);
        localStorage.removeItem(STORAGE_KEY_ANON_KEY);
      } catch {
        // Ignored
      }
    }
    this.initFromEnvOrStorage();
  }

  public setCustomClient(client: SupabaseClient | null, isConfigured = true, url: string | null = null): void {
    this.client = client;
    this.configured = isConfigured;
    this.url = url;
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public isConfigured(): boolean {
    return this.configured && this.client !== null;
  }

  public getConfig(): BackendConfig {
    return {
      url: this.url,
      isConfigured: this.isConfigured(),
    };
  }
}

export const defaultSupabaseManager = new SupabaseManager();
