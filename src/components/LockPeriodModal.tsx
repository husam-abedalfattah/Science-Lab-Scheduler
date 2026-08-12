import React, { useState } from 'react';
import { X, Lock, Unlock, Calendar, Clock, AlertOctagon, CheckCircle2, ShieldAlert, Sparkles, Trash2, Save } from 'lucide-react';
import { Day, SectionData, BlockedPeriod } from '../types';
import { DAYS_LIST, PERIODS_LIST } from '../data/initialData';

interface LockPeriodModalProps {
  isOpen: boolean;
  sectionData: SectionData;
  initialDay?: Day;
  initialPeriod?: number;
  onClose: () => void;
  onSaveLock: (day: Day, period: number, lockObj: BlockedPeriod | null) => Promise<void>;
}

const COMMON_REASONS = [
  'Covering class session',
  'Busy preparing lab practical & chemicals',
  'Laboratory maintenance & equipment check',
  'Assisting out-of-lab science exam',
  'Chemical inventory & stocktaking'
];

export const LockPeriodModal: React.FC<LockPeriodModalProps> = ({
  isOpen,
  sectionData,
  initialDay = 'sunday',
  initialPeriod = 1,
  onClose,
  onSaveLock,
}) => {
  const [selectedDay, setSelectedDay] = useState<Day>(initialDay);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(initialPeriod);

  const currentKey = `${selectedDay}_p${selectedPeriod}`;
  const existingLock: BlockedPeriod | undefined = sectionData.blockedPeriods?.[currentKey];

  const [reason, setReason] = useState<string>(existingLock?.reason || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync when day or period changes
  const handleSelectSlot = (day: Day, period: number) => {
    setSelectedDay(day);
    setSelectedPeriod(period);
    const key = `${day}_p${period}`;
    const lockObj = sectionData.blockedPeriods?.[key];
    setReason(lockObj?.reason || '');
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSaving(true);
    try {
      const lockObj: BlockedPeriod = {
        day: selectedDay,
        period: selectedPeriod,
        reason: reason.trim(),
        blockedBy: 'Lab Technician',
        createdAt: new Date().toISOString()
      };
      await onSaveLock(selectedDay, selectedPeriod, lockObj);
    } catch (err) {
      console.error('Failed to lock period:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlock = async () => {
    setIsSaving(true);
    try {
      await onSaveLock(selectedDay, selectedPeriod, null);
      setReason('');
    } catch (err) {
      console.error('Failed to unlock period:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalLockedCount = Object.keys(sectionData.blockedPeriods || {}).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-900 my-8">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span>Lab Technician Period Locking & Blocking</span>
                {totalLockedCount > 0 && (
                  <span className="bg-rose-100 text-rose-800 text-xs px-2 py-0.5 rounded-full font-bold">
                    {totalLockedCount} Locked
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Lock any period to prevent bookings and leave a reason for teachers (e.g. covering a class, busy with setup).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg p-1.5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WEEKLY QUICK SELECTOR MATRIX */}
        <div className="my-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
          <div className="flex justify-between items-center mb-2.5">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-rose-600" />
              <span>Weekly Timetable Matrix Selector</span>
            </span>
            <span className="text-[10.5px] text-slate-500">
              Click a period below to lock or unlock
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {DAYS_LIST.map((d) => (
              <div key={d.id} className="space-y-1">
                <div className="text-center font-bold text-[10px] uppercase text-slate-600 bg-slate-200/60 py-1 rounded">
                  {d.label.slice(0, 3)}
                </div>
                <div className="space-y-1">
                  {PERIODS_LIST.map((p) => {
                    const key = `${d.id}_p${p}`;
                    const lockObj = sectionData.blockedPeriods?.[key];
                    const isSelected = selectedDay === d.id && selectedPeriod === p;
                    const isLocked = Boolean(lockObj);

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleSelectSlot(d.id, p)}
                        className={`w-full py-1 px-1 rounded text-[10px] font-bold flex items-center justify-between transition cursor-pointer border ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                            : isLocked
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={
                          isLocked
                            ? `P${p} Locked: ${lockObj?.reason}`
                            : `Period ${p}`
                        }
                      >
                        <span>P{p}</span>
                        {isLocked ? (
                          <Lock className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* EDITOR FORM FOR SELECTED PERIOD */}
        <form onSubmit={handleSave} className="space-y-4 pt-2 border-t border-slate-200">
          
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-700 shrink-0" />
              <div>
                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block">Selected Period</span>
                <span className="font-extrabold text-rose-950 text-sm capitalize">
                  {selectedDay} • Period {selectedPeriod}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-md text-xs font-extrabold flex items-center gap-1 ${
                existingLock ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}>
                {existingLock ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>LOCKED / BLOCKED</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>OPEN / AVAILABLE</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
              <span>Reason for Locking Period {selectedPeriod} (Visible to Teachers):</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Covering class 10B / Busy with optics setup / Lab maintenance"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-rose-600"
              required={!existingLock}
            />

            {/* Common Presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10.5px] font-semibold text-slate-500 block">Quick Reasons:</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REASONS.map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReason(r)}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-900 text-slate-700 border border-slate-200 text-[10.5px] font-medium transition cursor-pointer"
                  >
                    "{r}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            {existingLock ? (
              <button
                type="button"
                onClick={handleUnlock}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Unlock className="w-4 h-4 text-emerald-600" />
                <span>Unlock Period {selectedPeriod}</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || !reason.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : `Lock ${selectedDay.toUpperCase()} Period ${selectedPeriod}`}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
