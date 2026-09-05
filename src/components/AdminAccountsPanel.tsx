import React, { useState } from 'react';
import {
  UserPlus,
  Trash2,
  Pencil,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { AdminAccount, Section, StoredAdminAccount } from '../types';
import { SCHOOL_LABEL } from '../brand';
import { MIN_ADMIN_PASSWORD_LENGTH, describePasswordProblem } from '../utils/adminAuth';

/** What the form is currently doing. */
type Draft = {
  mode: 'create' | 'edit';
  id?: string;
  name: string;
  section: '' | Section;
  /** On an edit, blank leaves the existing password alone. */
  password: string;
  confirm: string;
};

export interface AdminAccountSubmission {
  id?: string;
  name: string;
  section?: Section;
  /** Omitted on an edit that does not change the password. */
  password?: string;
}

interface AdminAccountsPanelProps {
  /** Accounts stored in Firestore, managed here. */
  accounts: StoredAdminAccount[];
  /**
   * Accounts compiled in from `.env.local`. Listed so this tab is the whole
   * truth about who can sign in, but not editable -- they are not in the
   * database, so there is nothing here to change.
   */
  builtInAccounts: AdminAccount[];
  /** Who is signed in, so the panel can flag deleting your own account. */
  currentAdmin: AdminAccount | null;
  /** Resolves to an error message, or `null` when the save succeeded. */
  onSave: (submission: AdminAccountSubmission) => Promise<string | null>;
  onDelete: (account: StoredAdminAccount) => void;
  /** Why the account list could not be read, if it could not be. */
  loadError?: string | null;
}

const inputClass =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 focus:border-brand-kingdom-500 transition';

const labelClass = 'block text-xs font-bold text-slate-700 mb-1';

/** "5 Sep 2026" — a date, not an ISO string. */
function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Managing who can administer the site.
 *
 * Each person gets their own password so the modification history can name
 * them; the panel refuses a shared password or a duplicate name for that
 * reason, and refuses to delete the last account.
 *
 * Passwords are never shown and never stored -- Firestore holds a salted hash
 * (src/utils/adminAuth.ts). A forgotten password can only be replaced.
 *
 * Kept deliberately sparse. An earlier version explained the security model in
 * three paragraphs on screen; that belongs in README.md, and burying the two
 * buttons someone came here to press underneath it made the tab harder to use,
 * not safer.
 */
export const AdminAccountsPanel: React.FC<AdminAccountsPanelProps> = ({
  accounts,
  builtInAccounts,
  currentAdmin,
  onSave,
  onDelete,
  loadError
}) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const open = (next: Draft) => {
    setFormError('');
    setShowPassword(false);
    setDraft(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || isSaving) return;

    const name = draft.name.trim();
    if (!name) {
      setFormError('A name is required — it is what the history shows.');
      return;
    }

    // On an edit a blank password means "leave it alone"; on a create there is
    // nothing to leave alone, so one is required.
    const changingPassword = draft.mode === 'create' || draft.password.length > 0;
    if (changingPassword) {
      const problem = describePasswordProblem(draft.password);
      if (problem) {
        setFormError(problem);
        return;
      }
      if (draft.password !== draft.confirm) {
        setFormError('The two passwords do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const error = await onSave({
        id: draft.id,
        name,
        section: draft.section || undefined,
        password: changingPassword ? draft.password : undefined
      });
      if (error) setFormError(error);
      else setDraft(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-base font-bold text-slate-900">Administrators</h3>
        <button
          type="button"
          onClick={() =>
            open({ mode: 'create', name: '', section: '', password: '', confirm: '' })
          }
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white rounded-lg text-sm font-bold transition shrink-0"
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          Add administrator
        </button>
      </div>

      {loadError && (
        <p
          role="alert"
          className="text-xs text-slate-800 bg-brand-coral-50 border border-brand-coral-300 rounded-lg p-2.5 flex gap-2 items-start"
        >
          <AlertTriangle
            className="w-4 h-4 text-brand-coral-700 shrink-0 mt-px"
            aria-hidden="true"
          />
          <span>{loadError}</span>
        </p>
      )}

      {/* --- accounts stored in the database ---------------------------- */}
      {accounts.length > 0 && (
        <ul className="space-y-2">
          {accounts.map(account => (
            <li
              key={account.id}
              className="border border-slate-200 rounded-xl px-3 py-2.5 flex flex-wrap gap-3 items-center justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <ShieldCheck
                    className="w-4 h-4 text-brand-kingdom-700 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="break-words">{account.name}</span>
                  {currentAdmin?.id === account.id && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-brand-green-100 text-brand-green-900 border border-brand-green-400">
                      You
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {account.section ? SCHOOL_LABEL[account.section] : 'Both schools'} · password
                  set {formatDate(account.passwordChangedAt)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    open({
                      mode: 'edit',
                      id: account.id,
                      name: account.name,
                      section: account.section || '',
                      password: '',
                      confirm: ''
                    })
                  }
                  aria-label={`Edit ${account.name}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(account)}
                  disabled={accounts.length === 1}
                  title={
                    accounts.length === 1
                      ? 'Add another administrator before removing this one'
                      : `Remove ${account.name}`
                  }
                  aria-label={`Remove ${account.name}`}
                  className="inline-flex items-center justify-center p-1.5 text-slate-700 hover:text-brand-coral-800 hover:bg-brand-coral-50 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-700"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {accounts.length === 0 && !loadError && (
        <p className="text-sm text-slate-600 border border-dashed border-slate-300 rounded-xl py-6 text-center">
          No administrators added yet.
        </p>
      )}

      {/* --- add / edit form -------------------------------------------- */}
      {draft && (
        <form
          onSubmit={e => {
            void submit(e);
          }}
          className="border-t-2 border-brand-kingdom-700 pt-3 space-y-3"
        >
          <h4 className="text-sm font-bold text-brand-kingdom-800">
            {draft.mode === 'create' ? 'New administrator' : `Edit ${draft.name || 'account'}`}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="admin-account-name">
                Name *
              </label>
              <input
                id="admin-account-name"
                className={inputClass}
                value={draft.name}
                maxLength={120}
                placeholder="e.g. Mr Khalid"
                autoFocus
                onChange={e => setDraft({ ...draft, name: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="admin-account-section">
                School
              </label>
              <select
                id="admin-account-section"
                className={`${inputClass} cursor-pointer`}
                value={draft.section}
                onChange={e => setDraft({ ...draft, section: e.target.value as '' | Section })}
              >
                <option value="">Both schools</option>
                <option value="boys">{SCHOOL_LABEL.boys}</option>
                <option value="girls">{SCHOOL_LABEL.girls}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <label className={labelClass} htmlFor="admin-account-password">
                {draft.mode === 'create' ? 'Password *' : 'New password'}
              </label>
              <input
                id="admin-account-password"
                type={showPassword ? 'text' : 'password'}
                className={`${inputClass} pr-10`}
                value={draft.password}
                autoComplete="new-password"
                placeholder={
                  draft.mode === 'edit'
                    ? 'Leave blank to keep the current one'
                    : `At least ${MIN_ADMIN_PASSWORD_LENGTH} characters`
                }
                onChange={e => setDraft({ ...draft, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-[1.85rem] p-1.5 text-slate-500 hover:text-slate-900 rounded transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div>
              <label className={labelClass} htmlFor="admin-account-confirm">
                Confirm password
              </label>
              <input
                id="admin-account-confirm"
                type={showPassword ? 'text' : 'password'}
                className={inputClass}
                value={draft.confirm}
                autoComplete="new-password"
                onChange={e => setDraft({ ...draft, confirm: e.target.value })}
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-sm font-semibold text-brand-coral-800">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : draft.mode === 'create' ? 'Create' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {/* --- built-in accounts ------------------------------------------ */}
      {builtInAccounts.length > 0 && (
        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs font-bold text-slate-700">Built in (from .env.local)</p>
          <ul className="mt-1.5 space-y-1">
            {builtInAccounts.map(account => (
              <li key={account.id} className="text-xs text-slate-700 flex items-center gap-2">
                <span className="font-semibold text-slate-900">{account.name}</span>
                <span>· {account.section ? SCHOOL_LABEL[account.section] : 'Both schools'}</span>
                {currentAdmin?.id === account.id && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-brand-green-100 text-brand-green-900 border border-brand-green-400">
                    You
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};
