import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
}

interface ConfirmDialogProps {
  request: ConfirmRequest | null;
  onClose: () => void;
}

/**
 * Single confirmation surface for destructive actions. Cancelling a booking,
 * removing a teacher/class/lab and archiving a week all used to fire on one
 * unguarded click.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ request, onClose }) => {
  const panelRef = useModalA11y(Boolean(request), onClose);

  if (!request) return null;

  const isDanger = request.tone !== 'default';

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`p-2 rounded-lg shrink-0 ${
                isDanger ? 'bg-brand-coral-100 text-brand-coral-800' : 'bg-brand-kingdom-100 text-brand-kingdom-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h2 id="confirm-title" className="text-base font-bold text-slate-900">
                {request.title}
              </h2>
              <p id="confirm-message" className="text-sm text-slate-600 mt-1 leading-relaxed">
                {request.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-600 hover:text-slate-700 bg-slate-100 rounded-lg p-1.5 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition ${
              isDanger ? 'bg-brand-coral-700 hover:bg-brand-coral-800' : 'bg-brand-kingdom-600 hover:bg-brand-kingdom-700'
            }`}
          >
            {request.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
