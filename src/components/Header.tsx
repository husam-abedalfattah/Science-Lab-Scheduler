import React, { useEffect, useRef, useState } from 'react';
import {
  FlaskConical,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Plus,
  History,
  ArrowLeft,
  Lock,
  MoreHorizontal,
  Package
} from 'lucide-react';
import { Section } from '../types';
import { SCHOOL_NAME, SCHOOL_LABEL } from '../brand';
import { themeFor } from '../theme';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  currentSection: Section;
  weekNumber: number;
  conflictCount: number;
  isAdminLoggedIn: boolean;
  isScheduleLocked: boolean;
  onSelectSection: (section: Section) => void;
  onReturnToSectionSelect: () => void;
  onOpenQuickBook: () => void;
  onOpenHistory: () => void;
  onOpenMaterials: () => void;
  onOpenAdmin: () => void;
  onOpenConflictResolver: () => void;
  onOpenLockModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSection,
  weekNumber,
  conflictCount,
  isAdminLoggedIn,
  isScheduleLocked,
  onSelectSection,
  onReturnToSectionSelect,
  onOpenQuickBook,
  onOpenHistory,
  onOpenMaterials,
  onOpenAdmin,
  onOpenConflictResolver,
  onOpenLockModal
}) => {
  const isBoys = currentSection === 'boys';
  // The bar takes the school's own colour, so switching school repaints the
  // whole chrome. Steps and their measured contrasts live in src/theme.ts.
  const theme = themeFor(currentSection);
  const boysTheme = themeFor('boys');
  const girlsTheme = themeFor('girls');

  // Print and History used to be `hidden lg:flex`, so they simply vanished on
  // smaller screens with no way to reach them.
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOverflowOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) setIsOverflowOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOverflowOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOverflowOpen]);

  // Dark bar with white type, following the navigation on the school's own site
  // (rsg.edu.sa/RSAlMalqa) -- chrome is a deep brand colour, white surfaces are
  // reserved for content. Which deep colour depends on the school.
  return (
    <header className={`${theme.header} sticky top-0 z-30 shadow-sm print:hidden transition-colors duration-300`}>
      <div className="max-w-[1700px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onReturnToSectionSelect}
            aria-label="Switch school"
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/25 transition flex items-center justify-center shrink-0"
            title="Switch school"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            {/* School identity, then the tool's own name. The logo renders only
                once the artwork is in public/brand/; SCHOOL_NAME below carries
                the identity on its own until then. */}
            <BrandLogo tone="reversed" className="h-9 shrink-0 hidden sm:block" />
            <div className="w-9 h-9 bg-white/15 border border-white/25 rounded-lg flex items-center justify-center text-white shrink-0 sm:hidden">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-none truncate">
                Science Lab Scheduler
              </h1>
              <p className={`text-xs ${theme.headerMuted} font-semibold mt-1 flex items-center gap-1.5`}>
                <span className="text-white/70 hidden lg:inline">{SCHOOL_NAME}</span>
                <span className="text-white/40 hidden lg:inline" aria-hidden="true">
                  ·
                </span>
                <span>{SCHOOL_LABEL[currentSection]}</span>
                <span className="text-white/40" aria-hidden="true">·</span>
                <span className="text-white/70">Week {weekNumber}</span>
                {isScheduleLocked && (
                  <span className="inline-flex items-center gap-1 text-brand-coral-300 font-bold">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span>Locked</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="School"
            className="hidden md:flex bg-white/10 p-1 rounded-lg border border-white/20 text-xs font-medium ml-2 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isBoys}
              onClick={() => onSelectSection('boys')}
              className={`px-3 py-1.5 rounded-md transition ${
                isBoys ? `${boysTheme.tabActive} font-bold` : 'text-white/75 hover:text-white'
              }`}
            >
              {SCHOOL_LABEL.boys}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isBoys}
              onClick={() => onSelectSection('girls')}
              className={`px-3 py-1.5 rounded-md transition ${
                !isBoys ? `${girlsTheme.tabActive} font-bold` : 'text-white/75 hover:text-white'
              }`}
            >
              {SCHOOL_LABEL.girls}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Primary action, styled after the "Apply Now" pill on the school
              site: Electric Green on the green bar. Their version puts white
              on it at 2.6:1, so this uses dark ink instead. */}
          <button
            type="button"
            onClick={onOpenQuickBook}
            className={`flex items-center gap-1.5 ${theme.pill} px-3.5 py-2 rounded-full text-sm font-bold shadow-xs transition`}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Book Lab</span>
          </button>

          {conflictCount > 0 && (
            <button
              type="button"
              onClick={onOpenConflictResolver}
              className="flex items-center gap-1.5 bg-brand-yellow-400 hover:bg-brand-yellow-300 px-3 py-2 rounded-lg text-sm font-semibold text-brand-yellow-950 transition"
              title="Review scheduling conflicts"
            >
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span>
                {conflictCount} <span className="hidden sm:inline">conflicts</span>
              </span>
            </button>
          )}

          {/* The lab technician blocks periods, and they do not hold the admin
              password -- gating this meant blocks simply never got recorded. */}
          <button
            type="button"
            onClick={onOpenLockModal}
            className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-brand-coral-200 border border-white/25 px-3 py-2 rounded-lg text-sm font-semibold transition"
            title="Block a period so nobody can book the lab then"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span className="hidden lg:inline">Lock Period</span>
          </button>

          <button
            type="button"
            onClick={onOpenAdmin}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition border ${
              isAdminLoggedIn
                ? 'bg-white text-slate-900 border-white'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/25'
            }`}
            title="Open admin dashboard and statistics"
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{isAdminLoggedIn ? 'Admin Active' : 'Admin'}</span>
          </button>

          <div className="relative" ref={overflowRef}>
            <button
              type="button"
              onClick={() => setIsOverflowOpen(v => !v)}
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={isOverflowOpen}
              className="flex items-center justify-center bg-white/10 hover:bg-white/20 text-white border border-white/25 p-2 rounded-lg transition"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isOverflowOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40"
              >
                {/* The stockroom is a lookup everyone needs -- "where is the
                    sodium hydroxide" -- so it sits with the other read actions,
                    not behind the admin panel. */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOverflowOpen(false);
                    onOpenMaterials();
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <Package className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>Lab materials</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOverflowOpen(false);
                    onOpenHistory();
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <History className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>Weekly archives</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOverflowOpen(false);
                    window.print();
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <Printer className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>Print schedule</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOverflowOpen(false);
                    onOpenLockModal();
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-brand-coral-800 hover:bg-brand-coral-50 flex items-center gap-2.5 sm:hidden"
                >
                  <Lock className="w-4 h-4 text-brand-coral-600" aria-hidden="true" />
                  <span>Lock / block period</span>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOverflowOpen(false);
                    onSelectSection(isBoys ? 'girls' : 'boys');
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 md:hidden"
                >
                  Switch to {SCHOOL_LABEL[isBoys ? 'girls' : 'boys']}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
