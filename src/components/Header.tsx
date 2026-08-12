import React from 'react';
import { 
  FlaskConical, 
  Printer, 
  ShieldCheck, 
  AlertTriangle,
  Plus,
  History,
  ArrowLeft,
  Lock
} from 'lucide-react';
import { Section } from '../types';

interface HeaderProps {
  currentSection: Section;
  sectionName: string;
  weekNumber: number;
  conflictCount: number;
  isAdminLoggedIn: boolean;
  onSelectSection: (section: Section) => void;
  onReturnToSectionSelect: () => void;
  onOpenQuickBook: () => void;
  onOpenHistory: () => void;
  onOpenAdmin: () => void;
  onOpenConflictResolver: () => void;
  onOpenLockModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSection,
  conflictCount,
  isAdminLoggedIn,
  onSelectSection,
  onReturnToSectionSelect,
  onOpenQuickBook,
  onOpenHistory,
  onOpenAdmin,
  onOpenConflictResolver,
  onOpenLockModal,
}) => {
  const isBoys = currentSection === 'boys';
  const brandBg = isBoys ? 'bg-emerald-600' : 'bg-pink-600';
  const brandText = isBoys ? 'text-emerald-700' : 'text-pink-700';
  const buttonBg = isBoys ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-pink-600 hover:bg-pink-700';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* App Title & Section Switcher */}
        <div className="flex items-center gap-4">
          <button
            onClick={onReturnToSectionSelect}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition flex items-center justify-center text-xs font-medium"
            title="Switch Section"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 ${brandBg} rounded-lg flex items-center justify-center text-white shadow-xs transition-colors`}>
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                Science Lab Scheduler
              </h1>
              <p className={`text-[11px] ${brandText} font-semibold mt-0.5 capitalize`}>
                {currentSection === 'boys' ? 'Boys Section (Green Zone)' : 'Girls Section (Pink Zone)'}
              </p>
            </div>
          </div>

          {/* Section Switcher Tabs */}
          <div className="hidden md:flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium ml-2">
            <button
              onClick={() => onSelectSection('boys')}
              className={`px-3 py-1.5 rounded-md transition ${
                currentSection === 'boys'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Boys Section
            </button>
            <button
              onClick={() => onSelectSection('girls')}
              className={`px-3 py-1.5 rounded-md transition ${
                currentSection === 'girls'
                  ? 'bg-pink-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Girls Section
            </button>
          </div>
        </div>

        {/* Right Section Actions */}
        <div className="flex items-center gap-2.5">
          
          {/* Quick Book Button */}
          <button
            onClick={onOpenQuickBook}
            className={`flex items-center gap-1.5 ${buttonBg} text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition`}
          >
            <Plus className="w-4 h-4" />
            <span>Book Lab</span>
          </button>

          {/* Conflict Alert (if any) */}
          {conflictCount > 0 && (
            <button
              onClick={onOpenConflictResolver}
              className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 px-3 py-2 rounded-lg text-xs font-semibold text-amber-800 transition"
              title="View conflicts"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{conflictCount} Conflicts</span>
            </button>
          )}

          {/* Print */}
          <button
            onClick={() => window.print()}
            className="hidden lg:flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-medium transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>

          {/* History */}
          <button
            onClick={onOpenHistory}
            className="hidden lg:flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-medium transition"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>History</span>
          </button>

          {/* Lock / Block Period */}
          <button
            onClick={onOpenLockModal}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
            title="Lock or Block Periods with Technician Notes"
          >
            <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="hidden sm:inline">Lock / Block Period</span>
          </button>

          {/* Admin & Statistics */}
          <button
            onClick={onOpenAdmin}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition border cursor-pointer ${
              isAdminLoggedIn 
                ? 'bg-indigo-900 text-white border-indigo-900 shadow-2xs' 
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
            }`}
            title="Open Admin Dashboard & Teacher Experiment Statistics"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="hidden sm:inline">{isAdminLoggedIn ? 'Admin Active' : 'Admin & Statistics'}</span>
          </button>

        </div>

      </div>
    </header>
  );
};


