import React from 'react';
import { Search, Filter, Layers, CheckCircle, Activity, X, AlertTriangle, Users } from 'lucide-react';
import { Lab } from '../types';
import { WEEKLY_SLOT_CAPACITY, MAX_CONCURRENT_LABS_PER_PERIOD } from '../constants';

interface StatsBarProps {
  totalBookings: number;
  totalLabs: number;
  conflictCount: number;
  labsList: Lab[];
  searchQuery: string;
  selectedLabFilter: string;
  selectedTeacherFilter: string;
  teachersList: string[];
  onSearchChange: (q: string) => void;
  onLabFilterChange: (labId: string) => void;
  onTeacherFilterChange: (teacher: string) => void;
  onResetFilters: () => void;
  onOpenConflicts: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalBookings,
  totalLabs,
  conflictCount,
  labsList,
  searchQuery,
  selectedLabFilter,
  selectedTeacherFilter,
  teachersList,
  onSearchChange,
  onLabFilterChange,
  onTeacherFilterChange,
  onResetFilters,
  onOpenConflicts
}) => {
  /**
   * Capacity is bounded by what the technician can cover, not by the number of
   * rooms. The old formula (days x periods x labs x 2) reported 350 slots for
   * five labs against a real ceiling of 105, understating occupancy ~3x.
   */
  const utilizationPct = Math.min(
    100,
    Math.round((totalBookings / WEEKLY_SLOT_CAPACITY) * 100)
  );

  const hasFilters =
    Boolean(searchQuery) || selectedLabFilter !== 'ALL' || selectedTeacherFilter !== 'ALL';

  return (
    <div className="stats-bar-container bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs mb-5 print:hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle className="w-4 h-4 text-brand-kingdom-600" aria-hidden="true" />
            <span className="font-bold text-slate-900">{totalBookings}</span>
            <span className="text-slate-600">booked</span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

          <div className="flex items-center gap-2 text-slate-700">
            <Layers className="w-4 h-4 text-slate-600" aria-hidden="true" />
            <span className="font-bold text-slate-900">{totalLabs}</span>
            <span className="text-slate-600">labs</span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

          <div
            className="flex items-center gap-2 text-slate-700"
            title={`${totalBookings} of ${WEEKLY_SLOT_CAPACITY} weekly slots (${MAX_CONCURRENT_LABS_PER_PERIOD} concurrent labs per period)`}
          >
            <Activity className="w-4 h-4 text-brand-green-600" aria-hidden="true" />
            <span className="font-bold text-slate-900">{utilizationPct}%</span>
            <span className="text-slate-600">
              of capacity
              <span className="text-slate-400 hidden lg:inline"> ({totalBookings}/{WEEKLY_SLOT_CAPACITY})</span>
            </span>
          </div>

          {conflictCount > 0 && (
            <>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />
              <button
                type="button"
                onClick={onOpenConflicts}
                className="flex items-center gap-1.5 text-brand-yellow-900 bg-brand-yellow-50 border border-brand-yellow-300 hover:bg-brand-yellow-100 px-2.5 py-1 rounded-lg font-semibold transition"
              >
                <AlertTriangle className="w-4 h-4 text-brand-yellow-700" aria-hidden="true" />
                <span>
                  {conflictCount} conflict{conflictCount === 1 ? '' : 's'}
                </span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <label htmlFor="schedule-search" className="sr-only">
              Filter by teacher, class, lab or experiment
            </label>
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="schedule-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Teacher, class, lab or experiment…"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 focus:border-brand-kingdom-500 focus:bg-white transition"
            />
          </div>

          <div className="relative md:w-48">
            <label htmlFor="teacher-filter" className="sr-only">
              Show one teacher's schedule
            </label>
            <Users
              className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="teacher-filter"
              value={selectedTeacherFilter}
              onChange={(e) => onTeacherFilterChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 focus:border-brand-kingdom-500 focus:bg-white transition cursor-pointer"
            >
              <option value="ALL">All teachers</option>
              {teachersList.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-grow min-w-[10rem]">
            <label htmlFor="lab-filter" className="sr-only">
              Filter by lab
            </label>
            <Filter
              className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="lab-filter"
              value={selectedLabFilter}
              onChange={(e) => onLabFilterChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 focus:border-brand-kingdom-500 focus:bg-white transition cursor-pointer"
            >
              <option value="ALL">All labs</option>
              {labsList.map(lab => (
                <option key={lab.id} value={lab.id}>
                  {lab.name}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Clear filters"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition shrink-0"
              title="Clear filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
