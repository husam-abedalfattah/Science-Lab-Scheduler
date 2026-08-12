import React from 'react';
import { FlaskConical, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { Section } from '../types';

interface SectionSelectorProps {
  onSelectSection: (section: Section) => void;
  onOpenAdmin: () => void;
}

export const SectionSelector: React.FC<SectionSelectorProps> = ({
  onSelectSection,
  onOpenAdmin,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-lg text-center space-y-6">
        
        {/* Logo */}
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xs">
          <FlaskConical className="w-7 h-7" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Science Lab Scheduler
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Please select your school section to view or book lab sessions.
          </p>
        </div>

        {/* Section Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          
          {/* Boys Section */}
          <button
            onClick={() => onSelectSection('boys')}
            className="group p-6 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-500 rounded-xl transition text-center flex flex-col items-center justify-center shadow-2xs"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              Boys Section
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              View & Book Schedule
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-600">
              <span>Select</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Girls Section */}
          <button
            onClick={() => onSelectSection('girls')}
            className="group p-6 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-500 rounded-xl transition text-center flex flex-col items-center justify-center shadow-2xs"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              Girls Section
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              View & Book Schedule
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-600">
              <span>Select</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

        </div>

        {/* Footer Admin Link */}
        <div className="pt-4 border-t border-slate-200 flex justify-center items-center">
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-lg transition"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Admin Settings</span>
          </button>
        </div>

      </div>
    </div>
  );
};

