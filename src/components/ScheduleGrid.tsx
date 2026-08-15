import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  AlertTriangle,
  Users,
  Calendar,
  FlaskConical,
  Clock,
  LayoutGrid,
  Filter,
  FileText,
  Shield,
  Eye,
  X,
  Printer,
  Paperclip,
  Lock,
  SearchX,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  Day,
  Lab,
  Reservation,
  ConflictAlert,
  Section,
  BlockedPeriod,
  SupervisorReview
} from '../types';
import { DAYS_LIST, PERIODS_LIST } from '../data/initialData';
import {
  MAX_CONCURRENT_LABS_PER_PERIOD,
  MAX_ACTIVE_PERIODS_PER_DAY,
  SLOTS_PER_PERIOD
} from '../constants';
import { getEffectiveExperimentDetails, NOT_SPECIFIED } from '../utils/experimentUtils';
import { useModalA11y } from '../hooks/useModalA11y';
import { themeFor } from '../theme';
import { colorForTeacher } from '../teacherColors';
import { SupervisorReviewPanel } from './SupervisorReviewPanel';

// jspdf + html2canvas are ~700 KB and only needed when someone exports.
const PdfReportModal = lazy(() =>
  import('./PdfReportModal').then(m => ({ default: m.PdfReportModal }))
);

interface ScheduleGridProps {
  section: Section;
  labs: Lab[];
  reservations: Record<string, Reservation[]>;
  conflicts: ConflictAlert[];
  searchQuery: string;
  selectedLabFilter: string;
  selectedTeacherFilter: string;
  teacherRoster: string[];
  blockedPeriods?: Record<string, BlockedPeriod>;
  isAdminLoggedIn: boolean;
  isScheduleLocked: boolean;
  onQuickBook: (day: Day, period: number, labId: string, slotIndex: number) => void;
  onCancelReservation: (reservationId: string) => void;
  onSetSupervisorReview: (reservationId: string, review: SupervisorReview | null) => void;
  onOpenLockModal?: (day?: Day, period?: number) => void;
}

const slotKey = (day: Day, period: number) => `${day}_p${period}`;

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  section,
  labs,
  reservations,
  conflicts,
  searchQuery,
  selectedLabFilter,
  selectedTeacherFilter,
  teacherRoster,
  blockedPeriods = {},
  isAdminLoggedIn,
  isScheduleLocked,
  onQuickBook,
  onCancelReservation,
  onSetSupervisorReview,
  onOpenLockModal
}) => {
  // Grid chrome follows the school, same as the header. See src/theme.ts.
  const theme = themeFor(section);
  const primaryBg = theme.accentSolid;
  const primaryBorder = theme.accentBorder;
  const hoverBtnBg =
    section === 'boys'
      ? 'hover:bg-brand-green-50 hover:border-brand-green-500 hover:text-brand-green-900'
      : 'hover:bg-brand-violet-50 hover:border-brand-violet-500 hover:text-brand-violet-900';

  const [selectedDayFilter, setSelectedDayFilter] = useState<Day | 'ALL'>('ALL');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const [pdfModalConfig, setPdfModalConfig] = useState<{
    isOpen: boolean;
    initialDayFilter: Day | 'ALL';
    singleReservation: Reservation | null;
  }>({ isOpen: false, initialDayFilter: 'ALL', singleReservation: null });

  const allReservations = useMemo(() => {
    const out: Reservation[] = [];
    Object.values(reservations).forEach(list => {
      if (Array.isArray(list)) out.push(...list);
    });
    return out;
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allReservations.filter(res => {
      if (selectedLabFilter !== 'ALL' && res.labId !== selectedLabFilter) return false;
      if (selectedTeacherFilter !== 'ALL' && res.teacher !== selectedTeacherFilter) return false;
      if (!q) return true;

      const exp = res.experimentDetails;
      const labName = labs.find(l => l.id === res.labId)?.name || '';
      return [
        res.teacher,
        res.className,
        res.subject,
        exp?.experimentName,
        exp?.materialsNeeded,
        exp?.fileName,
        labName
      ].some(field => field?.toLowerCase().includes(q));
    });
  }, [allReservations, searchQuery, selectedLabFilter, selectedTeacherFilter, labs]);

  /**
   * One pass to bucket reservations by day+period. The grid used to run a full
   * .filter() over every reservation for each of the 35 cells, plus again for
   * every day header.
   */
  const byDayPeriod = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    filteredReservations.forEach(res => {
      const key = slotKey(res.day, res.period);
      map.set(key, [...(map.get(key) || []), res]);
    });
    return map;
  }, [filteredReservations]);

  const activePeriodsByDay = useMemo(() => {
    const map = new Map<Day, Set<number>>();
    filteredReservations.forEach(res => {
      const set = map.get(res.day) || new Set<number>();
      set.add(res.period);
      map.set(res.day, set);
    });
    return map;
  }, [filteredReservations]);

  const conflictByReservationId = useMemo(() => {
    const map = new Map<string, ConflictAlert>();
    conflicts.forEach(conflict => {
      [conflict.reservationId1, conflict.reservationId2].forEach(id => {
        // Errors take precedence over advisory cross-section warnings.
        if (!id) return;
        const existing = map.get(id);
        if (!existing || (existing.severity === 'warning' && conflict.severity === 'error')) {
          map.set(id, conflict);
        }
      });
    });
    return map;
  }, [conflicts]);

  const activeDays = selectedDayFilter === 'ALL'
    ? DAYS_LIST
    : DAYS_LIST.filter(d => d.id === selectedDayFilter);

  const isFiltering =
    Boolean(searchQuery.trim()) || selectedLabFilter !== 'ALL' || selectedTeacherFilter !== 'ALL';
  // Period blocking is the lab technician's tool, not an administrator one --
  // see the note on handleSaveLockPeriod in App.tsx.
  const canManageLocks = Boolean(onOpenLockModal);

  /**
   * Default lab for a new booking: the first room still free in that period.
   * Slots used to map straight onto labs[slotIndex], so slot 3 fell back to a
   * hardcoded 'lab-3' that need not exist and slot 1 always proposed labs[0]
   * even when it was already taken.
   */
  const suggestLabId = (day: Day, period: number): string => {
    const taken = new Set(
      allReservations.filter(r => r.day === day && r.period === period).map(r => r.labId)
    );
    return (labs.find(l => !taken.has(l.id)) || labs[0])?.id || '';
  };

  const handleBookSlot = (day: Day, period: number, slotIndex: number) => {
    onQuickBook(day, period, suggestLabId(day, period), slotIndex);
  };

  const handleOpenPdfForSingleExperiment = (res: Reservation) => {
    setPdfModalConfig({ isOpen: true, initialDayFilter: res.day, singleReservation: res });
  };

  const handleOpenPdfForDayOrMaster = () => {
    setPdfModalConfig({
      isOpen: true,
      initialDayFilter: selectedDayFilter,
      singleReservation: null
    });
  };

  const renderCellSlots = (day: Day, period: number) => {
    const cellReservations = byDayPeriod.get(slotKey(day, period)) || [];
    const blockedObj = blockedPeriods[slotKey(day, period)];
    const periodIsFull = cellReservations.length >= MAX_CONCURRENT_LABS_PER_PERIOD;

    return Array.from({ length: SLOTS_PER_PERIOD }, (_, slotIndex) => {
      const reservation = cellReservations.find(r => r.slotIndex === slotIndex);
      return (
        <MiniSlotCell
          key={slotIndex}
          slotLabel={`Slot ${slotIndex + 1}`}
          day={day}
          period={period}
          reservation={reservation}
          labs={labs}
          isPeriodFull={periodIsFull && !reservation}
          isBlocked={Boolean(blockedObj)}
          blockedReason={blockedObj?.reason}
          isScheduleLocked={isScheduleLocked && !isAdminLoggedIn}
          canManageLocks={canManageLocks}
          conflict={reservation ? conflictByReservationId.get(reservation.id) : undefined}
          hoverBtnBg={hoverBtnBg}
          teacherRoster={teacherRoster}
          onBook={() => {
            if (blockedObj && canManageLocks) {
              onOpenLockModal?.(day, period);
            } else {
              handleBookSlot(day, period, slotIndex);
            }
          }}
          onCancel={onCancelReservation}
          onViewDetails={setSelectedReservation}
          onOpenPdf={handleOpenPdfForSingleExperiment}
        />
      );
    });
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Controls */}
      <div
        className={`bg-white p-4 rounded-2xl border ${primaryBorder} shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 ${primaryBg} rounded-xl flex items-center justify-center shrink-0`}
          >
            <LayoutGrid className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Weekly Lab Schedule</h2>
            <p className="text-sm text-slate-600">
              {selectedDayFilter === 'ALL'
                ? 'Full weekly matrix'
                : `Filtered to ${selectedDayFilter}`}
              {isFiltering && (
                <span className="text-slate-500">
                  {' '}· {filteredReservations.length} match
                  {filteredReservations.length === 1 ? '' : 'es'}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {canManageLocks && (
            <button
              type="button"
              onClick={() => onOpenLockModal?.()}
              className="px-3.5 py-2 bg-brand-coral-700 hover:bg-brand-coral-800 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 transition"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>Lock / Block Period</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl flex items-center gap-1.5 transition"
            title="Print the timetable grid"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleOpenPdfForDayOrMaster}
            className="px-3.5 py-2 bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white font-semibold text-sm rounded-xl flex items-center gap-1.5 transition"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>
              {selectedDayFilter === 'ALL' ? 'Master PDF report' : `${selectedDayFilter} PDF`}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            <label htmlFor="day-filter" className="sr-only">
              View a single day
            </label>
            <select
              id="day-filter"
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value as Day | 'ALL')}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 cursor-pointer min-w-[150px]"
            >
              <option value="ALL">All days (master table)</option>
              {DAYS_LIST.map(d => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status banners */}
      {isScheduleLocked && (
        <div className="bg-brand-coral-50 border border-brand-coral-300 rounded-2xl p-3.5 flex items-center gap-2.5 text-sm text-brand-coral-950 print:hidden">
          <Lock className="w-4 h-4 text-brand-coral-700 shrink-0" aria-hidden="true" />
          <span>
            <strong>Bookings are locked</strong> for this section by the administrator.
            {isAdminLoggedIn && ' You can still book as an administrator.'}
          </span>
        </div>
      )}

      {Object.keys(blockedPeriods).length > 0 && (
        <div className="bg-brand-coral-50/90 border border-brand-coral-300 rounded-2xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-brand-coral-950 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-coral-200 text-brand-coral-900 rounded-xl shrink-0">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <span className="font-bold block">
                {Object.keys(blockedPeriods).length} period
                {Object.keys(blockedPeriods).length === 1 ? '' : 's'} blocked by the lab technician
              </span>
              <p className="text-brand-coral-900 mt-0.5">
                Blocked periods show the technician's reason on the affected slots.
              </p>
            </div>
          </div>

          {canManageLocks && (
            <button
              type="button"
              onClick={() => onOpenLockModal?.()}
              className="px-3 py-1.5 bg-brand-coral-800 hover:bg-brand-coral-900 text-white font-semibold text-sm rounded-xl transition flex items-center gap-1.5 shrink-0"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Manage locks</span>
            </button>
          )}
        </div>
      )}

      {isFiltering && filteredReservations.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center print:hidden">
          <SearchX className="w-8 h-8 text-slate-400 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900">No bookings match your filters</h3>
          <p className="text-sm text-slate-600 mt-1">
            Try a different teacher, class or lab — or clear the filters to see the whole week.
          </p>
        </div>
      )}

      {/* Desktop matrix.

          `hidden md:block` meant the matrix only existed above 768px, and the
          print viewport is the paper width -- so printing from a narrow window
          produced a page with no schedule on it at all. `print:block` forces it
          back. The outer `overflow-hidden` (there to clip the rounded corners on
          screen) also had no print override and was cropping the table at the
          page edge, hence `print:overflow-visible` on both. */}
      <div
        className={`hidden md:block print:block ${theme.tableGround} rounded-2xl border ${primaryBorder} shadow-sm overflow-hidden print:overflow-visible print:border-none print:shadow-none print:rounded-none`}
      >
        <div className="overflow-x-auto print:overflow-visible">
          <table className="master-schedule-table w-full text-left border-collapse min-w-[880px] print:min-w-0 print:w-full print:table-fixed">
            <caption className="sr-only">
              Weekly lab schedule by period and day. Each cell holds up to{' '}
              {SLOTS_PER_PERIOD} booking slots.
            </caption>
            <thead>
              <tr
                className={`${
                  section === 'boys'
                    ? 'bg-brand-green-100 text-brand-green-950'
                    : 'bg-brand-violet-100 text-brand-violet-950'
                } text-sm font-bold border-b ${primaryBorder}`}
              >
                <th
                  scope="col"
                  className="py-3.5 px-4 w-28 border-r border-slate-200 text-center font-bold uppercase tracking-wide text-slate-700 bg-slate-100/80 print:w-12 print:p-1 print:text-[10px]"
                >
                  Period
                </th>
                {activeDays.map(dayObj => {
                  const activePeriods = activePeriodsByDay.get(dayObj.id)?.size || 0;
                  const isAtLimit = activePeriods >= MAX_ACTIVE_PERIODS_PER_DAY;
                  return (
                    <th
                      key={dayObj.id}
                      scope="col"
                      className="py-3 px-3 border-r border-slate-200 text-center font-bold w-1/5 min-w-[176px] print:min-w-0 print:w-auto print:p-1 print:text-xs"
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 opacity-70 print:hidden" aria-hidden="true" />
                          <span>{dayObj.label}</span>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border print:hidden ${
                            isAtLimit
                              ? 'bg-brand-coral-100 text-brand-coral-900 border-brand-coral-300'
                              : 'bg-white/80 text-slate-700 border-slate-300'
                          }`}
                        >
                          Tech load: {activePeriods}/{MAX_ACTIVE_PERIODS_PER_DAY}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {PERIODS_LIST.map(period => (
                <tr key={`period-${period}`} className="hover:bg-slate-50/60 transition">
                  <th
                    scope="row"
                    className="py-4 px-3 font-bold text-slate-900 bg-slate-50/80 border-r border-slate-200 align-middle text-center"
                  >
                    <div className="text-base font-black text-slate-900">P{period}</div>
                    <div className="text-xs text-slate-600 font-medium mt-0.5">Period {period}</div>
                  </th>

                  {activeDays.map(dayObj => (
                    <td
                      key={`${dayObj.id}-p${period}`}
                      className="p-2 border-r border-slate-200 align-top bg-white"
                    >
                      <div className="space-y-2">
                        {blockedPeriods[slotKey(dayObj.id, period)] && (
                          <BlockedBadge
                            reason={blockedPeriods[slotKey(dayObj.id, period)].reason}
                            canManage={canManageLocks}
                            onManage={() => onOpenLockModal?.(dayObj.id, period)}
                          />
                        )}
                        {renderCellSlots(dayObj.id, period)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: the 950px-wide matrix behind a horizontal scrollbar was
          unusable on a phone, which is where most teachers book from. */}
      <div className="md:hidden space-y-4 print:hidden">
        {activeDays.map(dayObj => {
          const dayHasBookings = PERIODS_LIST.some(
            p => (byDayPeriod.get(slotKey(dayObj.id, p)) || []).length > 0
          );
          return (
            <section
              key={dayObj.id}
              className={`${theme.tableGround} rounded-2xl border ${primaryBorder} shadow-xs overflow-hidden`}
            >
              <h3
                className={`px-4 py-3 font-bold text-sm flex items-center justify-between ${
                  section === 'boys'
                    ? 'bg-brand-green-100 text-brand-green-950'
                    : 'bg-brand-violet-100 text-brand-violet-950'
                }`}
              >
                <span>{dayObj.label}</span>
                <span className="text-xs font-semibold text-slate-700">
                  {activePeriodsByDay.get(dayObj.id)?.size || 0}/{MAX_ACTIVE_PERIODS_PER_DAY} periods
                </span>
              </h3>

              <div className="divide-y divide-slate-200">
                {PERIODS_LIST.map(period => {
                  const cellReservations = byDayPeriod.get(slotKey(dayObj.id, period)) || [];
                  const blockedObj = blockedPeriods[slotKey(dayObj.id, period)];

                  // Keep empty periods collapsed on a phone unless the whole
                  // day is empty, so the list stays scannable.
                  if (cellReservations.length === 0 && !blockedObj && dayHasBookings) return null;

                  return (
                    <div key={period} className="p-3 space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
                        Period {period}
                      </div>
                      {blockedObj && (
                        <BlockedBadge
                          reason={blockedObj.reason}
                          canManage={canManageLocks}
                          onManage={() => onOpenLockModal?.(dayObj.id, period)}
                        />
                      )}
                      {renderCellSlots(dayObj.id, period)}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selectedReservation && (
        <ReservationDetailModal
          reservation={selectedReservation}
          labs={labs}
          canReview={isAdminLoggedIn}
          onSetReview={(review) => {
            onSetSupervisorReview(selectedReservation.id, review);
            // Keep the panel open on the fresh value rather than closing: the
            // supervisor is usually working through several bookings and the
            // snapshot round-trip would otherwise blank the dialog mid-review.
            setSelectedReservation({ ...selectedReservation, supervisorReview: review ?? undefined });
          }}
          onClose={() => setSelectedReservation(null)}
          onCancel={(id) => {
            setSelectedReservation(null);
            onCancelReservation(id);
          }}
          onOpenPdf={(res) => {
            setSelectedReservation(null);
            handleOpenPdfForSingleExperiment(res);
          }}
        />
      )}

      {pdfModalConfig.isOpen && (
        <Suspense fallback={null}>
          <PdfReportModal
            isOpen={pdfModalConfig.isOpen}
            section={section}
            labs={labs}
            reservations={reservations}
            initialDayFilter={pdfModalConfig.initialDayFilter}
            singleReservation={pdfModalConfig.singleReservation}
            onClose={() => setPdfModalConfig(prev => ({ ...prev, isOpen: false }))}
          />
        </Suspense>
      )}
    </div>
  );
};

const BlockedBadge: React.FC<{
  reason: string;
  canManage: boolean;
  onManage: () => void;
}> = ({ reason, canManage, onManage }) => {
  const content = (
    <>
      <div className="flex items-center justify-between font-bold text-xs text-brand-coral-900">
        <span className="flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 text-brand-coral-700 shrink-0" aria-hidden="true" />
          <span>Blocked by technician</span>
        </span>
      </div>
      <p className="text-xs text-brand-coral-950 leading-snug mt-0.5">{reason}</p>
    </>
  );

  const className =
    'w-full text-left p-2 rounded-xl bg-brand-coral-100/90 border border-brand-coral-300 text-brand-coral-950';

  return canManage ? (
    <button
      type="button"
      onClick={onManage}
      className={`${className} hover:bg-brand-coral-200/90 transition cursor-pointer`}
      title="Edit or remove this lock"
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
};

interface MiniSlotCellProps {
  slotLabel: string;
  day: Day;
  period: number;
  reservation?: Reservation;
  labs: Lab[];
  isPeriodFull: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  isScheduleLocked: boolean;
  canManageLocks: boolean;
  conflict?: ConflictAlert;
  hoverBtnBg: string;
  teacherRoster: string[];
  onBook: () => void;
  onCancel: (id: string) => void;
  onViewDetails: (res: Reservation) => void;
  onOpenPdf: (res: Reservation) => void;
}

const MiniSlotCell: React.FC<MiniSlotCellProps> = ({
  slotLabel,
  day,
  period,
  reservation,
  labs,
  isPeriodFull,
  isBlocked,
  blockedReason,
  isScheduleLocked,
  canManageLocks,
  conflict,
  hoverBtnBg,
  teacherRoster,
  onBook,
  onCancel,
  onViewDetails,
  onOpenPdf
}) => {
  if (reservation) {
    const labName = labs.find(l => l.id === reservation.labId)?.name || reservation.labId;
    const exp = getEffectiveExperimentDetails(reservation);

    const formattedDateTime = (() => {
      if (!reservation.createdAt) return '';
      const d = new Date(reservation.createdAt);
      if (isNaN(d.getTime())) return '';
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(
        [],
        { hour: '2-digit', minute: '2-digit' }
      )}`;
    })();

    // A booked slot is filled, never white, so "taken" is obvious across the
    // room and on paper. The fill is a tint of the teacher's own colour and a
    // solid bar down the left edge carries that colour at full strength, which
    // lets a teacher trace their own week down the grid.
    //
    // The bar is the colour-bearing mark; the tint stays light so the booking
    // details keep dark ink and stay readable. See src/teacherColors.ts for why
    // there are four colours and not seven.
    //
    // A conflict overrides the teacher colour outright -- an unresolved clash
    // is more urgent than whose booking it is.
    const tc = colorForTeacher(reservation.teacher, teacherRoster);

    return (
      <div
        className={`relative group transition overflow-hidden rounded-xl border pl-3 pr-2.5 py-2.5 print:break-inside-avoid ${
          conflict ? 'bg-brand-coral-100 border-brand-coral-600' : `${tc.bg} ${tc.border}`
        }`}
      >
        <span
          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            conflict ? 'bg-brand-coral-700' : tc.bar
          }`}
          aria-hidden="true"
        />
        <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-300/70">
          {/* The whole card used to be a div with onClick, so keyboard users
              could not reach a single booking. */}
          <button
            type="button"
            onClick={() => onViewDetails(reservation)}
            className={`font-bold text-[13px] leading-tight ${conflict ? "text-brand-coral-900" : tc.ink} flex items-center gap-1.5 truncate pr-1 hover:underline text-left focus:outline-none focus:ring-2 focus:ring-brand-kingdom-600 rounded`}
          >
            <FlaskConical className={`w-3.5 h-3.5 shrink-0 ${conflict ? "text-brand-coral-700" : tc.inkSoft}`} aria-hidden="true" />
            <span className="truncate">{labName}</span>
            <span className="sr-only">
              — view details for {reservation.teacher}, class {reservation.className}, {day} period{' '}
              {period}
            </span>
          </button>

          {/* These three sat at 20-22px, under the 24x24 CSS px floor WCAG 2.2
              AA sets for pointer targets -- on the two that cancel a booking or
              open a print job, which are the worst ones to mis-tap. The icons
              stay small so the cell keeps its density; `min-h-6 min-w-6` grows
              only the hit area. */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenPdf(reservation)}
              aria-label={`Print requisition PDF for ${reservation.teacher}`}
              className="px-1.5 min-h-6 text-brand-kingdom-800 bg-white hover:bg-brand-kingdom-50 border border-brand-kingdom-300 rounded font-bold transition inline-flex items-center justify-center gap-0.5 text-[11px]"
              title="View and print the PDF for this experiment"
            >
              <FileText className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => onViewDetails(reservation)}
              aria-label={`Inspect booking details for ${reservation.teacher}`}
              className="min-h-6 min-w-6 inline-flex items-center justify-center text-slate-700 hover:text-brand-kingdom-800 hover:bg-white rounded transition"
              title="Inspect details"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onCancel(reservation.id)}
              aria-label={`Cancel booking for ${reservation.teacher}, class ${reservation.className}`}
              className="min-h-6 min-w-6 inline-flex items-center justify-center text-slate-700 hover:text-brand-coral-800 hover:bg-white rounded transition"
              title="Cancel reservation"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-1.5 space-y-1.5 text-xs">
          {/* A decline has to be legible from the grid. Opening every booking
              to discover the lab cannot take one of them is not a workflow. */}
          {reservation.supervisorReview && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-bold ${
                reservation.supervisorReview.status === 'declined'
                  ? 'bg-brand-coral-100 text-brand-coral-900 border-brand-coral-400'
                  : 'bg-brand-green-100 text-brand-green-900 border-brand-green-400'
              }`}
              title={reservation.supervisorReview.reason || 'Reviewed by the lab supervisor'}
            >
              {reservation.supervisorReview.status === 'declined' ? (
                <>
                  <XCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">Lab cannot prepare</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">Supervisor reviewed</span>
                </>
              )}
            </div>
          )}

          <div className="font-bold text-[13px] leading-tight text-slate-900 truncate flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-700 shrink-0" aria-hidden="true" />
            <span className="truncate">{reservation.teacher}</span>
          </div>

          <div className="flex items-center justify-between gap-1 text-slate-800">
            <span className="bg-white border border-slate-300 text-slate-900 text-[12px] px-2 py-0.5 rounded font-semibold">
              Class {reservation.className}
            </span>
            {formattedDateTime && (
              <span
                className="text-[11px] text-slate-700 font-medium flex items-center gap-1 shrink-0"
                title={`Booked on ${formattedDateTime}`}
              >
                <Clock className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                <span>{formattedDateTime}</span>
              </span>
            )}
          </div>

          {exp.experimentName && (
            <div className="pt-1 border-t border-slate-300/70">
              <div
                className="text-[12px] leading-snug font-semibold text-slate-900 truncate"
                title={exp.experimentName}
              >
                {exp.experimentName}
              </div>
            </div>
          )}
        </div>

        {conflict && (
          <div className="mt-2 p-2 rounded bg-brand-coral-200 text-brand-coral-950 text-[12px] leading-snug font-semibold flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-brand-coral-700 shrink-0 mt-px" aria-hidden="true" />
            <span className="leading-snug">{conflict.message}</span>
          </div>
        )}
      </div>
    );
  }

  if (isBlocked) {
    return canManageLocks ? (
      <button
        type="button"
        onClick={onBook}
        className="w-full py-2 px-2 rounded-xl bg-brand-coral-50 hover:bg-brand-coral-100 border border-dashed border-brand-coral-400 text-brand-coral-800 text-xs font-semibold flex items-center justify-center gap-1 transition"
        title={blockedReason ? `Blocked: ${blockedReason}` : 'Locked by the lab technician'}
      >
        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Blocked — manage</span>
      </button>
    ) : (
      <div className="w-full py-2 px-2 rounded-xl bg-brand-coral-50 border border-dashed border-brand-coral-300 text-brand-coral-800 text-xs font-semibold flex items-center justify-center gap-1">
        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Blocked by technician</span>
      </div>
    );
  }

  if (isScheduleLocked) {
    return (
      <div className="w-full py-2 px-2 rounded-xl bg-slate-100 border border-slate-300 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1">
        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Bookings locked</span>
      </div>
    );
  }

  if (isPeriodFull) {
    return (
      <div
        className="w-full py-2 px-2 rounded-xl bg-slate-100 border border-slate-300 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1"
        title={`${MAX_CONCURRENT_LABS_PER_PERIOD} labs already booked for this period.`}
      >
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          Full ({MAX_CONCURRENT_LABS_PER_PERIOD}/{MAX_CONCURRENT_LABS_PER_PERIOD})
        </span>
      </div>
    );
  }

  /**
   * A free slot says "Available", not "Book Slot 2".
   *
   * The slot number was an implementation detail nobody outside the code cares
   * about, and on the printed sheet it was worse than useless: the print rules
   * hide every button, so free slots came out of the printer as blank space
   * that could equally mean "free", "not scheduled" or "cut off". The
   * print-only twin below prints the word instead.
   */
  return (
    <>
      <button
        type="button"
        onClick={onBook}
        className={`w-full py-2 px-2 rounded-xl border border-dashed border-brand-green-600 bg-white ${hoverBtnBg} text-brand-green-900 text-[13px] font-semibold flex items-center justify-center gap-1.5 transition group print:hidden`}
      >
        <Plus
          className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
          aria-hidden="true"
        />
        <span>Available</span>
        <span className="sr-only">
          — book {slotLabel} for {day} period {period}
        </span>
      </button>

      <span className="hidden print:block w-full py-1 text-center text-[8pt] text-slate-700 italic">
        Available
      </span>
    </>
  );
};

/* RESERVATION DETAIL MODAL */
interface ReservationDetailModalProps {
  reservation: Reservation;
  labs: Lab[];
  canReview: boolean;
  onClose: () => void;
  onCancel: (id: string) => void;
  onOpenPdf: (res: Reservation) => void;
  onSetReview: (review: SupervisorReview | null) => void;
}

const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservation,
  labs,
  canReview,
  onClose,
  onCancel,
  onOpenPdf,
  onSetReview
}) => {
  const panelRef = useModalA11y(true, onClose);
  const labName = labs.find(l => l.id === reservation.labId)?.name || reservation.labId;
  const exp = getEffectiveExperimentDetails(reservation);
  const hasDetails = Boolean(exp.experimentName || exp.materialsNeeded);

  const formattedDateTime = (() => {
    if (!reservation.createdAt) return '';
    const d = new Date(reservation.createdAt);
    if (isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  })();

  const handleDownloadFile = () => {
    if (!exp.fileUrl) return;
    const link = document.createElement('a');
    link.href = exp.fileUrl;
    link.download = exp.fileName || 'worksheet_file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-detail-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-brand-kingdom-100 text-brand-kingdom-700 rounded-lg">
                <FlaskConical className="w-4 h-4" aria-hidden="true" />
              </span>
              <h2 id="reservation-detail-title" className="text-base font-bold text-slate-900">
                {labName}
              </h2>
            </div>
            <p className="text-sm text-brand-kingdom-700 font-semibold mt-1 capitalize">
              {reservation.day} · Period {reservation.period}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenPdf(reservation)}
              className="px-2.5 py-1.5 bg-brand-kingdom-50 hover:bg-brand-kingdom-100 text-brand-kingdom-800 border border-brand-kingdom-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
              title="Open and print the PDF for this experiment"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="py-4 space-y-3.5 text-sm">
          {/* Placed above the booking details on purpose: if the supervisor has
              said they cannot prepare this, that is the first thing the teacher
              needs to know, not a footnote under the materials list. */}
          <SupervisorReviewPanel
            review={reservation.supervisorReview}
            canReview={canReview}
            onChange={onSetReview}
          />

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs uppercase font-bold text-slate-600 block">Teacher</span>
              <span className="font-bold text-slate-900">{reservation.teacher}</span>
            </div>
            <div>
              <span className="text-xs uppercase font-bold text-slate-600 block">Class</span>
              <span className="font-bold text-slate-900">Class {reservation.className}</span>
            </div>
          </div>

          {formattedDateTime && (
            <div className="flex items-center gap-2 text-slate-600 text-xs">
              <Clock className="w-3.5 h-3.5 text-brand-kingdom-600 shrink-0" aria-hidden="true" />
              <span>
                Booked on <strong className="text-slate-800">{formattedDateTime}</strong>
              </span>
            </div>
          )}

          {hasDetails ? (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600 block mb-0.5">
                  Experiment
                </span>
                <p className="font-bold text-slate-900">{exp.experimentName || NOT_SPECIFIED}</p>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-0.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-brand-kingdom-600" aria-hidden="true" />
                  <span>Materials and chemicals</span>
                </span>
                <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs whitespace-pre-wrap">
                  {exp.materialsNeeded || NOT_SPECIFIED}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-brand-plum-50 border border-brand-plum-200">
                  <span className="text-xs uppercase font-bold text-brand-plum-800 block">
                    Printed worksheets
                  </span>
                  <span className="font-bold text-brand-plum-950 text-xs">
                    {exp.needsPrintedWorksheets
                      ? `${exp.worksheetCopies} copies`
                      : 'Not requested'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-brand-aqua-50 border border-brand-aqua-200">
                  <span className="text-xs uppercase font-bold text-brand-aqua-800 block">
                    Attachment
                  </span>
                  {exp.fileName && exp.fileUrl ? (
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      className="mt-0.5 text-xs font-bold text-brand-aqua-900 hover:text-brand-aqua-950 underline flex items-center gap-1 truncate text-left"
                      title="Download the attached file"
                    >
                      <Paperclip className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{exp.fileName}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-600">None</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs uppercase font-bold text-slate-600 block">
                    Student groups
                  </span>
                  <span className="font-bold text-slate-900">
                    {exp.numberOfGroups || NOT_SPECIFIED}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs uppercase font-bold text-slate-600 block">
                    Tech support
                  </span>
                  <span
                    className={`font-bold ${
                      exp.needsTechSupport ? 'text-brand-kingdom-700' : 'text-slate-700'
                    }`}
                  >
                    {exp.needsTechSupport ? 'Required' : 'Not needed'}
                  </span>
                </div>
              </div>

              {exp.safetyItems.length > 0 && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-brand-green-700" aria-hidden="true" />
                    <span>Safety equipment</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {exp.safetyItems.map(item => (
                      <span
                        key={item}
                        className="px-2 py-0.5 rounded-md bg-brand-green-50 text-brand-green-900 border border-brand-green-300 text-xs font-medium"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {exp.techNotes && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 block mb-0.5">
                    Technician notes
                  </span>
                  <p className="p-2 rounded bg-brand-yellow-50 text-brand-yellow-950 border border-brand-yellow-300 text-xs">
                    {exp.techNotes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-center text-xs">
              No preparation details were recorded for this booking.
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onCancel(reservation.id)}
            className="px-4 py-2 bg-brand-coral-50 hover:bg-brand-coral-100 text-brand-coral-800 font-semibold rounded-lg border border-brand-coral-300 transition text-sm flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span>Cancel reservation</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
