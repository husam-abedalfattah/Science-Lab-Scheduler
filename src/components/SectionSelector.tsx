import React from 'react';
import { FlaskConical, ArrowRight, ShieldCheck, Package } from 'lucide-react';
import { Section } from '../types';
import { SCHOOL_LABEL } from '../brand';
import { BrandLogo } from './BrandLogo';

interface SectionSelectorProps {
  onSelectSection: (section: Section) => void;
  onOpenAdmin: () => void;
  onOpenMaterials: () => void;
}

/**
 * Both cards used to be identical indigo, so nothing hinted that the app
 * changes colour after the choice. Each card now previews its school's theme:
 * Electric Green for the Boys School, Dark Violet for the Girls School.
 */
const SECTIONS: {
  id: Section;
  label: string;
  card: string;
  icon: string;
  heading: string;
  cta: string;
}[] = [
  {
    id: 'boys',
    label: SCHOOL_LABEL.boys,
    // The card is a colour swatch as much as a button: it is the last chance to
    // notice which school you are about to open.
    card: 'bg-brand-green-200 hover:bg-brand-green-300 border-brand-green-500 hover:border-brand-green-800',
    icon: 'bg-brand-green-800 text-white',
    heading: 'group-hover:text-brand-green-900',
    cta: 'text-brand-green-900'
  },
  {
    id: 'girls',
    label: SCHOOL_LABEL.girls,
    card: 'bg-brand-violet-200 hover:bg-brand-violet-300 border-brand-violet-500 hover:border-brand-violet-800',
    icon: 'bg-brand-violet-600 text-white',
    heading: 'group-hover:text-brand-violet-900',
    cta: 'text-brand-violet-900'
  }
];

export const SectionSelector: React.FC<SectionSelectorProps> = ({
  onSelectSection,
  onOpenAdmin,
  onOpenMaterials
}) => (
  /* No school has been chosen yet, so this screen wears the institutional
     Kingdom Green rather than either school's colour -- the same ground the
     school's own site uses behind its hero. The card sits on top of it, so the
     page is never a field of empty white. */
  <div className="min-h-screen bg-brand-kingdom-700 brand-texture brand-texture-kingdom text-white flex flex-col items-center justify-center p-4 font-sans">
    {/* The ground is dark, so the page default is white text and the card
        re-establishes dark text for its own contents. Setting slate-900 on the
        wrapper instead left anything placed directly on the green at 2.47:1. */}
    <main className="max-w-xl w-full bg-white text-slate-900 rounded-2xl p-8 sm:p-10 shadow-2xl text-center space-y-6">
      {/* Landing screen -- the school comes first, the tool second. The lockup
          already carries the name in both languages, so it is not repeated as
          text underneath. */}
      <div className="flex justify-center">
        <BrandLogo tone="dark" className="h-24" />
      </div>

      <div className="flex items-center gap-2 justify-center text-slate-400">
        <span className="h-px w-10 bg-slate-200" aria-hidden="true" />
        <FlaskConical className="w-4 h-4" aria-hidden="true" />
        <span className="h-px w-10 bg-slate-200" aria-hidden="true" />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Science Lab Scheduler</h1>
        <p className="text-sm text-slate-600 mt-1.5">
          Choose your school to view or book lab sessions.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            type="button"
            onClick={() => onSelectSection(sec.id)}
            className={`group p-6 border rounded-xl transition text-center flex flex-col items-center justify-center ${sec.card}`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${sec.icon}`}
            >
              <FlaskConical className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className={`text-base font-bold text-slate-900 transition-colors ${sec.heading}`}>
              {sec.label}
            </h2>
            <p className="text-sm text-slate-600 mt-1">View and book the schedule</p>
            <span className={`mt-3 flex items-center gap-1 text-sm font-semibold ${sec.cta}`}>
              <span>Open</span>
              <ArrowRight
                className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"
                aria-hidden="true"
              />
            </span>
          </button>
        ))}
      </div>

      {/* Finding where something is stored is its own errand, not a footnote to
          picking a timetable -- and it needs no school chosen, since the
          stockroom covers both. Same weight as the two school cards because
          people arrive here for it just as often. */}
      <button
        type="button"
        onClick={onOpenMaterials}
        className="group w-full p-6 border rounded-xl transition text-center flex flex-col items-center justify-center bg-brand-kingdom-100 hover:bg-brand-kingdom-200 border-brand-kingdom-500 hover:border-brand-kingdom-800"
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 bg-brand-kingdom-700 text-white">
          <Package className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-slate-900 transition-colors group-hover:text-brand-kingdom-900">
          Find lab materials
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Search the stockroom in both schools
        </p>
        <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-kingdom-900">
          <span>Open</span>
          <ArrowRight
            className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"
            aria-hidden="true"
          />
        </span>
      </button>

      <div className="pt-4 border-t border-slate-200 flex justify-center">
        <button
          type="button"
          onClick={onOpenAdmin}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-lg transition"
        >
          <ShieldCheck className="w-4 h-4 text-brand-kingdom-700" aria-hidden="true" />
          <span>Admin settings</span>
        </button>
      </div>
    </main>
  </div>
);
