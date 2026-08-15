import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Printer, FileText, Paperclip } from 'lucide-react';
import { Reservation, Lab, Section, Day } from '../types';
import { DAYS_LIST } from '../data/initialData';
import { getEffectiveExperimentDetails, NOT_SPECIFIED } from '../utils/experimentUtils';
import {
  SCHOOL_NAME,
  SCHOOL_NAME_AR,
  DEPARTMENT_NAME,
  SCHOOL_LABEL,
  GROUP_AFFILIATION,
  GROUP_AFFILIATION_AR
} from '../brand';
import { useModalA11y } from '../hooks/useModalA11y';
import { BrandLogo } from './BrandLogo';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PdfReportModalProps {
  isOpen: boolean;
  section: Section;
  labs: Lab[];
  reservations: Record<string, Reservation[]>;
  initialDayFilter?: Day | 'ALL';
  singleReservation?: Reservation | null;
  onClose: () => void;
}

const DAY_ORDER: Record<string, number> = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5
};

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  section,
  labs,
  reservations,
  initialDayFilter = 'ALL',
  singleReservation: initialSingleRes = null,
  onClose
}) => {
  const panelRef = useModalA11y(isOpen, onClose);
  const reportRef = useRef<HTMLDivElement>(null);

  const [selectedDayFilter, setSelectedDayFilter] = useState<Day | 'ALL'>(initialDayFilter);
  const [activeSingleRes, setActiveSingleRes] = useState<Reservation | null>(initialSingleRes);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    setActiveSingleRes(initialSingleRes || null);
    setSelectedDayFilter(initialDayFilter);
    setExportError('');
  }, [initialSingleRes, initialDayFilter, isOpen]);

  if (!isOpen) return null;

  const sectionTitle = SCHOOL_LABEL[section];

  const allReservationsList: Reservation[] = [];
  Object.values(reservations).forEach(list => {
    if (Array.isArray(list)) allReservationsList.push(...list);
  });

  const displayList = (
    activeSingleRes
      ? [activeSingleRes]
      : allReservationsList.filter(
          res => selectedDayFilter === 'ALL' || res.day === selectedDayFilter
        )
  )
    .slice()
    .sort(
      (a, b) =>
        (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99) ||
        a.period - b.period ||
        a.labId.localeCompare(b.labId)
    );

  const handleDownloadSingleFile = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'experiment_attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /** Sanitises oklch() colours, which html2canvas cannot parse. */
  const replaceOklchInString = (str: string): string => {
    if (!str || !str.includes('oklch')) return str;

    const ctx = document.createElement('canvas').getContext('2d');

    return str.replace(/oklch\([^)]+\)/gi, (match) => {
      if (ctx) {
        try {
          ctx.fillStyle = '#000000';
          ctx.fillStyle = match;
          const resolved = ctx.fillStyle;
          if (resolved && !resolved.includes('oklch')) return resolved;
        } catch {
          /* fall through to manual conversion */
        }
      }

      const m = match.match(
        /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)%?)?\s*\)/i
      );
      // Last-resort fallback for an oklch() we cannot parse. Kingdom Green
      // (#006166) so an unparseable colour still lands inside the identity.
      if (!m) return 'rgb(0, 97, 102)';

      let l = parseFloat(m[1]);
      if (m[1].includes('%')) l /= 100;
      const c = parseFloat(m[2]);
      const h = parseFloat(m[3]);
      let alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
      if (m[4]?.includes('%')) alpha /= 100;

      const hRad = (h * Math.PI) / 180;
      const a = c * Math.cos(hRad);
      const b = c * Math.sin(hRad);

      const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = l - 0.0894841775 * a - 1.291485548 * b;

      const L = l_ ** 3;
      const M = m_ ** 3;
      const S = s_ ** 3;

      const toSrgb = (v: number) =>
        Math.min(
          255,
          Math.max(0, Math.round((v >= 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v) * 255))
        );

      const R = toSrgb(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S);
      const G = toSrgb(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S);
      const B = toSrgb(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S);

      return alpha < 1 ? `rgba(${R}, ${G}, ${B}, ${alpha})` : `rgb(${R}, ${G}, ${B})`;
    });
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current || isGenerating) return;
    setIsGenerating(true);
    setExportError('');

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('style').forEach((styleTag) => {
            if (styleTag.textContent?.includes('oklch')) {
              styleTag.textContent = replaceOklchInString(styleTag.textContent);
            }
          });

          const colorProps = [
            'color',
            'backgroundColor',
            'borderColor',
            'borderTopColor',
            'borderRightColor',
            'borderBottomColor',
            'borderLeftColor',
            'outlineColor',
            'fill',
            'stroke',
            'boxShadow',
            'textDecorationColor'
          ];

          clonedDoc.querySelectorAll('*').forEach((el) => {
            const htmlEl = el as HTMLElement;
            const styleAttr = htmlEl.getAttribute('style');
            if (styleAttr?.includes('oklch')) {
              htmlEl.setAttribute('style', replaceOklchInString(styleAttr));
            }
            try {
              const computed = window.getComputedStyle(htmlEl);
              colorProps.forEach((prop) => {
                const val = computed.getPropertyValue(prop);
                if (val?.includes('oklch')) {
                  htmlEl.style.setProperty(prop, replaceOklchInString(val), 'important');
                }
              });
            } catch {
              /* ignore */
            }
          });
        }
      });

      const isLandscape = selectedDayFilter === 'ALL' && !activeSingleRes;
      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      /**
       * Each page gets its own cropped slice of the canvas. The previous
       * version re-added the entire full-height image on every page with a
       * negative offset, so a four-page report embedded the same bitmap four
       * times and the file grew linearly with page count.
       */
      const pageHeightPx = Math.floor((canvas.width * pdfHeight) / pdfWidth);
      const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

      for (let page = 0; page < pageCount; page += 1) {
        const sliceTop = page * pageHeightPx;
        const sliceHeight = Math.min(pageHeightPx, canvas.height - sliceTop);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext('2d');
        if (!ctx) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          sliceTop,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        if (page > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL('image/jpeg', 0.92),
          'JPEG',
          0,
          0,
          pdfWidth,
          (sliceHeight * pdfWidth) / canvas.width
        );
      }

      const suffix = activeSingleRes
        ? `Single_${activeSingleRes.teacher.replace(/\s+/g, '_')}`
        : selectedDayFilter;

      pdf.save(`Lab_Report_${section}_${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setExportError('Could not generate the PDF. Try the Print button instead.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add('pdf-modal-printing');
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove('pdf-modal-printing'), 1000);
    }, 50);
  };

  return (
    <div
      className="pdf-report-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:p-0 print:static print:bg-white print:z-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-modal-title"
        className="pdf-report-modal-content bg-white border border-slate-300 rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none print:p-0"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 pb-4 border-b border-slate-200 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-brand-kingdom-100 text-brand-kingdom-700 rounded-xl">
                <FileText className="w-5 h-5" aria-hidden="true" />
              </span>
              <h2 id="pdf-modal-title" className="text-lg font-bold text-slate-900">
                {activeSingleRes ? 'Experiment requisition' : 'Requisition report'}
              </h2>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {activeSingleRes
                ? `${activeSingleRes.teacher} · Class ${activeSingleRes.className}`
                : `${displayList.length} session${displayList.length === 1 ? '' : 's'} · ${
                    selectedDayFilter === 'ALL' ? 'all days' : selectedDayFilter
                  }`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {activeSingleRes ? (
              <button
                type="button"
                onClick={() => setActiveSingleRes(null)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold transition border border-slate-300"
              >
                ← All sessions
              </button>
            ) : (
              <>
                <label htmlFor="pdf-day-filter" className="sr-only">
                  Filter report by day
                </label>
                <select
                  id="pdf-day-filter"
                  value={selectedDayFilter}
                  onChange={(e) => setSelectedDayFilter(e.target.value as Day | 'ALL')}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 cursor-pointer"
                >
                  <option value="ALL">All days</option>
                  {DAYS_LIST.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm flex items-center gap-1.5 transition border border-slate-300"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl text-sm flex items-center gap-1.5 transition disabled:opacity-60"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>{isGenerating ? 'Generating…' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close report"
              className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl p-2 transition border border-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {exportError && (
          <p
            role="alert"
            className="mb-4 text-sm font-semibold text-brand-coral-800 bg-brand-coral-50 border border-brand-coral-300 rounded-lg px-3 py-2 print:hidden"
          >
            {exportError}
          </p>
        )}

        {/* PRINTABLE BODY */}
        <div
          ref={reportRef}
          className="rsm-official-report p-6 sm:p-10 bg-white text-slate-900 border border-brand-kingdom-700 print:border-none print:p-0"
        >
          {/* Document masthead. The per-session forms below each carry their own,
              but the summary table was reaching the technician with no school
              identity on it at all. Same lockup, same bilingual name, same rule
              as the brand book's letterhead template. */}
          {!activeSingleRes && displayList.length > 0 && (
            <div className="mb-6 pb-4 border-b-2 border-brand-kingdom-700 flex items-end justify-between gap-4 break-inside-avoid">
              <div className="flex items-center gap-3 min-w-0">
                <BrandLogo tone="dark" className="h-14 shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg font-black text-brand-kingdom-700 leading-tight truncate">
                    {SCHOOL_NAME}
                  </p>
                  <p
                    className="text-sm font-bold text-brand-kingdom-700 leading-tight"
                    lang="ar"
                    dir="rtl"
                  >
                    {SCHOOL_NAME_AR}
                  </p>
                  <p className="text-xs text-slate-700 mt-0.5">{DEPARTMENT_NAME}</p>
                </div>
              </div>
              <div className="text-right text-xs text-slate-800 shrink-0">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-900">
                  Equipment requisition
                </p>
                <p className="mt-0.5">{sectionTitle}</p>
                <p className="mt-0.5">
                  {new Date().toLocaleDateString([], {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}

          {!activeSingleRes && displayList.length > 0 && (
            <div className="mb-10 border border-brand-kingdom-700 break-inside-avoid">
              <div className="bg-brand-kingdom-700 text-white p-3 font-bold text-xs uppercase tracking-wide flex justify-between items-center gap-2">
                <span>Requisition summary</span>
                <span className="font-normal">{displayList.length} sessions</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-kingdom-100 text-brand-kingdom-950 font-bold border-b border-brand-kingdom-700">
                    <th scope="col" className="p-2.5 border-r border-brand-kingdom-300 w-2/5">Experiment</th>
                    <th scope="col" className="p-2.5 border-r border-brand-kingdom-300 w-1/4">Slot</th>
                    <th scope="col" className="p-2.5 border-r border-brand-kingdom-300 w-1/6">Class</th>
                    <th scope="col" className="p-2.5">Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-kingdom-200 bg-white">
                  {displayList.map((res, i) => {
                    const exp = getEffectiveExperimentDetails(res);
                    const labName = labs.find(l => l.id === res.labId)?.name || res.labId;
                    return (
                      <tr key={`${res.id}-${i}`}>
                        <td className="p-2.5 border-r border-brand-kingdom-200 font-bold text-slate-900">
                          {exp.experimentName || NOT_SPECIFIED}
                        </td>
                        <td className="p-2.5 border-r border-brand-kingdom-200 text-slate-800 capitalize">
                          {res.day} (P{res.period}) · {labName}
                        </td>
                        <td className="p-2.5 border-r border-brand-kingdom-200 font-semibold text-slate-900">
                          {res.className}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{res.teacher}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {displayList.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-300 text-slate-700 text-sm">
              No sessions found for the selected view.
            </div>
          ) : (
            <div className="space-y-12">
              {displayList.map((res, index) => {
                const labName = labs.find(l => l.id === res.labId)?.name || res.labId;
                const exp = getEffectiveExperimentDetails(res);

                return (
                  <div
                    key={`${res.id}-${index}`}
                    className="break-inside-avoid page-break-after-always"
                  >
                    {/* Official document header. The school name is title case
                        on purpose -- see SCHOOL_NAME in constants.ts. */}
                    <div className="text-center border-b-2 border-brand-kingdom-700 pb-4 mb-6">
                      <BrandLogo tone="dark" className="h-16 mx-auto mb-2.5" />
                      <h1 className="text-xl sm:text-2xl font-black text-brand-kingdom-700 tracking-tight">
                        {SCHOOL_NAME}
                      </h1>
                      <p
                        className="text-sm font-bold text-brand-kingdom-700 -mt-0.5"
                        lang="ar"
                        dir="rtl"
                      >
                        {SCHOOL_NAME_AR}
                      </p>
                      <h2 className="text-base sm:text-lg font-bold text-slate-800 uppercase tracking-widest mt-1.5">
                        Equipment requisition form
                      </h2>
                      <p className="text-xs text-slate-700 mt-0.5">{DEPARTMENT_NAME}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-8 text-xs mb-6">
                      <Field label="Date / reservation">
                        <span className="capitalize font-bold">
                          {res.day} (Period {res.period})
                        </span>
                      </Field>
                      <Field label="Requisition ref">
                        <span className="font-bold">RSM-REQ-{res.id?.slice(-6) || index + 101}</span>
                      </Field>
                      <Field label="Requested by">
                        <span className="font-bold">{res.teacher}</span>
                      </Field>
                      <Field label="Department / class">
                        {sectionTitle} — Class {res.className}
                      </Field>
                      <Field label="Lab location">
                        <span className="font-bold">{labName}</span>
                      </Field>
                      <Field label="Setup &amp; support">
                        {exp.numberOfGroups ? `${exp.numberOfGroups} groups` : 'Groups not specified'}
                        {' · Tech: '}
                        {exp.needsTechSupport ? 'Yes' : 'No'}
                        {' · Worksheets: '}
                        {exp.needsPrintedWorksheets ? `${exp.worksheetCopies} copies` : 'None'}
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Experiment name">
                          <span className="font-black text-sm">
                            {exp.experimentName || NOT_SPECIFIED}
                          </span>
                        </Field>
                      </div>
                    </div>

                    <Block title="Required equipment &amp; materials">
                      {exp.materialsNeeded || (
                        <span className="text-slate-600 italic">
                          No materials were specified by the teacher.
                        </span>
                      )}
                    </Block>

                    <Block title="Attached file">
                      {exp.fileName && exp.fileUrl ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleFile(exp.fileUrl, exp.fileName)}
                          className="print-keep font-bold text-slate-900 underline flex items-center gap-2 print:no-underline"
                        >
                          <Paperclip className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-md">{exp.fileName}</span>
                        </button>
                      ) : (
                        <span className="text-slate-600 italic">No file attached.</span>
                      )}
                    </Block>

                    <Block title="Technician notes">
                      {exp.techNotes || (
                        <span className="text-slate-600 italic">No special instructions.</span>
                      )}
                    </Block>

                    {exp.safetyItems.length > 0 && (
                      <Block title="Safety equipment">{exp.safetyItems.join(', ')}</Block>
                    )}

                    {/* The supervisor's decision belongs on the printed form:
                        this sheet is what gets carried to the lab, and a
                        booking the lab has already declined must not read as
                        confirmed on paper. */}
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase text-brand-kingdom-800 tracking-wide mb-1">
                        Lab supervisor
                      </h3>
                      {res.supervisorReview ? (
                        <div
                          className={`border p-3 text-xs ${
                            res.supervisorReview.status === 'declined'
                              ? 'border-brand-coral-700 bg-brand-coral-50'
                              : 'border-brand-kingdom-300 bg-brand-kingdom-50'
                          }`}
                        >
                          <p
                            className={`font-black uppercase tracking-wide ${
                              res.supervisorReview.status === 'declined'
                                ? 'text-brand-coral-900'
                                : 'text-brand-kingdom-800'
                            }`}
                          >
                            {res.supervisorReview.status === 'declined'
                              ? 'Not prepared — see reason'
                              : 'Reviewed — lab can prepare'}
                          </p>
                          {res.supervisorReview.reason && (
                            <p className="mt-1 text-slate-900 whitespace-pre-wrap">
                              {res.supervisorReview.reason}
                            </p>
                          )}
                          <p className="mt-1 text-slate-700">
                            {new Date(res.supervisorReview.reviewedAt).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <div className="border border-brand-kingdom-200 p-3 text-xs bg-white">
                          <p className="text-slate-600 italic">
                            Not yet reviewed. Signature: ______________________
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer band. The brand book puts the group affiliation on every
              page and the school's own site closes with it, so the printed
              form carries it too. */}
          <div className="mt-12 pt-4 border-t border-brand-kingdom-700 flex justify-between items-end text-[10px] text-slate-600 gap-4">
            <div>
              <p className="font-bold text-brand-kingdom-800">
                {SCHOOL_NAME} · Science Laboratory Management System
              </p>
              <p className="mt-0.5">{GROUP_AFFILIATION}</p>
            </div>
            <div className="text-right shrink-0">
              <p>Equipment requisition form</p>
              <p className="mt-0.5" lang="ar" dir="rtl">
                {GROUP_AFFILIATION_AR}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline border-b border-brand-kingdom-200 pb-1 gap-2">
    <span className="font-bold text-brand-kingdom-800 min-w-[140px] shrink-0">{label}:</span>
    <span className="text-slate-900">{children}</span>
  </div>
);

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-xs font-bold uppercase text-brand-kingdom-800 tracking-wide mb-1">{title}</h3>
    <div className="border border-brand-kingdom-200 p-3 text-xs text-slate-900 bg-white min-h-[50px] whitespace-pre-wrap">
      {children}
    </div>
  </div>
);
