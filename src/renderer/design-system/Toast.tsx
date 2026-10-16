import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
}

export interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const icons = {
    info: <Info className="w-4 h-4 text-kano-accent" />,
    success: <CheckCircle2 className="w-4 h-4 text-kano-success" />,
    warning: <AlertTriangle className="w-4 h-4 text-kano-warning" />,
    error: <AlertCircle className="w-4 h-4 text-kano-danger" />,
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 p-3.5 bg-kano-surface border border-kano-border rounded-lg shadow-popup max-w-sm w-full select-none transition-all"
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-kano-text-primary">{toast.title}</h4>
        {toast.description && (
          <p className="text-xs text-kano-text-secondary mt-0.5 break-words">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="text-kano-text-muted hover:text-kano-text-primary rounded p-1 -m-1 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
