import React from 'react';
import { X, AlertTriangle, ShieldAlert, Trash2, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { ConflictAlert } from '../types';

interface ConflictResolverModalProps {
  isOpen: boolean;
  conflicts: ConflictAlert[];
  onClose: () => void;
  onCancelReservation: (reservationId: string) => void;
  onAutoFixAll?: () => void;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  isOpen,
  conflicts,
  onClose,
  onCancelReservation,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-lg shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col font-sans text-slate-900">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-amber-100 text-amber-800 border border-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Overlap & Conflict Optimizer</h3>
              <p className="text-xs text-slate-500 font-mono">
                Automated check for teacher double-bookings, class collisions, and lab capacity overloads.
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
          {conflicts.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded border-2 border-slate-200 p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-900 uppercase tracking-wider">0 Conflicts Detected</h4>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                All 5 labs and reservation slots are synchronized. No teachers or classes are double-booked.
              </p>
            </div>
          ) : (
            conflicts.map((conf, index) => (
              <div 
                key={`conflict-${index}`}
                className="bg-rose-50 border-l-4 border-rose-600 rounded p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900 border border-rose-300">
                      {conf.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {conf.day.toUpperCase()} • Period {conf.period}
                    </span>
                  </div>
                  <p className="text-xs text-rose-950 font-bold">
                    {conf.message}
                  </p>
                </div>

                {/* Quick Resolve Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-rose-200">
                  {conf.reservationId2 && (
                    <button
                      onClick={() => onCancelReservation(conf.reservationId2!)}
                      className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold uppercase tracking-wider transition flex items-center gap-1.5"
                      title="Remove the 2nd conflicting booking"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Duplicate</span>
                    </button>
                  )}
                  {conf.reservationId1 && !conf.reservationId2 && (
                    <button
                      onClick={() => onCancelReservation(conf.reservationId1!)}
                      className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>

              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t-2 border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold uppercase tracking-wider transition shadow-xs"
          >
            Done Reviewing
          </button>
        </div>

      </div>
    </div>
  );
};
