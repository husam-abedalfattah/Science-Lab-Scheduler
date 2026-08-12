import React from 'react';
import { CheckCircle2, AlertOctagon, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface NotificationToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toast, onClose }) => {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 print:hidden">
      <div 
        className={`p-3.5 rounded border-l-4 shadow-xl flex items-center justify-between gap-3 text-xs font-mono font-bold ${
          isError 
            ? 'bg-rose-950 text-rose-100 border-rose-500' 
            : 'bg-emerald-950 text-emerald-100 border-emerald-500'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isError ? (
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>

        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition">
          <X className="w-4 h-4 opacity-70 hover:opacity-100" />
        </button>
      </div>
    </div>
  );
};
