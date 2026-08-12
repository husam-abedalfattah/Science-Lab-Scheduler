import React from 'react';
import { Search, Filter, Layers, CheckCircle, Activity, X } from 'lucide-react';
import { Lab } from '../types';

interface StatsBarProps {
  totalBookings: number;
  totalLabs: number;
  conflictCount: number;
  labsList: Lab[];
  searchQuery: string;
  selectedLabFilter: string;
  onSearchChange: (q: string) => void;
  onLabFilterChange: (labId: string) => void;
  onResetFilters: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalBookings,
  totalLabs,
  labsList,
  searchQuery,
  selectedLabFilter,
  onSearchChange,
  onLabFilterChange,
  onResetFilters,
}) => {
  // Total potential capacity = 5 days * 7 periods * totalLabs * 2 slots per period
  const totalCapacity = 5 * 7 * totalLabs * 2;
  const utilizationPct = Math.round((totalBookings / totalCapacity) * 100);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs mb-5 print:hidden">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-slate-900">{totalBookings}</span>
            <span className="text-slate-500">Bookings</span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2 text-slate-700">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-900">{totalLabs}</span>
            <span className="text-slate-500">Labs</span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2 text-slate-700">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-900">{utilizationPct}%</span>
            <span className="text-slate-500">Occupied</span>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter teacher or class..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition"
            />
          </div>

          {/* Lab Select Filter */}
          <div className="relative md:w-44">
            <Filter className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedLabFilter}
              onChange={(e) => onLabFilterChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="ALL">All Labs</option>
              {labsList.map(lab => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
            </select>
          </div>

          {(searchQuery || selectedLabFilter !== 'ALL') && (
            <button
              onClick={onResetFilters}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
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

