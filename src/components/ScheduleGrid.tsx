import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, Users, Calendar, FlaskConical, Clock, LayoutGrid, Filter, FileText, Shield, Eye, X, Download, Printer, Paperclip, Film, Lock, Unlock } from 'lucide-react';
import { Day, Lab, Reservation, ConflictAlert, Section, BlockedPeriod } from '../types';
import { DAYS_LIST, PERIODS_LIST } from '../data/initialData';
import { PdfReportModal } from './PdfReportModal';
import { getEffectiveExperimentDetails } from '../utils/experimentUtils';

interface ScheduleGridProps {
  section: Section;
  labs: Lab[];
  reservations: Record<string, Reservation[]>;
  conflicts: ConflictAlert[];
  searchQuery: string;
  selectedLabFilter: string;
  blockedPeriods?: Record<string, BlockedPeriod>;
  onQuickBook: (day: Day, period: number, labId: string, slotIndex: number) => void;
  onCancelReservation: (reservationId: string) => void;
  onOpenLockModal?: (day?: Day, period?: number) => void;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  section,
  labs,
  reservations,
  conflicts,
  searchQuery,
  selectedLabFilter,
  blockedPeriods = {},
  onQuickBook,
  onCancelReservation,
  onOpenLockModal,
}) => {
  const isBoys = section === 'boys';

  // Section specific theme colors
  const primaryBg = isBoys ? 'bg-emerald-600' : 'bg-pink-600';
  const primaryBorder = isBoys ? 'border-emerald-200' : 'border-pink-200';
  const hoverBtnBg = isBoys ? 'hover:bg-emerald-100 hover:border-emerald-400 text-emerald-800' : 'hover:bg-pink-100 hover:border-pink-400 text-pink-800';

  // State to toggle between Weekly Master Table and Filtered View
  const [selectedDayFilter, setSelectedDayFilter] = useState<Day | 'ALL'>('ALL');

  // State for inspecting reservation details
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // PDF Report Modal configuration state
  const [pdfModalConfig, setPdfModalConfig] = useState<{
    isOpen: boolean;
    initialDayFilter: Day | 'ALL';
    singleReservation: Reservation | null;
  }>({
    isOpen: false,
    initialDayFilter: 'ALL',
    singleReservation: null,
  });

  // Gather all active reservations
  const allReservations: Reservation[] = [];
  Object.values(reservations).forEach(list => {
    if (Array.isArray(list)) {
      allReservations.push(...list);
    }
  });

  // Filter reservations if searching or filtering by lab
  const filteredReservations = allReservations.filter(res => {
    if (selectedLabFilter !== 'ALL' && res.labId !== selectedLabFilter) {
      return false;
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const teacherMatch = res.teacher.toLowerCase().includes(q);
      const classMatch = res.className.toLowerCase().includes(q);
      const subjectMatch = res.subject?.toLowerCase().includes(q) || false;
      const expMatch = res.experimentDetails?.experimentName.toLowerCase().includes(q) || false;
      const matMatch = res.experimentDetails?.materialsNeeded.toLowerCase().includes(q) || false;
      const fileMatch = res.experimentDetails?.fileName?.toLowerCase().includes(q) || false;
      const labObj = labs.find(l => l.id === res.labId);
      const labMatch = labObj ? labObj.name.toLowerCase().includes(q) : false;
      return teacherMatch || classMatch || subjectMatch || expMatch || matMatch || fileMatch || labMatch;
    }
    return true;
  });

  // Helper to count active technician periods for a given day
  const getDayActivePeriods = (day: Day): number => {
    const dayRes = filteredReservations.filter(r => r.day === day);
    const activePeriods = new Set(dayRes.map(r => r.period));
    return activePeriods.size;
  };

  // Helper to count total active reservations for a given (day, period)
  const getPeriodReservationCount = (day: Day, period: number): number => {
    return filteredReservations.filter(r => r.day === day && r.period === period).length;
  };

  // Helper to get conflict for a reservation
  const getConflictForReservation = (res: Reservation) => {
    return conflicts.find(
      c => c.day === res.day && 
           c.period === res.period && 
           (c.entityName === res.teacher || c.entityName === res.className)
    );
  };

  // Days to render columns
  const activeDays = selectedDayFilter === 'ALL' 
    ? DAYS_LIST 
    : DAYS_LIST.filter(d => d.id === selectedDayFilter);

  // Open PDF Modal for 1 specific experiment
  const handleOpenPdfForSingleExperiment = (res: Reservation) => {
    setPdfModalConfig({
      isOpen: true,
      initialDayFilter: res.day,
      singleReservation: res,
    });
  };

  // Open PDF Modal for full day or master list
  const handleOpenPdfForDayOrMaster = () => {
    setPdfModalConfig({
      isOpen: true,
      initialDayFilter: selectedDayFilter,
      singleReservation: null,
    });
  };

  return (
    <div className="space-y-5 font-sans">
      
      {/* View Switcher Controls Header */}
      <div className={`bg-white p-4 rounded-2xl border ${primaryBorder} shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden`}>
        
        {/* Title & Section Tag */}
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${primaryBg} rounded-xl flex items-center justify-center text-white shadow-xs shrink-0`}>
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Weekly Lab Schedule</span>
            </h2>
            <p className="text-xs text-slate-500">
              {selectedDayFilter === 'ALL' 
                ? 'Showing full weekly matrix' 
                : `Filtered view for ${selectedDayFilter.toUpperCase()}`}
            </p>
          </div>
        </div>

        {/* Header Actions: Export PDF & Day Filter Drop-down */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          
          {/* Lock / Block Period Button */}
          {onOpenLockModal && (
            <button
              type="button"
              onClick={() => onOpenLockModal()}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Lock className="w-4 h-4 text-white" />
              <span>Lock / Block Period</span>
            </button>
          )}

          {/* PDF Report Export Button */}
          <button
            type="button"
            onClick={handleOpenPdfForDayOrMaster}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>
              {selectedDayFilter === 'ALL' ? 'View Master PDF Report' : `View ${selectedDayFilter.toUpperCase()} PDF`}
            </span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>View Day:</span>
          </div>

          <select
            value={selectedDayFilter}
            onChange={(e) => setSelectedDayFilter(e.target.value as Day | 'ALL')}
            className={`bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 cursor-pointer shadow-2xs min-w-[150px]`}
          >
            <option value="ALL">All Days (Master Table)</option>
            {DAYS_LIST.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>

      </div>

      {/* BLOCKED PERIODS BANNER */}
      {Object.keys(blockedPeriods).length > 0 && (
        <div className="bg-rose-50/90 border border-rose-300/80 rounded-2xl p-3.5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-rose-950 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-200 text-rose-900 rounded-xl shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-rose-950 text-xs block">
                Lab Technician Blocked Periods ({Object.keys(blockedPeriods).length} Periods Locked)
              </span>
              <p className="text-[11px] text-rose-900 mt-0.5">
                The technician has locked specific periods. Check notes below on each locked slot.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenLockModal?.()}
            className="px-3 py-1.5 bg-rose-800 hover:bg-black text-white font-bold text-xs rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-rose-200" />
            <span>Manage Period Locks</span>
          </button>
        </div>
      )}

      {/* MASTER TIMETABLE MATRIX */}
      <div className={`bg-white rounded-2xl border ${primaryBorder} shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none`}>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="master-schedule-table w-full text-left border-collapse min-w-[950px] print:min-w-0 print:w-full print:table-fixed">
            
            {/* Table Header Row: Days */}
            <thead>
              <tr className={`${isBoys ? 'bg-emerald-100/70 text-emerald-950' : 'bg-pink-100/70 text-pink-950'} text-xs font-bold border-b ${primaryBorder}`}>
                <th className="py-3.5 px-4 w-28 border-r border-slate-200 text-center font-extrabold uppercase tracking-wider text-slate-700 bg-slate-100/80 print:w-12 print:p-1 print:text-[10px]">
                  Period
                </th>
                {activeDays.map(dayObj => {
                  const activePeriods = getDayActivePeriods(dayObj.id);
                  const isMax = activePeriods >= 5;
                  return (
                    <th key={dayObj.id} className="py-3 px-3 border-r border-slate-200 text-center font-bold text-sm min-w-[200px] print:min-w-0 print:p-1 print:text-xs">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 opacity-70 print:hidden" />
                          <span>{dayObj.label}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border print:hidden ${
                          isMax 
                            ? 'bg-rose-100 text-rose-800 border-rose-300' 
                            : 'bg-white/80 text-slate-700 border-slate-200'
                        }`}>
                          Tech Load: {activePeriods}/5 periods
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body: Periods 1 to 7 */}
            <tbody className="divide-y divide-slate-200 text-xs">
              {PERIODS_LIST.map(period => (
                <tr key={`period-${period}`} className="hover:bg-slate-50/60 transition">
                  
                  {/* Period Header Column */}
                  <td className="py-4 px-3 font-extrabold text-slate-900 bg-slate-50/80 border-r border-slate-200 align-middle text-center">
                    <div className="text-sm font-black text-slate-900">P{period}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">Period {period}</div>
                  </td>

                  {/* Day Cells */}
                  {activeDays.map(dayObj => {
                    const cellReservations = filteredReservations.filter(
                      r => r.day === dayObj.id && r.period === period
                    );
                    const techCount = getPeriodReservationCount(dayObj.id, period);
                    const isTechFull = techCount >= 3; // MAX 3 LABS

                    const blockedObj = blockedPeriods[`${dayObj.id}_p${period}`];

                    const slot1Res = cellReservations.find(r => r.slotIndex === 0);
                    const slot2Res = cellReservations.find(r => r.slotIndex === 1);
                    const slot3Res = cellReservations.find(r => r.slotIndex === 2);

                    return (
                      <td key={`${dayObj.id}-p${period}`} className="p-2 border-r border-slate-200 align-top bg-white">
                        <div className="space-y-2">
                          
                          {/* Technician Blocked / Locked Badge */}
                          {blockedObj && (
                            <div
                              onClick={() => onOpenLockModal?.(dayObj.id, period)}
                              className="p-2 rounded-xl bg-rose-100/90 border border-rose-300 text-rose-950 text-xs shadow-2xs space-y-1 cursor-pointer hover:bg-rose-200/90 transition"
                              title="Click to view or edit lock status"
                            >
                              <div className="flex items-center justify-between font-extrabold text-[11px] text-rose-900">
                                <span className="flex items-center gap-1">
                                  <Lock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                                  <span>LOCKED BY TECH</span>
                                </span>
                                <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-black uppercase">
                                  Blocked
                                </span>
                              </div>
                              <p className="text-[10.5px] font-bold text-rose-950 leading-tight">
                                Reason: <span className="font-semibold text-rose-900">{blockedObj.reason}</span>
                              </p>
                            </div>
                          )}

                          {/* Slot 1 */}
                          <MiniSlotCell
                            slotLabel="Slot 1"
                            slotIndex={0}
                            day={dayObj.id}
                            period={period}
                            reservation={slot1Res}
                            labs={labs}
                            isTechFull={isTechFull && !slot1Res}
                            isBlocked={Boolean(blockedObj)}
                            blockedReason={blockedObj?.reason}
                            conflict={slot1Res ? getConflictForReservation(slot1Res) : undefined}
                            hoverBtnBg={hoverBtnBg}
                            onBook={() => {
                              if (blockedObj) {
                                onOpenLockModal?.(dayObj.id, period);
                              } else {
                                onQuickBook(dayObj.id, period, labs[0]?.id || 'lab-1', 0);
                              }
                            }}
                            onCancel={(id) => onCancelReservation(id)}
                            onViewDetails={(res) => setSelectedReservation(res)}
                            onOpenPdf={(res) => handleOpenPdfForSingleExperiment(res)}
                          />

                          {/* Slot 2 */}
                          <MiniSlotCell
                            slotLabel="Slot 2"
                            slotIndex={1}
                            day={dayObj.id}
                            period={period}
                            reservation={slot2Res}
                            labs={labs}
                            isTechFull={isTechFull && !slot2Res}
                            isBlocked={Boolean(blockedObj)}
                            blockedReason={blockedObj?.reason}
                            conflict={slot2Res ? getConflictForReservation(slot2Res) : undefined}
                            hoverBtnBg={hoverBtnBg}
                            onBook={() => {
                              if (blockedObj) {
                                onOpenLockModal?.(dayObj.id, period);
                              } else {
                                onQuickBook(dayObj.id, period, labs[1]?.id || 'lab-2', 1);
                              }
                            }}
                            onCancel={(id) => onCancelReservation(id)}
                            onViewDetails={(res) => setSelectedReservation(res)}
                            onOpenPdf={(res) => handleOpenPdfForSingleExperiment(res)}
                          />

                          {/* Slot 3 */}
                          <MiniSlotCell
                            slotLabel="Slot 3"
                            slotIndex={2}
                            day={dayObj.id}
                            period={period}
                            reservation={slot3Res}
                            labs={labs}
                            isTechFull={isTechFull && !slot3Res}
                            isBlocked={Boolean(blockedObj)}
                            blockedReason={blockedObj?.reason}
                            conflict={slot3Res ? getConflictForReservation(slot3Res) : undefined}
                            hoverBtnBg={hoverBtnBg}
                            onBook={() => {
                              if (blockedObj) {
                                onOpenLockModal?.(dayObj.id, period);
                              } else {
                                onQuickBook(dayObj.id, period, labs[2]?.id || 'lab-3', 2);
                              }
                            }}
                            onCancel={(id) => onCancelReservation(id)}
                            onViewDetails={(res) => setSelectedReservation(res)}
                            onOpenPdf={(res) => handleOpenPdfForSingleExperiment(res)}
                          />

                        </div>
                      </td>
                    );
                  })}

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>

      {/* DETAIL MODAL FOR INSPECTING RESERVATION & MATERIALS */}
      {selectedReservation && (
        <ReservationDetailModal
          reservation={selectedReservation}
          labs={labs}
          onClose={() => setSelectedReservation(null)}
          onCancel={(id) => {
            onCancelReservation(id);
            setSelectedReservation(null);
          }}
          onOpenPdf={(res) => {
            setSelectedReservation(null);
            handleOpenPdfForSingleExperiment(res);
          }}
        />
      )}

      {/* PDF REPORT MODAL */}
      <PdfReportModal
        isOpen={pdfModalConfig.isOpen}
        section={section}
        labs={labs}
        reservations={reservations}
        initialDayFilter={pdfModalConfig.initialDayFilter}
        singleReservation={pdfModalConfig.singleReservation}
        onClose={() => setPdfModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};

interface MiniSlotCellProps {
  slotLabel: string;
  slotIndex: number;
  day: Day;
  period: number;
  reservation?: Reservation;
  labs: Lab[];
  isTechFull: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  conflict?: ConflictAlert;
  hoverBtnBg: string;
  onBook: () => void;
  onCancel: (id: string) => void;
  onViewDetails: (res: Reservation) => void;
  onOpenPdf: (res: Reservation) => void;
}

const MiniSlotCell: React.FC<MiniSlotCellProps> = ({
  slotLabel,
  reservation,
  labs,
  isTechFull,
  isBlocked,
  blockedReason,
  conflict,
  hoverBtnBg,
  onBook,
  onCancel,
  onViewDetails,
  onOpenPdf,
}) => {
  if (reservation) {
    const labObj = labs.find(l => l.id === reservation.labId);
    const labName = labObj ? labObj.name : reservation.labId;

    const formattedDateTime = (() => {
      if (!reservation.createdAt) return '';
      try {
        const d = new Date(reservation.createdAt);
        if (isNaN(d.getTime())) return '';
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${dateStr}, ${timeStr}`;
      } catch {
        return '';
      }
    })();

    const exp = reservation.experimentDetails;

    return (
      <div 
        onClick={() => onViewDetails(reservation)}
        className={`p-2 rounded-xl border text-xs relative group transition shadow-2xs cursor-pointer ${
          conflict 
            ? 'bg-rose-50 border-rose-300 text-rose-950 font-medium' 
            : 'bg-white border-slate-200 text-slate-900 hover:border-indigo-300 hover:shadow-xs'
        }`}
      >
        {/* Header: Lab Name, PDF Button, View & Delete */}
        <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
          <span className="font-bold text-[11px] text-indigo-700 flex items-center gap-1 truncate pr-1">
            <FlaskConical className="w-3 h-3 text-indigo-600 shrink-0" />
            <span className="truncate">{labName}</span>
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Single Experiment PDF Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPdf(reservation);
              }}
              className="px-1.5 py-0.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded font-bold transition flex items-center gap-0.5 text-[9.5px]"
              title="View & Print PDF for this experiment only"
            >
              <FileText className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(reservation);
              }}
              className="p-0.5 text-slate-400 hover:text-indigo-600 rounded transition"
              title="Inspect details"
            >
              <Eye className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel(reservation.id);
              }}
              className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition opacity-80 group-hover:opacity-100"
              title="Cancel reservation"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Details: Teacher & Class */}
        <div className="mt-1 space-y-1 text-[11px]">
          <div className="font-semibold text-slate-800 truncate flex items-center justify-between gap-1">
            <span className="truncate flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{reservation.teacher}</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span className="bg-slate-100 border border-slate-200 px-1 py-0.2 rounded font-medium text-slate-700">
              Cl. {reservation.className}
            </span>

            {/* Teacher Booking Date & Time */}
            {formattedDateTime && (
              <span className="text-[9.5px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.2 rounded flex items-center gap-0.5" title={`Booked on ${formattedDateTime}`}>
                <Clock className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                <span>{formattedDateTime}</span>
              </span>
            )}
          </div>

          {/* Experiment Title */}
          {exp ? (
            <div className="mt-1 pt-1 border-t border-slate-100">
              <div className="text-[10.5px] font-bold text-slate-900 truncate" title={exp.experimentName}>
                🧪 {exp.experimentName.length > 25 ? `${exp.experimentName.slice(0, 25).trim()}...` : exp.experimentName}
              </div>
            </div>
          ) : reservation.subject ? (
            <div className="text-[9.5px] italic text-slate-500 truncate" title={reservation.subject}>
              {reservation.subject.length > 25 ? `${reservation.subject.slice(0, 25).trim()}...` : reservation.subject}
            </div>
          ) : null}
        </div>

        {/* Conflict Alert */}
        {conflict && (
          <div className="mt-1 p-1 rounded bg-rose-100 text-rose-800 text-[10px] font-semibold flex items-center gap-1 truncate">
            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
            <span className="truncate">{conflict.message}</span>
          </div>
        )}
      </div>
    );
  }

  if (isBlocked) {
    return (
      <button
        type="button"
        onClick={onBook}
        className="w-full py-1.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-dashed border-rose-300 text-rose-700 text-[10.5px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
        title={blockedReason ? `Blocked: ${blockedReason}` : 'Locked by Lab Technician'}
      >
        <Lock className="w-3 h-3 text-rose-600 shrink-0" />
        <span>Locked by Tech</span>
      </button>
    );
  }

  if (isTechFull) {
    return (
      <div 
        className="w-full py-1.5 px-2 rounded-lg bg-slate-100/60 border border-slate-200 text-slate-400 text-[10px] font-semibold flex items-center justify-center gap-1 cursor-not-allowed"
        title="3 Labs limit reached for this period."
      >
        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
        <span>Max Labs Booked (3/3)</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onBook}
      className={`w-full py-1.5 px-2 rounded-xl border border-dashed border-slate-300 ${hoverBtnBg} text-slate-500 text-[11px] font-semibold flex items-center justify-center gap-1 transition group cursor-pointer`}
    >
      <Plus className="w-3 h-3 group-hover:scale-110 transition-transform" />
      <span>+ {slotLabel}</span>
    </button>
  );
};

/* RESERVATION DETAIL MODAL COMPONENT */
interface ReservationDetailModalProps {
  reservation: Reservation;
  labs: Lab[];
  onClose: () => void;
  onCancel: (id: string) => void;
  onOpenPdf: (res: Reservation) => void;
}

const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservation,
  labs,
  onClose,
  onCancel,
  onOpenPdf,
}) => {
  const labObj = labs.find(l => l.id === reservation.labId);
  const labName = labObj ? labObj.name : reservation.labId;
  const exp = getEffectiveExperimentDetails(reservation);

  const formattedDateTime = (() => {
    if (!reservation.createdAt) return '';
    try {
      const d = new Date(reservation.createdAt);
      if (isNaN(d.getTime())) return '';
      return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  })();

  const handleDownloadFile = () => {
    if (!exp?.fileUrl) return;
    const link = document.createElement('a');
    link.href = exp.fileUrl;
    link.download = exp.fileName || 'worksheet_file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900">
        
        {/* Modal Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                <FlaskConical className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900">{labName}</h3>
            </div>
            <p className="text-xs text-indigo-600 font-semibold mt-1 capitalize">
              {reservation.day} • Period {reservation.period}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenPdf(reservation)}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Open & Print PDF for this experiment"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Voucher</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg p-1.5 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Details Body */}
        <div className="py-4 space-y-3.5 text-xs">
          
          {/* Teacher & Class */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Teacher</span>
              <span className="font-bold text-slate-900 text-sm">{reservation.teacher}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Class</span>
              <span className="font-bold text-slate-900 text-sm">Class {reservation.className}</span>
            </div>
          </div>

          {/* Booking Timestamp */}
          {formattedDateTime && (
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Booked on: <strong>{formattedDateTime}</strong></span>
            </div>
          )}

          {/* Experiment Information */}
          {exp ? (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Experiment Title</span>
                <p className="text-sm font-extrabold text-slate-900">{exp.experimentName}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-indigo-600" />
                  <span>Required Materials & Chemicals</span>
                </span>
                <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800 text-xs whitespace-pre-wrap">
                  {exp.materialsNeeded || 'Standard lab equipment'}
                </p>
              </div>

              {/* Printed Worksheets & Attached File Card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Printed Worksheets</span>
                  <span className="font-bold text-purple-900 text-xs">
                    {exp.needsPrintedWorksheets ? `🖨️ ${exp.worksheetCopies} Copies Needed` : 'Not Requested'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Worksheet / Video File</span>
                  {exp.fileName && exp.fileUrl ? (
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      className="mt-0.5 text-xs font-bold text-blue-800 hover:text-blue-950 underline flex items-center gap-1 truncate text-left cursor-pointer"
                      title="Click to download file or video"
                    >
                      <Paperclip className="w-3 h-3 shrink-0" />
                      <span className="truncate">{exp.fileName}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">No file uploaded</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Student Groups</span>
                  <span className="font-extrabold text-slate-900">{exp.numberOfGroups} Groups</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Tech Support</span>
                  <span className={`font-extrabold ${exp.needsTechSupport ? 'text-indigo-600' : 'text-slate-600'}`}>
                    {exp.needsTechSupport ? 'Required' : 'Not Needed'}
                  </span>
                </div>
              </div>

              {/* Safety Equipment */}
              {exp.safetyItems && exp.safetyItems.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-600" />
                    <span>Safety Equipment</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {exp.safetyItems.map((item, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tech Notes */}
              {exp.techNotes && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Technician Notes</span>
                  <p className="p-2 rounded bg-amber-50 text-amber-900 border border-amber-200 italic text-[11px]">
                    "{exp.techNotes}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-lg text-slate-500 italic text-center">
              No detailed experiment materials recorded for this reservation.
            </div>
          )}

        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={() => onCancel(reservation.id)}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg border border-rose-200 transition text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Cancel Reservation</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition text-xs cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
