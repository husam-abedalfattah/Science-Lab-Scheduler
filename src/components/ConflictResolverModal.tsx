import React from 'react';
import { X, AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';
import { ConflictAlert } from '../types';
import { useModalA11y } from '../hooks/useModalA11y';

interface ConflictResolverModalProps {
  isOpen: boolean;
  conflicts: ConflictAlert[];
  onClose: () => void;
  onCancelReservation: (reservationId: string) => void;
}

const TYPE_LABELS: Record<ConflictAlert['type'], string> = {
  teacher_double_booked: 'Teacher clash',
  class_double_booked: 'Class clash',
  lab_overbooked: 'Capacity'
};

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  isOpen,
  conflicts,
  onClose,
  onCancelReservation
}) => {
  const panelRef = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  const renderConflict = (conf: ConflictAlert, index: number) => {
    // Cross-section alerts carry only reservationId1; same-slot clashes carry
    // both. Either way there is now always something to act on.
    const resolvableId = conf.reservationId2 || conf.reservationId1;
    const isError = conf.severity === 'error';

    return (
      <div
        key={`${conf.type}-${conf.day}-${conf.period}-${conf.entityName}-${index}`}
        className={`rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-l-4 ${
          isError ? 'bg-brand-coral-50 border-brand-coral-600' : 'bg-brand-yellow-50 border-brand-yellow-500'
        }`}
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs uppercase font-bold px-2 py-0.5 rounded border ${
                isError
                  ? 'bg-brand-coral-200 text-brand-coral-900 border-brand-coral-300'
                  : 'bg-brand-yellow-200 text-brand-yellow-900 border-brand-yellow-300'
              }`}
            >
              {TYPE_LABELS[conf.type]}
            </span>
            {conf.period > 0 && (
              <span className="text-sm font-semibold text-slate-800 capitalize">
                {conf.day} · Period {conf.period}
              </span>
            )}
          </div>
          <p className={`text-sm font-medium ${isError ? 'text-brand-coral-950' : 'text-brand-yellow-950'}`}>
            {conf.message}
          </p>
        </div>

        {resolvableId && (
          <button
            type="button"
            onClick={() => onCancelReservation(resolvableId)}
            className="px-3 py-2 rounded-lg bg-brand-coral-700 hover:bg-brand-coral-800 text-white text-sm font-semibold transition flex items-center gap-1.5 shrink-0"
            title="Cancel the conflicting booking"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span>Cancel booking</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-modal-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col text-slate-900"
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-yellow-100 text-brand-yellow-800">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="conflict-modal-title" className="text-lg font-bold text-slate-900">
                Scheduling conflicts
              </h2>
              <p className="text-sm text-slate-600">
                Double-bookings, room clashes and technician overload.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conflicts"
            className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pr-1 space-y-4 my-2">
          {conflicts.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 p-6">
              <CheckCircle2 className="w-10 h-10 text-brand-green-600 mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">No conflicts detected</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                No teacher or class is double-booked and every room is within capacity.
              </p>
            </div>
          ) : (
            <>
              {errors.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-brand-coral-800">
                    Must fix ({errors.length})
                  </h3>
                  {errors.map(renderConflict)}
                </section>
              )}

              {warnings.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-brand-yellow-800">
                    Worth checking ({warnings.length})
                  </h3>
                  {warnings.map(renderConflict)}
                </section>
              )}
            </>
          )}
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white text-sm font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
