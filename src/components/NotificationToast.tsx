import React from 'react';
import { CheckCircle2, AlertOctagon, Info, X } from 'lucide-react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  action?: ToastAction;
}

interface NotificationToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

const TONES = {
  success: {
    panel: 'bg-brand-green-950 text-brand-green-50 border-brand-green-500',
    icon: 'text-brand-green-300',
    action: 'bg-brand-green-800 hover:bg-brand-green-700 text-brand-green-50',
    Icon: CheckCircle2
  },
  error: {
    panel: 'bg-brand-coral-950 text-brand-coral-50 border-brand-coral-500',
    icon: 'text-brand-coral-300',
    action: 'bg-brand-coral-800 hover:bg-brand-coral-700 text-brand-coral-50',
    Icon: AlertOctagon
  },
  info: {
    panel: 'bg-slate-900 text-slate-50 border-brand-kingdom-500',
    icon: 'text-brand-kingdom-300',
    action: 'bg-brand-kingdom-700 hover:bg-brand-kingdom-600 text-white',
    Icon: Info
  }
} as const;

export const NotificationToast: React.FC<NotificationToastProps> = ({ toast, onClose }) => {
  const tone = TONES[toast?.type || 'info'];
  const { Icon } = tone;

  return (
    // Always rendered so assistive tech observes the live region rather than
    // an element that appears and disappears.
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] max-w-md w-full px-4 print:hidden pointer-events-none"
    >
      {toast && (
        <div
          className={`p-3.5 rounded-lg border-l-4 shadow-xl flex items-center justify-between gap-3 text-sm font-semibold pointer-events-auto ${tone.panel}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon className={`w-5 h-5 shrink-0 ${tone.icon}`} />
            <span className="leading-snug">{toast.message}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  onClose();
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${tone.action}`}
              >
                {toast.action.label}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss notification"
              className="p-1 hover:bg-white/10 rounded transition"
            >
              <X className="w-4 h-4 opacity-70" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
