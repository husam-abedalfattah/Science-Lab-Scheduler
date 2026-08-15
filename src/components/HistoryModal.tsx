import React, { Suspense, lazy, useState } from 'react';
import { X, History, Calendar, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { Lab, Reservation, Section, SectionData } from '../types';
import { getEffectiveExperimentDetails, NOT_SPECIFIED } from '../utils/experimentUtils';
import { useModalA11y } from '../hooks/useModalA11y';
import { SCHOOL_LABEL } from '../brand';

// Same ~700 KB jspdf/html2canvas bundle the grid defers; no reason to pull it
// in just because someone opened the archive list.
const PdfReportModal = lazy(() =>
  import('./PdfReportModal').then(m => ({ default: m.PdfReportModal }))
);

interface HistoryModalProps {
  isOpen: boolean;
  section: Section;
  sectionData: SectionData;
  labs: Lab[];
  onClose: () => void;
}

const DAY_ORDER: Record<string, number> = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5
};

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  section,
  sectionData,
  labs,
  onClose
}) => {
  const panelRef = useModalA11y(isOpen, onClose);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  /**
   * An archived week could be expanded into a summary table but never taken any
   * further -- there was no way to print one or hand it to anyone. This feeds
   * the archived reservations into the same requisition report the live
   * schedule uses, so a filed week stays as usable as a current one.
   */
  const [reportFor, setReportFor] = useState<Record<string, Reservation[]> | null>(null);

  if (!isOpen) return null;

  const history = sectionData.history || [];

  const formatArchivedDate = (raw: string) => {
    const d = new Date(raw);
    return isNaN(d.getTime())
      ? raw
      : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
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
        aria-labelledby="history-modal-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col text-slate-900"
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-kingdom-100 text-brand-kingdom-700">
              <History className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="history-modal-title" className="text-lg font-bold text-slate-900">
                Weekly archives
              </h2>
              <p className="text-sm text-slate-600">
                Past schedules for {SCHOOL_LABEL[section]}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close archives"
            className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pr-1 space-y-3 my-2">
          {history.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 p-6">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">No archived weeks yet</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Use “Archive and start new week” in the admin panel and the current schedule will
                appear here.
              </p>
            </div>
          ) : (
            history.map((archive, idx) => {
              const rows: Reservation[] = [];
              Object.values(archive.reservations || {}).forEach(list => {
                if (Array.isArray(list)) rows.push(...list);
              });
              rows.sort(
                (a, b) =>
                  (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99) || a.period - b.period
              );

              const isExpanded = expandedWeek === archive.week;

              return (
                <div
                  key={`${archive.week}-${idx}`}
                  className="bg-slate-50 border border-slate-300 rounded-xl overflow-hidden"
                >
                  {/* The archive contents were stored but had no way to be
                      opened -- only a slot count was shown. */}
                  <button
                    type="button"
                    onClick={() => setExpandedWeek(isExpanded ? null : archive.week)}
                    aria-expanded={isExpanded}
                    className="w-full p-4 flex justify-between items-center gap-3 text-left hover:bg-slate-100 transition"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-brand-kingdom-800">
                          Week {archive.week}
                        </span>
                        <span className="text-xs text-slate-600">
                          archived {formatArchivedDate(archive.dateArchived)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">
                        <span className="font-bold text-slate-900">{rows.length}</span> reservation
                        {rows.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-600 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  {rows.length > 0 && (
                    <div className="px-4 pb-3 -mt-1">
                      <button
                        type="button"
                        onClick={() => setReportFor(archive.reservations || {})}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition"
                      >
                        <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Open requisition report for week {archive.week}</span>
                      </button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="border-t border-slate-300 bg-white overflow-x-auto">
                      {rows.length === 0 ? (
                        <p className="p-4 text-sm text-slate-600 text-center">
                          This week was archived with no reservations.
                        </p>
                      ) : (
                        <table className="w-full text-left text-sm border-collapse min-w-[560px]">
                          <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                            <tr>
                              <th scope="col" className="p-2.5">Slot</th>
                              <th scope="col" className="p-2.5">Teacher &amp; class</th>
                              <th scope="col" className="p-2.5">Lab</th>
                              <th scope="col" className="p-2.5">Experiment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {rows.map((res, i) => {
                              const labName = labs.find(l => l.id === res.labId)?.name || res.labId;
                              const exp = getEffectiveExperimentDetails(res);
                              return (
                                <tr key={`${res.id}-${i}`} className="hover:bg-slate-50">
                                  <td className="p-2.5 capitalize font-semibold text-brand-kingdom-800">
                                    {res.day} · P{res.period}
                                  </td>
                                  <td className="p-2.5 text-slate-800">
                                    {res.teacher}
                                    <span className="text-slate-600"> · {res.className}</span>
                                  </td>
                                  <td className="p-2.5 text-slate-800">{labName}</td>
                                  <td className="p-2.5 text-slate-800">
                                    {exp.experimentName || (
                                      <span className="text-slate-500">{NOT_SPECIFIED}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>

      {reportFor && (
        <Suspense fallback={null}>
          <PdfReportModal
            isOpen
            section={section}
            labs={labs}
            reservations={reportFor}
            onClose={() => setReportFor(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
