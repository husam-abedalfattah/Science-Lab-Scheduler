import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, X } from 'lucide-react';
import { AdminAccount } from '../types';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * What the caller wanted to do, and what to do once they have proved they may.
 *
 * Held by the app rather than by the button that raised it, so a single
 * password prompt serves every gated action -- deleting a material, cancelling
 * a booking, opening the importer -- instead of each growing its own copy of
 * this form.
 */
export interface AdminUnlockRequest {
  /** What is being unlocked, in the imperative: "Delete this material". */
  title: string;
  /** Why it is gated, in one sentence. */
  message: string;
  /** Runs once the password matches a known account. */
  onGranted: (admin: AdminAccount) => void;
}

interface AdminUnlockModalProps {
  request: AdminUnlockRequest | null;
  /**
   * Returns the account the password identifies, or `null` if none does.
   *
   * Async because verifying against a stored account runs PBKDF2, which is
   * deliberately slow -- a few hundred milliseconds per account. The form
   * disables itself while it waits rather than looking unresponsive.
   */
  onAuthenticate: (password: string) => Promise<AdminAccount | null>;
  onClose: () => void;
}

/**
 * The administrator password prompt.
 *
 * Raised at the moment of the action, not once at the door. Someone reading
 * the stockroom should not have to sign in to read it, and someone deleting a
 * chemical should have to think about that specific chemical -- the prompt
 * names what it is about to do.
 *
 * The password is also the identity. Each person trusted with the stockroom
 * has their own (see ADMIN_ACCOUNTS in src/constants.ts), so the one that
 * unlocks the session is what the modification history records as the actor.
 * That makes a wrong password worth distinguishing from an unknown one -- it
 * is not, and cannot be: an unrecognised string simply matches nobody.
 *
 * It is a convenience gate and an accountability record, never a security
 * boundary; the password ships in the bundle. See firestore.rules.
 */
export const AdminUnlockModal: React.FC<AdminUnlockModalProps> = ({
  request,
  onAuthenticate,
  onClose
}) => {
  const panelRef = useModalA11y(!!request, onClose);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // Cleared on open rather than on close, so a password never lingers in state
  // behind a closed dialog and the next prompt always starts empty.
  useEffect(() => {
    if (request) {
      setPassword('');
      setShowPassword(false);
      setError('');
      setIsChecking(false);
    }
  }, [request]);

  if (!request) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChecking) return;

    // Captured before the awaits below: `request` is about to be cleared, and
    // reading `request.onGranted` afterwards would race the state update.
    const granted = request.onGranted;

    setIsChecking(true);
    try {
      const account = await onAuthenticate(password);
      if (!account) {
        setError('That password does not match any administrator.');
        return;
      }
      setPassword('');
      onClose();
      granted(account);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-unlock-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-900"
      >
        <div className="flex justify-end -mt-2 -mr-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={e => {
            void submit(e);
          }}
          className="space-y-4 text-center"
        >
          <div className="w-14 h-14 bg-brand-kingdom-700 text-white rounded-2xl mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>

          <div>
            <h2 id="admin-unlock-title" className="text-base font-bold text-slate-900">
              {request.title}
            </h2>
            <p className="text-sm text-slate-600 mt-1">{request.message}</p>
          </div>

          <div className="text-left relative">
            <label htmlFor="admin-unlock-password" className="sr-only">
              Your administrator password
            </label>
            <input
              id="admin-unlock-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Your admin password"
              required
              autoFocus
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'admin-unlock-error' : undefined}
              className={`w-full bg-white border rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 text-center placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 transition ${
                error ? 'border-brand-coral-600' : 'border-slate-300'
              }`}
            />
            {/* A mistyped password on a shared lab machine is the common case. */}
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-900 rounded transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p
              id="admin-unlock-error"
              role="alert"
              className="text-sm font-semibold text-brand-coral-800"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isChecking}
            className="w-full py-2.5 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white font-bold text-sm rounded-xl transition disabled:opacity-60"
          >
            {isChecking ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
};
