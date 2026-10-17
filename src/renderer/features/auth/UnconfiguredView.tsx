import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, KeyRound, ArrowRight, CheckCircle2, Globe } from 'lucide-react';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { useAuth } from './AuthContext';
import { defaultSupabaseManager } from '../../../services/supabaseClient';

export const UnconfiguredView: React.FC = () => {
  const { refreshStatus, isLoading } = useAuth();
  const [urlInput, setUrlInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);

    try {
      const res = defaultSupabaseManager.setCustomConfig(urlInput, keyInput);
      if (!res.success) {
        setSaveError(res.error || 'Invalid configuration');
        setIsSaving(false);
        return;
      }
      await refreshStatus();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-screen flex items-center justify-center bg-kano-bg p-4 sm:p-6 overflow-y-auto text-kano-text-primary">
      <div className="max-w-lg w-full my-auto bg-kano-surface border border-kano-border rounded-xl shadow-modal p-5 sm:p-8 space-y-6">
        <div className="flex justify-center pb-1">
          <img
            src="/logo-full.svg"
            alt="káno̱ logo"
            className="h-9 object-contain"
          />
        </div>
        <div className="flex items-center gap-3 text-amber-500">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-kano-text-primary">
              Connect káno̱ Web
            </h1>
            <p className="text-xs text-kano-text-muted">
              Connect to your Supabase backend to synchronize data in real-time.
            </p>
          </div>
        </div>

        <form onSubmit={handleManualConnect} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-kano-text-secondary mb-1">
                Supabase Project URL
              </label>
              <Input
                type="url"
                placeholder="https://xyzcompany.supabase.co or http://127.0.0.1:54321"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-kano-text-secondary mb-1">
                Supabase Public Anon Key
              </label>
              <Input
                type="password"
                placeholder="Enter your Supabase public anon key"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                required
              />
            </div>
          </div>

          {saveError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isSaving || !urlInput.trim() || !keyInput.trim()}
            className="w-full flex items-center justify-center gap-2"
          >
            <span>{isSaving ? 'Connecting...' : 'Connect Workspace'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        <div className="border-t border-kano-border pt-4 text-xs text-kano-text-secondary space-y-2">
          <p className="text-kano-text-muted">
            Alternatively, define these environment variables in your <code className="px-1 py-0.5 rounded bg-kano-surface-hover font-mono text-[11px]">.env.local</code> file or in Vercel Project Settings:
          </p>
          <div className="bg-kano-bg p-3 rounded-lg border border-kano-border font-mono text-[11px] space-y-1 text-kano-text-primary">
            <div>VITE_SUPABASE_URL=https://...</div>
            <div>VITE_SUPABASE_ANON_KEY=eyJ...</div>
          </div>
        </div>

        <div className="border-t border-kano-border pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-kano-text-muted">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Encrypted local storage fallback active</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={refreshStatus}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Check Again</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
