import React from 'react';
import { X, History, Calendar, CheckCircle2 } from 'lucide-react';
import { SectionData } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  sectionData: SectionData;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  sectionData,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-lg shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col font-sans text-slate-900">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-indigo-100 text-indigo-700 border border-indigo-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Weekly Archives & History Log</h3>
              <p className="text-xs text-slate-500 font-mono">
                Review past weekly lab schedule snapshots for {sectionData.name}.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded p-1.5 transition border border-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-grow overflow-y-auto pr-1 space-y-3 my-2 font-mono">
          {sectionData.history.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded border-2 border-slate-200 p-6">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-900 uppercase tracking-wider">No Archived Weeks Yet</h4>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                When you click "Open Next Week" in the Admin panel, the current schedule will be archived here.
              </p>
            </div>
          ) : (
            sectionData.history.map((archive, idx) => {
              // Count total reservations in archive
              let totalRes = 0;
              Object.values(archive.reservations).forEach(list => {
                if (Array.isArray(list)) totalRes += list.length;
              });

              return (
                <div 
                  key={idx}
                  className="bg-slate-50 border border-slate-300 rounded p-4 flex justify-between items-center shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                        Week {archive.week} Snapshot
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Archived {archive.dateArchived}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">
                      Total Completed Reservations: <span className="text-slate-900 font-bold">{totalRes} slots</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Archived</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t-2 border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold uppercase tracking-wider transition"
          >
            Close History
          </button>
        </div>

      </div>
    </div>
  );
};
