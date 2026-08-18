import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Lock,
  ShieldCheck,
  Plus,
  Trash2,
  Calendar,
  RotateCcw,
  Layers,
  Users,
  BookOpen,
  BarChart3,
  FlaskConical,
  FileText,
  Search,
  Shield,
  Paperclip,
  LogOut,
  AlertTriangle,
  Package,
  Eye,
  EyeOff,
  Ban,
  Boxes
} from 'lucide-react';
import { Day, Reservation, Section, SectionData } from '../types';
import { DAYS_LIST } from '../data/initialData';
import { MAX_CONCURRENT_LABS_PER_PERIOD, WEEKLY_SLOT_CAPACITY } from '../constants';
import { getEffectiveExperimentDetails, NOT_SPECIFIED } from '../utils/experimentUtils';
import { useModalA11y } from '../hooks/useModalA11y';
import { AdminCharts } from './AdminCharts';
import { SCHOOL_LABEL } from '../brand';

interface AdminModalProps {
  isOpen: boolean;
  isAdminLoggedIn: boolean;
  section: Section;
  sectionData: SectionData;
  onClose: () => void;
  onLogin: (pass: string) => boolean;
  onLogout: () => void;
  onUpdateDeadline: (day: number, time: string) => void;
  onToggleLockSchedule: (isLocked: boolean) => void;
  onOpenNewWeek: () => void;
  onClearSchedule: () => void;
  onSetWeekNumber: (week: number) => void;
  onAddTeacher: (name: string) => void;
  onRemoveTeacher: (index: number) => void;
  onAddClass: (className: string) => void;
  onRemoveClass: (index: number) => void;
  onAddLab: (name: string, code: string) => void;
  onRemoveLab: (id: string) => void;
  /**
   * Clears period blocks. The lab technician sets them (deliberately not
   * admin-gated -- see App.tsx), but only an administrator could previously
   * see the full list, and nobody could clear a stale one without hunting for
   * the cell on the grid.
   */
  onUnblockPeriods: (slots: { day: Day; period: number }[]) => void;
  /** Opens the stockroom, so the inventory is reachable from here too. */
  onOpenMaterials: () => void;
  /**
   * Switches which school the panel edits, without leaving it. Needed because
   * the panel is reachable before a timetable has been chosen, and useful
   * afterwards: one administrator sets up both schools.
   */
  onSelectSection: (section: Section) => void;
}

const inputClass =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 focus:border-brand-kingdom-500 transition';

/** Quotes one CSV field, doubling any embedded quotes. */
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  isAdminLoggedIn,
  section,
  sectionData,
  onClose,
  onLogin,
  onLogout,
  onUpdateDeadline,
  onToggleLockSchedule,
  onOpenNewWeek,
  onClearSchedule,
  onSetWeekNumber,
  onAddTeacher,
  onRemoveTeacher,
  onAddClass,
  onRemoveClass,
  onAddLab,
  onRemoveLab,
  onUnblockPeriods,
  onOpenMaterials,
  onSelectSection
}) => {
  const panelRef = useModalA11y(isOpen, onClose);

  /**
   * Always the brand book's wording, never the string stored on the document.
   *
   * Section documents written before the naming was corrected still hold "Boys
   * Section" / "Girls Section", which the brand book (p.6) rejects, and they
   * surface everywhere the admin panel prints the section name. Deriving the
   * label from the section key makes the wording right without a data
   * migration, and keeps it right if someone edits the document by hand.
   */
  const schoolLabel = SCHOOL_LABEL[section];

  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'stats' | 'log'>('settings');

  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState('ALL');

  /**
   * What the statistics and the materials log count.
   *
   * Defaults to the live week, and that default is the point. Every figure on
   * these two tabs used to pool the active week with every archived week, so
   * "Total bookings", the materials log and the per-teacher tables all kept
   * reporting sessions that had been cleared or archived weeks earlier. An
   * administrator who wiped the week still saw hundreds of bookings and a full
   * materials list, which is the opposite of what the button appeared to do.
   *
   * The archive is still reachable -- it is a toggle, not a deletion -- but it
   * is now something you ask for rather than something you get by surprise.
   */
  const [scope, setScope] = useState<'week' | 'all'>('week');

  const [deadlineDay, setDeadlineDay] = useState(sectionData.deadlineDay);
  const [deadlineTime, setDeadlineTime] = useState(sectionData.deadlineTime);

  const [weekNumberInput, setWeekNumberInput] = useState(String(sectionData.weekNumber));
  const [weekNumberError, setWeekNumberError] = useState('');

  const [newTeacherName, setNewTeacherName] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newLabName, setNewLabName] = useState('');
  const [newLabCode, setNewLabCode] = useState('');

  /**
   * These were plain useState initialisers, so the form captured
   * INITIAL_APP_STATE's defaults at app boot and never picked up the values
   * that actually arrived from Firestore.
   */
  useEffect(() => {
    if (!isOpen) return;
    setDeadlineDay(sectionData.deadlineDay);
    setDeadlineTime(sectionData.deadlineTime);
    setPasswordInput('');
    setShowPassword(false);
    setAuthError('');
  }, [isOpen, sectionData.deadlineDay, sectionData.deadlineTime]);

  // Follow the stored week whenever it changes underneath us -- an archive from
  // another browser would otherwise leave this input showing a stale number.
  useEffect(() => {
    setWeekNumberInput(String(sectionData.weekNumber));
    setWeekNumberError('');
  }, [sectionData.weekNumber, isOpen]);

  /** Bookings in the live week only -- what "clear the schedule" would delete. */
  const currentWeekBookingCount = useMemo(
    () =>
      Object.values(sectionData.reservations || {}).reduce(
        (n, list) => n + (Array.isArray(list) ? list.length : 0),
        0
      ),
    [sectionData.reservations]
  );

  const allCurrentReservations = useMemo(() => {
    const out: Reservation[] = [];
    Object.values(sectionData.reservations).forEach(list => {
      if (Array.isArray(list)) out.push(...list);
    });
    return out;
  }, [sectionData.reservations]);

  const allCombinedReservations = useMemo(() => {
    const historical: Reservation[] = [];
    (sectionData.history || []).forEach(item => {
      Object.values(item.reservations || {}).forEach(list => {
        if (Array.isArray(list)) historical.push(...list);
      });
    });
    return [...allCurrentReservations, ...historical];
  }, [allCurrentReservations, sectionData.history]);

  /** Period blocks, in timetable order rather than object-key order. */
  const blockedList = useMemo(() => {
    const dayIndex = new Map(DAYS_LIST.map((d, i) => [d.id, i]));
    return Object.values(sectionData.blockedPeriods || {})
      .filter(b => b && b.day)
      .sort(
        (a, b) =>
          (dayIndex.get(a.day) ?? 99) - (dayIndex.get(b.day) ?? 99) || a.period - b.period
      );
  }, [sectionData.blockedPeriods]);

  /** The set every figure below is computed from. See `scope`. */
  const scopedReservations =
    scope === 'week' ? allCurrentReservations : allCombinedReservations;

  const archivedCount = allCombinedReservations.length - allCurrentReservations.length;
  const scopeLabel =
    scope === 'week' ? `week ${sectionData.weekNumber}` : 'the active week and every archive';

  const stats = useMemo(() => {
    let techSupport = 0;
    let groups = 0;
    let worksheetCopies = 0;
    let uploadedFiles = 0;
    let missingDetails = 0;
    const safetyItemsFreq: Record<string, number> = {};

    scopedReservations.forEach(r => {
      const exp = getEffectiveExperimentDetails(r);
      if (exp.needsTechSupport) techSupport += 1;
      groups += exp.numberOfGroups;
      worksheetCopies += exp.worksheetCopies || 0;
      if (exp.fileName && exp.fileUrl) uploadedFiles += 1;
      if (!exp.materialsNeeded) missingDetails += 1;
      exp.safetyItems.forEach(item => {
        safetyItemsFreq[item] = (safetyItemsFreq[item] || 0) + 1;
      });
    });

    return {
      total: scopedReservations.length,
      techSupport,
      groups,
      worksheetCopies,
      uploadedFiles,
      missingDetails,
      safetyItemsFreq
    };
  }, [scopedReservations]);

  /**
   * The distinct material lines this scope's bookings actually ask for.
   *
   * Derived from the reservations rather than kept as its own list, which is
   * the whole point: when the week is cleared or archived, the requirement
   * disappears with the bookings that created it instead of lingering as a
   * stale shopping list. This is the *demand* side and has nothing to do with
   * the stockroom inventory, which is a permanent record and is never wiped by
   * a week rolling over.
   *
   * Teachers type their materials as a free-text block, usually numbered. The
   * lines are split, stripped of their numbering and de-duplicated
   * case-insensitively so "1. Beakers 250ml" and "beakers 250ml" are one entry
   * with two requesters rather than two entries with one each.
   */
  const materialsNeeded = useMemo(() => {
    const items = new Map<
      string,
      { label: string; count: number; requests: { teacher: string; when: string }[] }
    >();

    scopedReservations.forEach(r => {
      const exp = getEffectiveExperimentDetails(r);
      if (!exp.materialsNeeded) return;

      exp.materialsNeeded
        .split(/\r?\n/)
        .map(line => line.replace(/^\s*(?:\d+[).:-]?|[-*•])\s*/, '').trim())
        .filter(Boolean)
        .forEach(label => {
          const key = label.toLowerCase();
          const entry = items.get(key) || { label, count: 0, requests: [] };
          entry.count += 1;
          entry.requests.push({ teacher: r.teacher, when: `${r.day} P${r.period}` });
          items.set(key, entry);
        });
    });

    return [...items.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [scopedReservations]);

  /**
   * Distribution stats for the live week only.
   *
   * Deliberately not pooled with the archive the way the totals above are: the
   * question these answer is "where is the pressure in the timetable right
   * now", and averaging last term's shape into it hides exactly that.
   */
  const weekShape = useMemo(() => {
    const byDay = new Map<string, number>(DAYS_LIST.map(d => [d.id, 0]));
    const byPeriod = new Map<number, number>();
    const byLab = new Map<string, number>();
    let reviewed = 0;
    let declined = 0;

    allCurrentReservations.forEach(r => {
      byDay.set(r.day, (byDay.get(r.day) || 0) + 1);
      byPeriod.set(r.period, (byPeriod.get(r.period) || 0) + 1);
      byLab.set(r.labId, (byLab.get(r.labId) || 0) + 1);
      if (r.supervisorReview?.status === 'declined') declined += 1;
      else if (r.supervisorReview?.status === 'acknowledged') reviewed += 1;
    });

    const busiestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const busiestPeriod = [...byPeriod.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      total: allCurrentReservations.length,
      byDay,
      byPeriod,
      byLab,
      reviewed,
      declined,
      pending: allCurrentReservations.length - reviewed - declined,
      busiestDay: busiestDay && busiestDay[1] > 0 ? busiestDay : null,
      busiestPeriod: busiestPeriod && busiestPeriod[1] > 0 ? busiestPeriod : null,
      utilisationPct: Math.min(
        100,
        Math.round((allCurrentReservations.length / WEEKLY_SLOT_CAPACITY) * 100)
      )
    };
  }, [allCurrentReservations]);

  const filteredLog = useMemo(() => {
    const q = logSearchQuery.trim().toLowerCase();
    return scopedReservations.filter(r => {
      if (selectedTeacherFilter !== 'ALL' && r.teacher !== selectedTeacherFilter) return false;
      if (!q) return true;
      const exp = getEffectiveExperimentDetails(r);
      return [
        exp.experimentName,
        exp.materialsNeeded,
        exp.techNotes,
        exp.fileName,
        r.teacher,
        r.className
      ].some(field => field?.toLowerCase().includes(q));
    });
  }, [scopedReservations, logSearchQuery, selectedTeacherFilter]);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onLogin(passwordInput)) {
      setAuthError('');
      setPasswordInput('');
      setShowPassword(false);
    } else {
      setAuthError('Incorrect password.');
    }
  };

  const handleDownloadFile = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'worksheet_file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Built as a Blob rather than a `data:` URI passed through encodeURI, which
   * left `#` unescaped -- a materials list containing one truncated the file
   * at that character. The BOM keeps Excel from mangling non-ASCII names.
   */
  const handleExportCsv = () => {
    const headers = [
      'Teacher',
      'Day',
      'Period',
      'Class',
      'Lab',
      'Experiment',
      'Materials',
      'Groups',
      'Tech support',
      'Worksheet copies',
      'Safety equipment',
      // Whether the lab could actually take the session is the column the
      // technician was reading the sheet for, and it was not in it.
      'Supervisor review',
      'Reason given'
    ];

    const rows = scopedReservations.map(r => {
      const labName = sectionData.labs.find(l => l.id === r.labId)?.name || r.labId;
      const exp = getEffectiveExperimentDetails(r);
      return [
        r.teacher,
        r.day,
        `Period ${r.period}`,
        r.className,
        labName,
        exp.experimentName || NOT_SPECIFIED,
        exp.materialsNeeded || NOT_SPECIFIED,
        exp.numberOfGroups || NOT_SPECIFIED,
        exp.needsTechSupport ? 'Yes' : 'No',
        exp.worksheetCopies,
        exp.safetyItems.join('; '),
        r.supervisorReview?.status === 'declined'
          ? 'Cannot prepare'
          : r.supervisorReview?.status === 'acknowledged'
            ? 'Reviewed'
            : 'Not seen yet',
        r.supervisorReview?.reason || ''
      ]
        .map(csvCell)
        .join(',');
    });

    const csv = '﻿' + [headers.map(csvCell).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // The filename says which scope it holds. A file called
    // "Lab_Statistics_Boys_School.csv" that sometimes covered one week and
    // sometimes the whole term was unreadable a month later.
    const link = document.createElement('a');
    link.href = url;
    link.download =
      `Lab_${scope === 'week' ? `Week_${sectionData.weekNumber}` : 'All_Weeks'}_` +
      `${schoolLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'settings' as const, label: 'Settings', Icon: Layers },
    { id: 'stats' as const, label: 'Usage statistics', Icon: BarChart3 },
    { id: 'log' as const, label: 'Materials log', Icon: FlaskConical }
  ];

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[92vh] overflow-y-auto text-slate-900 font-sans"
      >
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-kingdom-600 text-white shrink-0">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="admin-modal-title" className="text-lg font-bold text-slate-900">
                Lab admin panel
              </h2>
              <p className="text-sm text-slate-600">
                {schoolLabel} · week {sectionData.weekNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Which school is being edited, stated and switchable. Every
                control below writes into it, and getting that wrong is silent
                -- you would only find out when the wrong school's roster
                changed. */}
            {isAdminLoggedIn && (
              <div
                role="group"
                aria-label="School being edited"
                className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5"
              >
                {(['boys', 'girls'] as Section[]).map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onSelectSection(sec)}
                    aria-pressed={section === sec}
                    className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition ${
                      section === sec
                        ? 'bg-brand-kingdom-700 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {SCHOOL_LABEL[sec]}
                  </button>
                ))}
              </div>
            )}

            {isAdminLoggedIn && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close admin panel"
              className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-2 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isAdminLoggedIn ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-sm mx-auto py-8 text-center">
            <div className="w-14 h-14 bg-brand-kingdom-600 text-white rounded-2xl mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Administrator sign-in</h3>
              <p className="text-sm text-slate-600 mt-1">
                Enter the admin password to access scheduling controls.
              </p>
            </div>

            <div className="text-left relative">
              <label htmlFor="admin-password" className="sr-only">
                Admin password
              </label>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (authError) setAuthError('');
                }}
                placeholder="Admin password"
                required
                autoComplete="current-password"
                aria-invalid={authError ? true : undefined}
                aria-describedby={authError ? 'admin-password-error' : undefined}
                className={`${inputClass} text-center pr-10 ${
                  authError ? 'border-brand-coral-600' : ''
                }`}
              />
              {/* A mistyped password on a shared lab machine is the common case,
                  not a shoulder-surfing risk. */}
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-900 rounded transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {authError && (
              <p
                id="admin-password-error"
                role="alert"
                className="text-sm text-brand-coral-700 font-semibold"
              >
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white font-bold text-sm rounded-xl transition"
            >
              Unlock admin panel
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div role="tablist" aria-label="Admin sections" className="flex border-b border-slate-200 gap-1 overflow-x-auto">
              {tabs.map(({ id, label, Icon }, tabIdx) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  // A tablist is one stop in the tab order; the arrow keys move
                  // between the tabs themselves. Without this every tab was its
                  // own stop and Tab walked the header instead of reaching the
                  // panel's controls.
                  tabIndex={activeTab === id ? 0 : -1}
                  onKeyDown={e => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    e.preventDefault();
                    const step = e.key === 'ArrowRight' ? 1 : -1;
                    const next = tabs[(tabIdx + step + tabs.length) % tabs.length];
                    setActiveTab(next.id);
                    const el = e.currentTarget.parentElement?.children[
                      tabs.indexOf(next)
                    ] as HTMLElement | undefined;
                    el?.focus();
                  }}
                  onClick={() => setActiveTab(id)}
                  className={`pb-2.5 px-4 text-sm font-semibold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
                    activeTab === id
                      ? 'border-brand-kingdom-600 text-brand-kingdom-800'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-5">
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 flex-wrap ${
                    sectionData.isLocked
                      ? 'bg-brand-coral-50 border-brand-coral-300'
                      : 'bg-brand-green-50 border-brand-green-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg text-white ${
                        sectionData.isLocked ? 'bg-brand-coral-600' : 'bg-brand-green-700'
                      }`}
                    >
                      <Lock className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {sectionData.isLocked
                          ? 'Bookings locked for teachers'
                          : 'Bookings open for teachers'}
                      </h4>
                      <p className="text-sm text-slate-700 mt-0.5">
                        {sectionData.isLocked
                          ? 'Teachers cannot add bookings. Administrators still can.'
                          : 'Any teacher in this section can book an open slot.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleLockSchedule(!sectionData.isLocked)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition ${
                      sectionData.isLocked
                        ? 'bg-brand-green-700 hover:bg-brand-green-800'
                        : 'bg-brand-coral-700 hover:bg-brand-coral-800'
                    }`}
                  >
                    {sectionData.isLocked ? 'Unlock bookings' : 'Lock bookings'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateDeadline(deadlineDay, deadlineTime);
                    }}
                    className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-brand-kingdom-800 font-bold text-sm">
                      <Calendar className="w-4 h-4" aria-hidden="true" />
                      <span>Weekly booking cutoff</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="deadline-day" className="sr-only">
                          Cutoff day
                        </label>
                        <select
                          id="deadline-day"
                          value={deadlineDay}
                          onChange={(e) => setDeadlineDay(parseInt(e.target.value, 10))}
                          className={inputClass}
                        >
                          {DAYS_LIST.map((d, idx) => (
                            <option key={d.id} value={idx}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="deadline-time" className="sr-only">
                          Cutoff time
                        </label>
                        <input
                          id="deadline-time"
                          type="time"
                          value={deadlineTime}
                          onChange={(e) => setDeadlineTime(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white text-sm font-bold rounded-lg transition"
                    >
                      Save cutoff
                    </button>
                    <p className="text-xs text-brand-yellow-800 bg-brand-yellow-50 border border-brand-yellow-300 rounded-lg px-2.5 py-2 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                      <span>
                        The cutoff is recorded but not yet enforced — teachers can still book after
                        it passes.
                      </span>
                    </p>
                  </form>

                  <div className="bg-brand-kingdom-50/60 p-4 rounded-xl border border-brand-kingdom-300 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-brand-kingdom-900 font-bold text-sm mb-1">
                        <RotateCcw className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
                        <span>Open next week</span>
                      </div>
                      <p className="text-sm text-slate-700">
                        Archives the current week to the history log and clears the grid for week{' '}
                        {sectionData.weekNumber + 1}. Period locks are cleared too.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenNewWeek}
                      className="mt-3 w-full py-2.5 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white text-sm font-bold rounded-lg transition"
                    >
                      Archive and start week {sectionData.weekNumber + 1}
                    </button>
                  </div>
                </div>

                {/* Week number is a plain editable value, not something only
                    "Open next week" may touch. Archiving by mistake, a vacation
                    week, or simply starting the term at week 5 all need it, and
                    without this the only way to move it was to archive again --
                    which files another empty week every time. */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-1">
                    <Calendar className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
                    <span>Current week number</span>
                  </div>
                  <p className="text-sm text-slate-700">
                    Sets what {schoolLabel} is called right now. This only renames the week —
                    bookings, archives, rosters and locks are all left exactly as they are.
                  </p>

                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      const n = Number(weekNumberInput);
                      if (!Number.isInteger(n) || n < 1) {
                        setWeekNumberError('Enter a whole number of 1 or more.');
                        return;
                      }
                      setWeekNumberError('');
                      onSetWeekNumber(n);
                    }}
                    className="mt-3 flex flex-wrap items-end gap-2"
                  >
                    <div className="grow min-w-[8rem]">
                      <label
                        htmlFor="week-number"
                        className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1"
                      >
                        Week
                      </label>
                      <input
                        id="week-number"
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={weekNumberInput}
                        onChange={e => {
                          setWeekNumberInput(e.target.value);
                          if (weekNumberError) setWeekNumberError('');
                        }}
                        aria-invalid={weekNumberError ? true : undefined}
                        aria-describedby={weekNumberError ? 'week-number-error' : undefined}
                        className={`${inputClass} ${
                          weekNumberError ? 'border-brand-coral-600' : ''
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={Number(weekNumberInput) === sectionData.weekNumber}
                      className="py-2 px-4 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Set week
                    </button>
                    {sectionData.weekNumber > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setWeekNumberError('');
                          setWeekNumberInput(String(sectionData.weekNumber - 1));
                          onSetWeekNumber(sectionData.weekNumber - 1);
                        }}
                        className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-sm font-semibold rounded-lg transition"
                        title="Undo an accidental archive by stepping the counter back"
                      >
                        Back to week {sectionData.weekNumber - 1}
                      </button>
                    )}
                  </form>

                  {weekNumberError && (
                    <p
                      id="week-number-error"
                      role="alert"
                      className="mt-1.5 text-xs font-semibold text-brand-coral-800"
                    >
                      {weekNumberError}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-slate-600">
                    Archived by mistake? Stepping the number back does not bring the bookings
                    themselves back — those are in the weekly archives, where they can still be
                    read and printed.
                  </p>
                </div>

                {/* Destructive: kept visually apart from "Open next week" so the
                    two are not confused. Archiving keeps the week; this does
                    not. */}
                <div className="bg-brand-coral-50 p-4 rounded-xl border border-brand-coral-300">
                  <div className="flex items-center gap-2 text-brand-coral-900 font-bold text-sm mb-1">
                    <AlertTriangle className="w-4 h-4 text-brand-coral-700" aria-hidden="true" />
                    <span>Clear the whole schedule</span>
                  </div>
                  <p className="text-sm text-slate-800">
                    Deletes all{' '}
                    <strong className="font-bold">{currentWeekBookingCount}</strong> booking
                    {currentWeekBookingCount === 1 ? '' : 's'} in week {sectionData.weekNumber} for{' '}
                    {schoolLabel} without archiving them. The week number, rosters, labs and
                    period locks are left alone.{' '}
                    <strong className="font-bold">
                      Nothing is saved to the history log and this cannot be undone
                    </strong>{' '}
                    — use “Archive and start week {sectionData.weekNumber + 1}” instead if you want
                    to keep a copy.
                  </p>
                  <button
                    type="button"
                    onClick={onClearSchedule}
                    disabled={currentWeekBookingCount === 0}
                    className="mt-3 w-full py-2.5 bg-brand-coral-700 hover:bg-brand-coral-800 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {currentWeekBookingCount === 0
                      ? 'Nothing to clear'
                      : `Delete all ${currentWeekBookingCount} bookings`}
                  </button>
                </div>

                {/* Period blocks. The technician sets these on the grid; until
                    now there was nowhere to see them all, so a block left on
                    from a maintenance day silently kept a period unbookable
                    with nobody remembering it was there. */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <Ban className="w-4 h-4 text-brand-coral-700" aria-hidden="true" />
                      <span>Blocked periods ({blockedList.length})</span>
                    </div>
                    {blockedList.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onUnblockPeriods(
                            blockedList.map(b => ({ day: b.day, period: b.period }))
                          )
                        }
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition"
                      >
                        Unblock all
                      </button>
                    )}
                  </div>

                  {blockedList.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No periods are blocked. The lab technician blocks them from the schedule
                      grid when the lab cannot be serviced.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {blockedList.map(b => (
                        <div
                          key={`${b.day}_p${b.period}`}
                          className="bg-white border border-slate-300 rounded-lg p-2 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 capitalize">
                              {b.day} · P{b.period}
                            </p>
                            <p className="text-xs text-slate-600 break-words">{b.reason}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUnblockPeriods([{ day: b.day, period: b.period }])}
                            aria-label={`Unblock ${b.day} period ${b.period}`}
                            title="Unblock this period"
                            className="text-slate-500 hover:text-brand-coral-700 p-1 rounded transition shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* The stockroom is open to everyone, but an administrator
                    arriving here to set the week up should not have to go back
                    out to the header to reach it -- and the Excel import now
                    asks for this password anyway. */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-brand-kingdom-700 text-white shrink-0">
                      <Boxes className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900">Stockroom inventory</h4>
                      <p className="text-sm text-slate-700 mt-0.5">
                        Permanent record of what the labs hold, and the Excel import. Not touched
                        by clearing or archiving a week.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenMaterials}
                    className="px-4 py-2 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white text-sm font-bold rounded-lg transition shrink-0"
                  >
                    Open stockroom
                  </button>
                </div>

                {/* Labs */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <Layers className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
                      <span>Labs ({sectionData.labs.length})</span>
                    </div>
                    <span className="text-xs text-brand-kingdom-800 bg-brand-kingdom-50 border border-brand-kingdom-300 px-2 py-0.5 rounded-full font-semibold">
                      Up to {MAX_CONCURRENT_LABS_PER_PERIOD} concurrent bookings per period
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {sectionData.labs.map(lab => (
                      <div
                        key={lab.id}
                        className="bg-white border border-slate-300 rounded-lg p-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{lab.name}</p>
                          <p className="text-xs text-brand-kingdom-700 font-semibold">{lab.code}</p>
                        </div>
                        {sectionData.labs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onRemoveLab(lab.id)}
                            aria-label={`Remove ${lab.name}`}
                            className="text-slate-500 hover:text-brand-coral-700 p-1 rounded transition shrink-0"
                            title="Remove lab"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newLabName.trim()) return;
                      onAddLab(
                        newLabName.trim(),
                        newLabCode.trim() || `LAB-0${sectionData.labs.length + 1}`
                      );
                      setNewLabName('');
                      setNewLabCode('');
                    }}
                    className="flex gap-2 pt-2"
                  >
                    <label htmlFor="new-lab-name" className="sr-only">
                      New lab name
                    </label>
                    <input
                      id="new-lab-name"
                      type="text"
                      value={newLabName}
                      onChange={(e) => setNewLabName(e.target.value)}
                      placeholder="Lab name"
                      className={inputClass}
                    />
                    <label htmlFor="new-lab-code" className="sr-only">
                      New lab code
                    </label>
                    <input
                      id="new-lab-code"
                      type="text"
                      value={newLabCode}
                      onChange={(e) => setNewLabCode(e.target.value)}
                      placeholder="Code"
                      className={`${inputClass} max-w-32`}
                    />
                    <button
                      type="submit"
                      aria-label="Add lab"
                      className="px-4 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white font-bold rounded-lg flex items-center justify-center transition shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Teachers & classes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RosterCard
                    title="Teachers"
                    Icon={Users}
                    items={sectionData.teachers}
                    inputId="new-teacher"
                    placeholder="New teacher name"
                    value={newTeacherName}
                    onValueChange={setNewTeacherName}
                    onAdd={() => {
                      if (newTeacherName.trim()) {
                        onAddTeacher(newTeacherName.trim());
                        setNewTeacherName('');
                      }
                    }}
                    onRemove={onRemoveTeacher}
                  />

                  <RosterCard
                    title="Classes"
                    Icon={BookOpen}
                    items={sectionData.classes}
                    itemPrefix="Class "
                    inputId="new-class"
                    placeholder="New class, e.g. 5C"
                    value={newClassName}
                    onValueChange={setNewClassName}
                    onAdd={() => {
                      if (newClassName.trim()) {
                        onAddClass(newClassName.trim());
                        setNewClassName('');
                      }
                    }}
                    onRemove={onRemoveClass}
                  />
                </div>
              </div>
            )}

            {/* STATS */}
            {activeTab === 'stats' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-brand-kingdom-50/70 p-3.5 rounded-xl border border-brand-kingdom-300">
                  <div>
                    <h3 className="text-sm font-bold text-brand-kingdom-950 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
                      <span>Usage statistics</span>
                    </h3>
                    <p className="text-sm text-slate-700 mt-0.5">
                      Counting {scopeLabel} for {schoolLabel}.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <ScopeToggle
                      scope={scope}
                      onChange={setScope}
                      weekNumber={sectionData.weekNumber}
                      archivedCount={archivedCount}
                    />
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="px-3.5 py-2 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white font-semibold text-sm rounded-xl flex items-center gap-1.5 transition shrink-0"
                    >
                      <FileText className="w-4 h-4" aria-hidden="true" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard
                    label="Total bookings"
                    value={stats.total}
                    tone="kingdom"
                    hint={scope === 'week' ? `Week ${sectionData.weekNumber} only` : 'Active and archived'}
                  />
                  <StatCard label="Tech support requested" value={stats.techSupport} tone="aqua" hint="Technician attendance" />
                  <StatCard label="Student groups" value={stats.groups} tone="green" hint="Across these sessions" />
                  <StatCard label="Worksheet copies" value={stats.worksheetCopies} tone="yellow" hint="Printing requested" />
                  <StatCard label="Attachments" value={stats.uploadedFiles} tone="aqua" hint="Files uploaded" />
                  {/* Replaces a card that duplicated "Total bookings" exactly. */}
                  <StatCard
                    label="Missing prep details"
                    value={stats.missingDetails}
                    tone="coral"
                    hint="No materials listed"
                  />
                </div>

                {/* --- This week ------------------------------------------ */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-4">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
                      <span>Week {sectionData.weekNumber} at a glance</span>
                    </h4>
                    <span className="text-xs text-slate-700">
                      {weekShape.total} of {WEEKLY_SLOT_CAPACITY} slots ·{' '}
                      <strong className="text-slate-900">{weekShape.utilisationPct}%</strong> of
                      technician capacity
                    </span>
                  </div>

                  {weekShape.total === 0 ? (
                    <p className="text-sm text-slate-600">Nothing booked this week yet.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <MiniStat
                          label="Busiest day"
                          value={
                            weekShape.busiestDay
                              ? DAYS_LIST.find(d => d.id === weekShape.busiestDay![0])?.short ||
                                weekShape.busiestDay[0]
                              : '—'
                          }
                          hint={weekShape.busiestDay ? `${weekShape.busiestDay[1]} bookings` : ''}
                        />
                        <MiniStat
                          label="Busiest period"
                          value={weekShape.busiestPeriod ? `P${weekShape.busiestPeriod[0]}` : '—'}
                          hint={
                            weekShape.busiestPeriod ? `${weekShape.busiestPeriod[1]} bookings` : ''
                          }
                        />
                        <MiniStat
                          label="Awaiting review"
                          value={weekShape.pending}
                          hint="Supervisor not seen"
                        />
                        <MiniStat
                          label="Declined"
                          value={weekShape.declined}
                          hint="Lab cannot prepare"
                          alert={weekShape.declined > 0}
                        />
                      </div>

                    </>
                  )}
                </div>

                <AdminCharts
                  reservations={allCurrentReservations}
                  labs={sectionData.labs}
                  weekNumber={sectionData.weekNumber}
                />

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
                    <span>Sessions per teacher</span>
                  </h4>

                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                    {sectionData.teachers.map(tName => {
                      const teacherResList = scopedReservations.filter(r => r.teacher === tName);

                      if (teacherResList.length === 0) {
                        return (
                          <div
                            key={tName}
                            className="p-3 rounded-xl bg-white border border-slate-200 text-sm flex justify-between items-center gap-2"
                          >
                            <span className="font-semibold text-slate-900">{tName}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                              No sessions
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={tName}
                          className="p-3.5 rounded-xl bg-white border border-slate-300 space-y-2"
                        >
                          <div className="flex justify-between items-center border-b pb-2 border-slate-200 gap-2">
                            <span className="font-bold text-slate-900">{tName}</span>
                            <span className="px-2.5 py-0.5 bg-brand-kingdom-100 text-brand-kingdom-900 rounded-full text-xs font-bold shrink-0">
                              {teacherResList.length} session
                              {teacherResList.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          <div className="border border-slate-200 rounded-lg overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs min-w-[520px]">
                              <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                                <tr>
                                  <th scope="col" className="p-2">Day &amp; period</th>
                                  <th scope="col" className="p-2">Lab &amp; class</th>
                                  <th scope="col" className="p-2">Experiment</th>
                                  <th scope="col" className="p-2">Materials</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                {teacherResList.map((res, idx) => {
                                  const labName =
                                    sectionData.labs.find(l => l.id === res.labId)?.name || res.labId;
                                  const exp = getEffectiveExperimentDetails(res);
                                  return (
                                    <tr key={`${res.id}-${idx}`} className="hover:bg-slate-50">
                                      <td className="p-2 font-semibold text-brand-kingdom-800 capitalize">
                                        {res.day} · P{res.period}
                                      </td>
                                      <td className="p-2 text-slate-800">
                                        {labName}{' '}
                                        <span className="text-slate-600">({res.className})</span>
                                      </td>
                                      <td className="p-2 font-semibold text-slate-900">
                                        {exp.experimentName || (
                                          <span className="text-slate-500 font-normal">
                                            {NOT_SPECIFIED}
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2 text-slate-800 whitespace-pre-wrap max-w-xs">
                                        {exp.materialsNeeded || (
                                          <span className="text-slate-500">{NOT_SPECIFIED}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {Object.keys(stats.safetyItemsFreq).length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-brand-green-700" aria-hidden="true" />
                      <span>Safety equipment requested</span>
                    </h4>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.safetyItemsFreq)
                        .sort((a, b) => b[1] - a[1])
                        .map(([item, count]) => (
                          <div
                            key={item}
                            className="px-3 py-1.5 rounded-lg bg-brand-green-50 border border-brand-green-300 text-brand-green-900 text-sm font-semibold flex items-center gap-2"
                          >
                            <span>{item}</span>
                            <span className="px-1.5 py-0.5 bg-brand-green-200 text-brand-green-900 rounded-full text-xs font-bold">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LOG */}
            {activeTab === 'log' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-brand-kingdom-50/70 p-3.5 rounded-xl border border-brand-kingdom-300">
                  <div>
                    <h3 className="text-sm font-bold text-brand-kingdom-950 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
                      <span>Materials log</span>
                    </h3>
                    <p className="text-sm text-slate-700 mt-0.5">
                      What the bookings in {scopeLabel} ask the lab to prepare.
                    </p>
                  </div>
                  <ScopeToggle
                    scope={scope}
                    onChange={setScope}
                    weekNumber={sectionData.weekNumber}
                    archivedCount={archivedCount}
                  />
                </div>

                {/* Demand, aggregated. Derived from the bookings themselves, so
                    clearing or archiving the week takes the list with it --
                    unlike the stockroom inventory, which is permanent. */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Package className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
                      <span>
                        {scope === 'week'
                          ? `Needed in week ${sectionData.weekNumber}`
                          : 'Needed across all weeks'}
                      </span>
                    </h4>
                    <span className="text-xs text-slate-700">
                      {materialsNeeded.length} distinct item
                      {materialsNeeded.length === 1 ? '' : 's'} from {stats.total} booking
                      {stats.total === 1 ? '' : 's'}
                    </span>
                  </div>

                  {materialsNeeded.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      {stats.total === 0
                        ? scope === 'week'
                          ? `Nothing is booked in week ${sectionData.weekNumber}, so nothing is needed.`
                          : 'No bookings to draw a materials list from.'
                        : 'None of these bookings list any materials.'}
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {materialsNeeded.map(item => (
                        <li
                          key={item.label.toLowerCase()}
                          className="bg-white border border-slate-300 rounded-lg px-3 py-2 flex items-start justify-between gap-2"
                        >
                          <span className="text-sm text-slate-900 min-w-0 break-words">
                            {item.label}
                          </span>
                          <span
                            className="px-2 py-0.5 bg-brand-kingdom-100 text-brand-kingdom-900 rounded-full text-xs font-bold shrink-0 tabular-nums"
                            title={item.requests
                              .map(rq => `${rq.teacher} — ${rq.when}`)
                              .join('\n')}
                          >
                            ×{item.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div className="relative w-full sm:w-2/3">
                    <label htmlFor="log-search" className="sr-only">
                      Search the materials log
                    </label>
                    <Search
                      className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="log-search"
                      type="search"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder="Search experiment, materials, file or teacher…"
                      className={`${inputClass} pl-9`}
                    />
                  </div>

                  <div className="w-full sm:w-1/3">
                    <label htmlFor="log-teacher" className="sr-only">
                      Filter by teacher
                    </label>
                    <select
                      id="log-teacher"
                      value={selectedTeacherFilter}
                      onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                      className={inputClass}
                    >
                      <option value="ALL">All teachers</option>
                      {sectionData.teachers.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-auto max-h-[50vh]">
                  <table className="w-full text-left text-sm border-collapse min-w-[720px]">
                    <thead className="bg-slate-100 text-slate-800 font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th scope="col" className="p-2.5">Teacher &amp; class</th>
                        <th scope="col" className="p-2.5">Lab &amp; period</th>
                        <th scope="col" className="p-2.5">Experiment &amp; materials</th>
                        <th scope="col" className="p-2.5">Worksheets &amp; files</th>
                        <th scope="col" className="p-2.5">Safety gear</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredLog.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-600">
                            No sessions match your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredLog.map((res, i) => {
                          const labName =
                            sectionData.labs.find(l => l.id === res.labId)?.name || res.labId;
                          const exp = getEffectiveExperimentDetails(res);

                          return (
                            <tr key={`${res.id}-${i}`} className="hover:bg-slate-50 transition">
                              <td className="p-2.5 align-top">
                                <span className="font-semibold text-slate-900 block">
                                  {res.teacher}
                                </span>
                                <span className="text-xs text-slate-600">Class {res.className}</span>
                              </td>

                              <td className="p-2.5 align-top">
                                <span className="font-semibold text-brand-kingdom-800 block">{labName}</span>
                                <span className="text-xs text-slate-600 capitalize">
                                  {res.day} · P{res.period}
                                </span>
                              </td>

                              <td className="p-2.5 align-top">
                                <span className="font-semibold text-slate-900 block">
                                  {exp.experimentName || (
                                    <span className="text-slate-600 font-normal">{NOT_SPECIFIED}</span>
                                  )}
                                </span>
                                {exp.materialsNeeded ? (
                                  <p className="text-xs text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-200 mt-1 whitespace-pre-wrap">
                                    {exp.materialsNeeded}
                                  </p>
                                ) : (
                                  <span className="text-xs text-slate-600">
                                    No materials listed
                                  </span>
                                )}
                                {exp.techNotes && (
                                  <p className="text-xs text-brand-yellow-900 mt-1">Note: {exp.techNotes}</p>
                                )}
                              </td>

                              <td className="p-2.5 align-top space-y-1">
                                {exp.needsPrintedWorksheets ? (
                                  <span className="px-2 py-0.5 bg-brand-plum-100 text-brand-plum-900 rounded font-semibold text-xs block w-fit">
                                    {exp.worksheetCopies} copies
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">No prints</span>
                                )}

                                {exp.fileName && exp.fileUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(exp.fileUrl, exp.fileName)}
                                    className="px-2 py-1 bg-brand-aqua-50 hover:bg-brand-aqua-100 text-brand-aqua-900 border border-brand-aqua-300 rounded text-xs font-semibold flex items-center gap-1 transition truncate max-w-[150px]"
                                    title={`Download ${exp.fileName}`}
                                  >
                                    <Paperclip className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{exp.fileName}</span>
                                  </button>
                                )}
                              </td>

                              <td className="p-2.5 align-top">
                                {exp.safetyItems.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {exp.safetyItems.map(s => (
                                      <span
                                        key={s}
                                        className="px-1.5 py-0.5 bg-brand-green-50 text-brand-green-900 border border-brand-green-300 rounded text-xs"
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Named for the brand colours they use. The old keys (indigo/blue/emerald/…)
// were left over from the stock Tailwind palette and no longer described what
// they rendered.
const TONES = {
  kingdom: 'bg-brand-kingdom-50 border-brand-kingdom-300 text-brand-kingdom-900',
  aqua: 'bg-brand-aqua-50 border-brand-aqua-300 text-brand-aqua-900',
  green: 'bg-brand-green-50 border-brand-green-300 text-brand-green-900',
  yellow: 'bg-brand-yellow-50 border-brand-yellow-300 text-brand-yellow-900',
  coral: 'bg-brand-coral-50 border-brand-coral-300 text-brand-coral-900'
} as const;

/**
 * Week / all-weeks switch for the statistics and the materials log.
 *
 * A segmented control rather than a checkbox because the two states are equally
 * legitimate readings and the label has to state which one is live -- the old
 * behaviour was "all weeks, silently", and nothing on screen said so.
 */
const ScopeToggle: React.FC<{
  scope: 'week' | 'all';
  onChange: (s: 'week' | 'all') => void;
  weekNumber: number;
  archivedCount: number;
}> = ({ scope, onChange, weekNumber, archivedCount }) => (
  <div
    role="group"
    aria-label="What these figures count"
    className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5 shrink-0"
  >
    {(
      [
        { id: 'week' as const, label: `Week ${weekNumber}`, title: 'This week only' },
        {
          id: 'all' as const,
          label: 'All weeks',
          title:
            archivedCount > 0
              ? `Includes ${archivedCount} archived booking${archivedCount === 1 ? '' : 's'}`
              : 'Nothing archived yet'
        }
      ]
    ).map(opt => (
      <button
        key={opt.id}
        type="button"
        onClick={() => onChange(opt.id)}
        aria-pressed={scope === opt.id}
        title={opt.title}
        className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition ${
          scope === opt.id
            ? 'bg-brand-kingdom-700 text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/** Compact figure inside a grouped panel. */
const MiniStat: React.FC<{
  label: string;
  value: number | string;
  hint?: string;
  alert?: boolean;
}> = ({ label, value, hint, alert = false }) => (
  <div
    className={`p-2.5 rounded-lg border ${
      alert
        ? 'bg-brand-coral-50 border-brand-coral-300'
        : 'bg-white border-slate-300'
    }`}
  >
    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 block">
      {label}
    </span>
    <span
      className={`text-xl font-black block ${
        alert ? 'text-brand-coral-900' : 'text-slate-900'
      }`}
    >
      {value}
    </span>
    {hint && <span className="text-[11px] text-slate-600 block">{hint}</span>}
  </div>
);


const StatCard: React.FC<{
  label: string;
  value: number;
  hint: string;
  tone: keyof typeof TONES;
}> = ({ label, value, hint, tone }) => (
  <div className={`p-3.5 rounded-xl border ${TONES[tone]}`}>
    <span className="text-xs font-bold uppercase tracking-wide block">{label}</span>
    <span className="text-2xl font-black block mt-0.5">{value}</span>
    <span className="text-xs font-medium block mt-0.5 opacity-80">{hint}</span>
  </div>
);

const RosterCard: React.FC<{
  title: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  items: string[];
  itemPrefix?: string;
  inputId: string;
  placeholder: string;
  value: string;
  onValueChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}> = ({
  title,
  Icon,
  items,
  itemPrefix = '',
  inputId,
  placeholder,
  value,
  onValueChange,
  onAdd,
  onRemove
}) => (
  <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 flex flex-col justify-between">
    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-2">
      <Icon className="w-4 h-4 text-brand-kingdom-700" aria-hidden />
      <span>
        {title} ({items.length})
      </span>
    </div>

    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 mb-3">
      {items.map((item, idx) => (
        <div
          key={`${item}-${idx}`}
          className="bg-white px-3 py-1.5 rounded-lg border border-slate-300 flex justify-between items-center text-sm text-slate-800 gap-2"
        >
          <span className="truncate">
            {itemPrefix}
            {item}
          </span>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label={`Remove ${itemPrefix}${item}`}
            className="text-slate-500 hover:text-brand-coral-700 min-h-6 min-w-6 inline-flex items-center justify-center rounded transition shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>

    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd();
      }}
      className="flex gap-2"
    >
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      <button
        type="submit"
        className="px-4 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white font-bold text-sm rounded-lg transition shrink-0"
      >
        Add
      </button>
    </form>
  </div>
);
