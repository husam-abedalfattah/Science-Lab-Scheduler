import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, Users, Calendar, FlaskConical, Clock, LayoutGrid, Filter } from 'lucide-react';
import { Day, Lab, Reservation, ConflictAlert, Section } from '../types';
import { DAYS_LIST, PERIODS_LIST } from '../data/initialData';

interface ScheduleGridProps {
  section: Section;
  labs: Lab[];
  reservations: Record<string, Reservation[]>;
  conflicts: ConflictAlert[];
  searchQuery: string;
  selectedLabFilter: string;
  onQuickBook: (day: Day, period: number, labId: string, slotIndex: number) => void;
  onCancelReservation: (reservationId: string) => void;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  section,
  labs,
  reservations,
  conflicts,
  searchQuery,
  selectedLabFilter,
  onQuickBook,
  onCancelReservation,
}) => {
  const isBoys = section === 'boys';

  // Section specific theme colors
  const primaryBg = isBoys ? 'bg-emerald-600' : 'bg-pink-600';
  const primaryText = isBoys ? 'text-emerald-700' : 'text-pink-700';
  const primaryBorder = isBoys ? 'border-emerald-200' : 'border-pink-200';
  const cardBg = isBoys ? 'bg-emerald-50/60' : 'bg-pink-50/60';
  const badgeBg = isBoys ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-pink-100 text-pink-800 border-pink-200';
  const hoverBtnBg = isBoys ? 'hover:bg-emerald-100 hover:border-emerald-400 text-emerald-800' : 'hover:bg-pink-100 hover:border-pink-400 text-pink-800';

  // State to toggle between Weekly Master Table and Filtered View
  const [selectedDayFilter, setSelectedDayFilter] = useState<Day | 'ALL'>('ALL');

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
      const labObj = labs.find(l => l.id === res.labId);
      const labMatch = labObj ? labObj.name.toLowerCase().includes(q) : false;
      return teacherMatch || classMatch || subjectMatch || labMatch;
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
          </div>
        </div>

        {/* Day Filter Drop-down */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>View Day:</span>
          </div>

          <select
            value={selectedDayFilter}
            onChange={(e) => setSelectedDayFilter(e.target.value as Day | 'ALL')}
            className={`bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 cursor-pointer shadow-2xs min-w-[160px]`}
          >
            <option value="ALL">All Days (Master Table)</option>
            {DAYS_LIST.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>

      </div>

      {/* MASTER TIMETABLE MATRIX (ALL DAYS & ALL PERIODS IN A SINGLE GLIMPSE) */}
      <div className={`bg-white rounded-2xl border ${primaryBorder} shadow-sm overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            
            {/* Table Header Row: Days */}
            <thead>
              <tr className={`${isBoys ? 'bg-emerald-100/70 text-emerald-950' : 'bg-pink-100/70 text-pink-950'} text-xs font-bold border-b ${primaryBorder}`}>
                <th className="py-3.5 px-4 w-28 border-r border-slate-200 text-center font-extrabold uppercase tracking-wider text-slate-700 bg-slate-100/80">
                  Period
                </th>
                {activeDays.map(dayObj => {
                  const activePeriods = getDayActivePeriods(dayObj.id);
                  const isMax = activePeriods >= 5;
                  return (
                    <th key={dayObj.id} className="py-3 px-3 border-r border-slate-200 text-center font-bold text-sm min-w-[170px]">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          <span>{dayObj.label}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
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
                    const isTechFull = techCount >= 2;

                    const slot1Res = cellReservations.find(r => r.slotIndex === 0);
                    const slot2Res = cellReservations.find(r => r.slotIndex === 1);

                    return (
                      <td key={`${dayObj.id}-p${period}`} className="p-2 border-r border-slate-200 align-top bg-white">
                        <div className="space-y-2">
                          
                          {/* Slot 1 */}
                          <MiniSlotCell
                            slotLabel="Slot 1"
                            slotIndex={0}
                            day={dayObj.id}
                            period={period}
                            reservation={slot1Res}
                            labs={labs}
                            isTechFull={isTechFull && !slot1Res}
                            conflict={slot1Res ? getConflictForReservation(slot1Res) : undefined}
                            hoverBtnBg={hoverBtnBg}
                            onBook={() => onQuickBook(dayObj.id, period, labs[0]?.id || 'lab-1', 0)}
                            onCancel={(id) => onCancelReservation(id)}
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
                            conflict={slot2Res ? getConflictForReservation(slot2Res) : undefined}
                            hoverBtnBg={hoverBtnBg}
                            onBook={() => onQuickBook(dayObj.id, period, labs[1]?.id || 'lab-2', 1)}
                            onCancel={(id) => onCancelReservation(id)}
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
  conflict?: ConflictAlert;
  hoverBtnBg: string;
  onBook: () => void;
  onCancel: (id: string) => void;
}

const MiniSlotCell: React.FC<MiniSlotCellProps> = ({
  slotLabel,
  reservation,
  labs,
  isTechFull,
  conflict,
  hoverBtnBg,
  onBook,
  onCancel,
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

    return (
      <div 
        className={`p-2 rounded-xl border text-xs relative group transition shadow-2xs ${
          conflict 
            ? 'bg-rose-50 border-rose-300 text-rose-950 font-medium' 
            : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
        }`}
      >
        {/* Header: Lab Name & Cancel */}
        <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
          <span className="font-bold text-[11px] text-indigo-700 flex items-center gap-1 truncate pr-2">
            <FlaskConical className="w-3 h-3 text-indigo-600 shrink-0" />
            <span className="truncate">{labName}</span>
          </span>

          <button
            onClick={() => onCancel(reservation.id)}
            className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition opacity-80 group-hover:opacity-100"
            title="Cancel reservation"
          >
            <Trash2 className="w-3 h-3" />
          </button>
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

          {reservation.subject && (
            <div className="text-[9.5px] italic text-slate-500 truncate" title={reservation.subject}>
              {reservation.subject}
            </div>
          )}
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

  if (isTechFull) {
    return (
      <div 
        className="w-full py-1.5 px-2 rounded-lg bg-slate-100/60 border border-slate-200 text-slate-400 text-[10px] font-semibold flex items-center justify-center gap-1 cursor-not-allowed"
        title="1 Technician limit reached (2 active labs for this period)."
      >
        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
        <span>Tech Busy (2/2)</span>
      </div>
    );
  }

  return (
    <button
      onClick={onBook}
      className={`w-full py-1.5 px-2 rounded-xl border border-dashed border-slate-300 ${hoverBtnBg} text-slate-500 text-[11px] font-semibold flex items-center justify-center gap-1 transition group`}
    >
      <Plus className="w-3 h-3 group-hover:scale-110 transition-transform" />
      <span>+ {slotLabel}</span>
    </button>
  );
};
