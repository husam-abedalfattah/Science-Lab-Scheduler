import React, { useEffect, useMemo, useState } from 'react';
import { X, Lock, Unlock, Calendar, AlertOctagon } from 'lucide-react';
import { Day, SectionData } from '../types';
import { DAYS_LIST, PERIODS_LIST } from '../data/initialData';
import { useModalA11y } from '../hooks/useModalA11y';

export interface LockSlot {
  day: Day;
  period: number;
}

interface LockPeriodModalProps {
  isOpen: boolean;
  sectionData: SectionData;
  initialDay?: Day;
  initialPeriod?: number;
  onClose: () => void;
  /** `reason === null` unblocks every slot passed in. One write, not one per slot. */
  onSaveLocks: (slots: LockSlot[], reason: string | null) => Promise<void>;
}

const COMMON_REASONS = [
  'Covering a class session',
  'Preparing lab practical and chemicals',
  'Laboratory maintenance and equipment check',
  'Assisting an out-of-lab science exam',
  'Chemical inventory and stocktaking'
];

const keyOf = (day: Day, period: number) => `${day}_p${period}`;
const parseKey = (k: string): LockSlot => {
  const [day, p] = k.split('_p');
  return { day: day as Day, period: Number(p) };
};

/**
 * Blocking periods, several at a time.
 *
 * The technician's real unit of unavailability is rarely one period -- it is a
 * morning, a whole day of maintenance, or "period 4 every day this week for
 * exams". Locking those one cell at a time meant seven interactions and seven
 * writes for one fact, so in practice only the most urgent block got recorded.
 *
 * The selector is a period × day matrix rather than the previous day-columns,
 * because that shape gives both bulk gestures for free: the row header selects
 * one period across the week, the column header selects a whole day.
 */
export const LockPeriodModal: React.FC<LockPeriodModalProps> = ({
  isOpen,
  sectionData,
  initialDay = 'sunday',
  initialPeriod = 1,
  onClose,
  onSaveLocks
}) => {
  const panelRef = useModalA11y(isOpen, onClose);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const blocked = sectionData.blockedPeriods || {};

  /**
   * Opening from a grid cell preselects that cell. These were plain useState
   * initialisers once, which React evaluates only on mount -- and because the
   * modal stays mounted (the isOpen guard runs after the hooks), every open
   * landed on Sunday period 1 regardless of which slot was clicked.
   */
  useEffect(() => {
    if (!isOpen) return;
    const k = keyOf(initialDay, initialPeriod);
    setSelected(new Set([k]));
    setReason(sectionData.blockedPeriods?.[k]?.reason || '');
    setIsSaving(false);
    // sectionData is deliberately excluded: re-running on every Firestore
    // snapshot would discard what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialDay, initialPeriod]);

  const toggle = (day: Day, period: number) => {
    const k = keyOf(day, period);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  /** Select the whole group unless it is already fully selected, then clear it. */
  const toggleGroup = (keys: string[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allOn = keys.every(k => next.has(k));
      keys.forEach(k => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const selectedKeys = useMemo(() => [...selected], [selected]);
  const selectedSlots = useMemo(() => selectedKeys.map(parseKey), [selectedKeys]);
  const lockedInSelection = selectedKeys.filter(k => blocked[k]);
  const unlockedInSelection = selectedKeys.filter(k => !blocked[k]);

  if (!isOpen) return null;

  const run = async (nextReason: string | null, slots: LockSlot[]) => {
    if (isSaving || slots.length === 0) return;
    setIsSaving(true);
    try {
      await onSaveLocks(slots, nextReason);
      if (nextReason === null) setReason('');
    } catch (err) {
      console.error('Failed to update period locks:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    void run(reason.trim(), selectedSlots);
  };

  const totalLockedCount = Object.keys(blocked).length;
  const count = selectedKeys.length;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-modal-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-900 my-8"
      >
        <div className="flex justify-between items-start pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-coral-700 text-white rounded-xl shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="lock-modal-title"
                className="text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap"
              >
                <span>Block periods</span>
                {totalLockedCount > 0 && (
                  <span className="bg-brand-coral-100 text-brand-coral-900 text-xs px-2 py-0.5 rounded-full font-bold">
                    {totalLockedCount} blocked
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Pick any number of periods, then give one reason for all of them. Teachers see the
                reason when they try to book.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close period blocking"
            className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center mb-2.5 gap-2 flex-wrap">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide text-xs">
              <Calendar className="w-3.5 h-3.5 text-brand-coral-600" aria-hidden="true" />
              <span>Weekly timetable</span>
            </span>
            <span className="text-xs text-slate-600">
              Tap cells, or a day / period heading to take the whole line
            </span>
          </div>

          <table className="w-full border-separate border-spacing-1">
            <caption className="sr-only">
              Select periods to block. Column headings select a whole day; row headings select that
              period across the week.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-10">
                  <span className="sr-only">Period</span>
                </th>
                {DAYS_LIST.map(d => {
                  const keys = PERIODS_LIST.map(p => keyOf(d.id, p));
                  const allOn = keys.every(k => selected.has(k));
                  return (
                    <th key={d.id} scope="col">
                      <button
                        type="button"
                        onClick={() => toggleGroup(keys)}
                        aria-pressed={allOn}
                        title={`Select all of ${d.short}`}
                        className={`w-full min-h-6 py-1 rounded text-xs font-bold uppercase transition border ${
                          allOn
                            ? 'bg-brand-coral-700 text-white border-brand-coral-700'
                            : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {d.short}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PERIODS_LIST.map(p => {
                const rowKeys = DAYS_LIST.map(d => keyOf(d.id, p));
                const rowOn = rowKeys.every(k => selected.has(k));
                return (
                  <tr key={p}>
                    <th scope="row">
                      <button
                        type="button"
                        onClick={() => toggleGroup(rowKeys)}
                        aria-pressed={rowOn}
                        title={`Select period ${p} on every day`}
                        className={`w-full min-h-6 py-1 rounded text-xs font-bold transition border ${
                          rowOn
                            ? 'bg-brand-coral-700 text-white border-brand-coral-700'
                            : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        P{p}
                      </button>
                    </th>
                    {DAYS_LIST.map(d => {
                      const k = keyOf(d.id, p);
                      const lock = blocked[k];
                      const isSelected = selected.has(k);
                      return (
                        <td key={d.id}>
                          <button
                            type="button"
                            onClick={() => toggle(d.id, p)}
                            aria-pressed={isSelected}
                            aria-label={`${d.short} period ${p}${
                              lock ? `, blocked: ${lock.reason}` : ', open'
                            }`}
                            title={lock ? `Blocked: ${lock.reason}` : 'Open'}
                            className={`w-full min-h-6 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition border ${
                              isSelected
                                ? 'bg-brand-coral-700 text-white border-brand-coral-800'
                                : lock
                                  ? 'bg-brand-coral-100 text-brand-coral-900 border-brand-coral-300'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {lock ? (
                              <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                            ) : (
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isSelected ? 'bg-white/70' : 'bg-slate-300'
                                }`}
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-between gap-2 flex-wrap mt-2.5">
            <p className="text-xs text-slate-700" aria-live="polite">
              {count === 0 ? (
                'Nothing selected.'
              ) : (
                <>
                  <strong className="text-slate-900">{count}</strong> period
                  {count === 1 ? '' : 's'} selected
                  {lockedInSelection.length > 0 && (
                    <> · {lockedInSelection.length} already blocked</>
                  )}
                </>
              )}
            </p>
            {count > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleBlock} className="space-y-4 pt-2 border-t border-slate-200">
          <div className="space-y-2">
            <label
              htmlFor="lock-reason"
              className="text-sm font-bold text-slate-800 flex items-center gap-1"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-brand-coral-600" aria-hidden="true" />
              <span>Reason (teachers will see this)</span>
            </label>
            <input
              id="lock-reason"
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Covering class 10B, optics setup, lab maintenance"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-coral-500 focus:border-brand-coral-500 focus:bg-white transition"
            />

            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-slate-700 block">Quick reasons</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REASONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-brand-coral-50 hover:text-brand-coral-900 text-slate-700 border border-slate-300 text-xs font-medium transition"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            {lockedInSelection.length > 0 ? (
              <button
                type="button"
                onClick={() => void run(null, lockedInSelection.map(parseKey))}
                disabled={isSaving}
                className="px-4 py-2 bg-brand-green-50 hover:bg-brand-green-100 text-brand-green-900 border border-brand-green-400 rounded-xl text-sm font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Unlock className="w-4 h-4 text-brand-green-700" aria-hidden="true" />
                <span>
                  Unblock {lockedInSelection.length} period
                  {lockedInSelection.length === 1 ? '' : 's'}
                </span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || !reason.trim() || count === 0}
                className="px-5 py-2 bg-brand-coral-700 hover:bg-brand-coral-800 text-white font-bold rounded-xl text-sm transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isSaving
                    ? 'Saving…'
                    : count === 0
                      ? 'Select a period'
                      : unlockedInSelection.length === 0
                        ? `Update ${count} reason${count === 1 ? '' : 's'}`
                        : `Block ${count} period${count === 1 ? '' : 's'}`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
