import React, { useMemo, useState } from 'react';
import {
  X,
  History,
  Search,
  SearchX,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  CalendarX,
  UserPlus,
  UserCog,
  UserMinus
} from 'lucide-react';
import { AuditAction, AuditEntry, Section } from '../types';
import { SCHOOL_LABEL } from '../brand';
import { useModalA11y } from '../hooks/useModalA11y';

interface AuditLogModalProps {
  isOpen: boolean;
  /** The school being browsed, or `null` to show both. */
  section: Section | null;
  entries: AuditEntry[];
  onClose: () => void;
  /** Why the history could not be read, if it could not be. */
  loadError?: string | null;
}

/**
 * How each action reads in the list. Past tense, because every row is
 * something that already happened.
 */
const ACTION_LABEL: Record<AuditAction, string> = {
  material_created: 'added',
  material_updated: 'edited',
  material_deleted: 'deleted',
  material_imported: 'imported',
  material_exported: 'exported',
  reservation_cancelled: 'cancelled booking',
  admin_created: 'added administrator',
  admin_updated: 'changed administrator',
  admin_deleted: 'removed administrator'
};

const ACTION_ICON: Record<AuditAction, React.ComponentType<{ className?: string }>> = {
  material_created: Plus,
  material_updated: Pencil,
  material_deleted: Trash2,
  material_imported: Upload,
  material_exported: Download,
  reservation_cancelled: CalendarX,
  admin_created: UserPlus,
  admin_updated: UserCog,
  admin_deleted: UserMinus
};

/**
 * Destructive actions are tinted so a page of routine edits does not hide the
 * one deletion on it. Coral is the brand's only warning colour.
 */
const ACTION_TONE: Record<AuditAction, string> = {
  material_created: 'bg-brand-green-100 text-brand-green-900 border-brand-green-400',
  material_updated: 'bg-brand-aqua-100 text-brand-aqua-950 border-brand-aqua-400',
  material_deleted: 'bg-brand-coral-100 text-brand-coral-900 border-brand-coral-400',
  material_imported: 'bg-brand-violet-100 text-brand-violet-950 border-brand-violet-400',
  material_exported: 'bg-slate-100 text-slate-800 border-slate-300',
  reservation_cancelled: 'bg-brand-coral-100 text-brand-coral-900 border-brand-coral-400',
  // Who may administer the site is the most consequential thing in this log,
  // so all three stand out rather than only the removal.
  admin_created: 'bg-brand-plum-100 text-brand-plum-950 border-brand-plum-400',
  admin_updated: 'bg-brand-plum-100 text-brand-plum-950 border-brand-plum-400',
  admin_deleted: 'bg-brand-coral-100 text-brand-coral-900 border-brand-coral-400'
};

/** "5 Sep 2026, 09:14" -- the school reads dates, not ISO strings. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** An empty side of a diff reads as an em dash, not as nothing at all. */
const orDash = (v: string) => (v && v.trim() !== '' ? v : '—');

/**
 * The modification history.
 *
 * Administrator-only. It names individuals and what they did, which is
 * management information rather than something the whole staff room needs.
 *
 * The gate is the app's, not the database's: `firestore.rules` allows any
 * signed-in client to read `audits`, because anonymous auth cannot tell an
 * administrator from a teacher. So this hides the log from ordinary use; it
 * does not make it secret.
 *
 * Newest first, and capped upstream at MAX_AUDIT_ENTRIES -- see
 * `subscribeToAudits`. Filtering is client-side over that window.
 */
export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  section,
  entries,
  onClose,
  loadError
}) => {
  const panelRef = useModalA11y(isOpen, onClose);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | AuditAction>('ALL');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => {
      // An entry with no section is app-wide and shows in every view.
      if (section && e.section && e.section !== section) return false;
      if (actionFilter !== 'ALL' && e.action !== actionFilter) return false;
      if (!q) return true;
      return [e.actorName, e.targetName, e.detail, ACTION_LABEL[e.action]].some(f =>
        f?.toLowerCase().includes(q)
      );
    });
  }, [entries, section, query, actionFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[92vh] flex flex-col text-slate-900"
      >
        <div className="flex justify-between items-start pb-4 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-kingdom-700 text-white rounded-xl shrink-0">
              <History className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="audit-title" className="text-lg font-bold text-slate-900">
                Modification history
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {section ? SCHOOL_LABEL[section] : 'Both schools'} · newest first
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 py-3 border-b border-slate-200">
          <div className="relative flex-grow min-w-[12rem]">
            <label htmlFor="audit-search" className="sr-only">
              Search the history
            </label>
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              id="audit-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by person or item…"
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 transition"
            />
          </div>

          <label htmlFor="audit-action" className="sr-only">
            Filter by action
          </label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as 'ALL' | AuditAction)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 transition"
          >
            <option value="ALL">All actions</option>
            {(Object.keys(ACTION_LABEL) as AuditAction[]).map(a => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-grow overflow-y-auto pt-3 pr-1">
          {loadError ? (
            <div
              role="alert"
              className="text-center py-12 bg-brand-coral-50 rounded-xl border border-brand-coral-300 p-6"
            >
              <AlertTriangle
                className="w-10 h-10 text-brand-coral-700 mx-auto mb-3"
                aria-hidden="true"
              />
              <h3 className="text-base font-bold text-slate-900">
                The history could not be loaded
              </h3>
              <p className="text-sm text-slate-700 mt-1 max-w-lg mx-auto">{loadError}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <SearchX className="w-10 h-10 mx-auto mb-3 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800">
                {entries.length === 0 ? 'Nothing has been changed yet.' : 'No matching changes.'}
              </p>
              {entries.length > 0 && (
                <p className="text-xs mt-1">Try a different search or filter.</p>
              )}
            </div>
          ) : (
            <ol className="space-y-2">
              {visible.map(e => {
                const Icon = ACTION_ICON[e.action];
                return (
                  <li
                    key={e.id}
                    className="border border-slate-200 rounded-xl p-3 flex gap-3 items-start"
                  >
                    <span
                      className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center ${ACTION_TONE[e.action]}`}
                      aria-hidden="true"
                    >
                      <Icon className="w-4 h-4" />
                    </span>

                    <div className="min-w-0 flex-grow">
                      <p className="text-sm text-slate-900">
                        <span className="font-bold">{e.actorName}</span>{' '}
                        <span className="text-slate-700">{ACTION_LABEL[e.action]}</span>{' '}
                        <span className="font-semibold break-words">{e.targetName}</span>
                      </p>

                      {e.detail && (
                        <p className="text-xs text-slate-700 mt-0.5 break-words">{e.detail}</p>
                      )}

                      {e.changes && e.changes.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {e.changes.map((c, i) => (
                            <li key={`${c.field}-${i}`} className="text-xs text-slate-700">
                              <span className="font-semibold text-slate-900">{c.field}</span>{' '}
                              <span className="text-slate-500">{orDash(c.from)}</span>
                              <span className="mx-1" aria-label="changed to">
                                →
                              </span>
                              <span className="text-slate-900">{orDash(c.to)}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="text-[11px] text-slate-500 mt-1">
                        {formatWhen(e.at)}
                        {e.section && ` · ${SCHOOL_LABEL[e.section]}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

      </div>
    </div>
  );
};
