import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Printer, FlaskConical, FileText, Users, Shield, Paperclip, Calendar, CheckSquare, Film } from 'lucide-react';
import { Reservation, Lab, Section, Day } from '../types';
import { DAYS_LIST } from '../data/initialData';
import { getEffectiveExperimentDetails } from '../utils/experimentUtils';
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

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  section,
  labs,
  reservations,
  initialDayFilter = 'ALL',
  singleReservation: initialSingleRes = null,
  onClose,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);

  // Active Day Filter ('ALL', 'sunday', 'monday', etc.)
  const [selectedDayFilter, setSelectedDayFilter] = useState<Day | 'ALL'>(initialDayFilter);

  // Active Single Reservation state (if inspecting 1 specific experiment PDF)
  const [activeSingleRes, setActiveSingleRes] = useState<Reservation | null>(initialSingleRes);

  const [isGenerating, setIsGenerating] = useState(false);

  // Sync state when props change
  useEffect(() => {
    if (initialSingleRes) {
      setActiveSingleRes(initialSingleRes);
    } else {
      setActiveSingleRes(null);
    }
    setSelectedDayFilter(initialDayFilter);
  }, [initialSingleRes, initialDayFilter, isOpen]);

  if (!isOpen) return null;

  const isBoys = section === 'boys';
  const sectionTitle = isBoys ? 'Boys Section' : 'Girls Section';

  // Extract all reservations from record
  const allReservationsList: Reservation[] = [];
  Object.values(reservations).forEach(list => {
    if (Array.isArray(list)) {
      allReservationsList.push(...list);
    }
  });

  // Filter list by selected day or single reservation
  let displayList: Reservation[] = [];

  if (activeSingleRes) {
    displayList = [activeSingleRes];
  } else {
    displayList = allReservationsList.filter(res => {
      if (selectedDayFilter !== 'ALL' && res.day !== selectedDayFilter) {
        return false;
      }
      return true;
    });
  }

  // Sort by Day then Period then Lab
  const dayOrder: Record<string, number> = {
    sunday: 1,
    monday: 2,
    tuesday: 3,
    wednesday: 4,
    thursday: 5
  };

  displayList.sort((a, b) => {
    const d1 = dayOrder[a.day] || 99;
    const d2 = dayOrder[b.day] || 99;
    if (d1 !== d2) return d1 - d2;
    if (a.period !== b.period) return a.period - b.period;
    return a.labId.localeCompare(b.labId);
  });

  // Calculate totals for quick summary
  const totalExperiments = displayList.length;
  const totalTechSupport = displayList.filter(r => r.experimentDetails?.needsTechSupport).length;
  const totalWorksheetCopies = displayList.reduce((sum, r) => sum + (r.experimentDetails?.worksheetCopies || 0), 0);
  const totalFilesAttached = displayList.filter(r => r.experimentDetails?.fileName).length;

  // Attached files/videos for batch download
  const attachmentsList = displayList.filter(r => r.experimentDetails?.fileUrl && r.experimentDetails?.fileName);

  // Download a single file attachment
  const handleDownloadSingleFile = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'experiment_attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Batch Download all day's attachments (Videos/Docs)
  const handleBatchDownloadAttachments = () => {
    if (attachmentsList.length === 0) {
      alert('No video or document files uploaded for the selected experiment(s).');
      return;
    }

    attachmentsList.forEach((r, idx) => {
      setTimeout(() => {
        handleDownloadSingleFile(r.experimentDetails?.fileUrl, r.experimentDetails?.fileName);
      }, idx * 400);
    });
  };

  // Helper function to sanitize oklch color string for html2canvas
  const replaceOklchInString = (str: string): string => {
    if (!str || !str.includes('oklch')) return str;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    return str.replace(/oklch\([^\)]+\)/gi, (match) => {
      if (ctx) {
        try {
          ctx.fillStyle = '#000000';
          ctx.fillStyle = match;
          const resolved = ctx.fillStyle;
          if (resolved && !resolved.includes('oklch')) {
            return resolved;
          }
        } catch {
          // ignore
        }
      }

      try {
        const m = match.match(/oklch\(\s*([\d.]+)\%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)\%?)?\s*\)/i);
        if (m) {
          let l = parseFloat(m[1]);
          if (m[1].includes('%')) l /= 100;
          const c = parseFloat(m[2]);
          const h = parseFloat(m[3]);
          let alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
          if (m[4] && m[4].includes('%')) alpha /= 100;

          const hRad = (h * Math.PI) / 180;
          const a = c * Math.cos(hRad);
          const b = c * Math.sin(hRad);

          const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
          const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
          const s_ = l - 0.0894841775 * a - 1.291485548 * b;

          const L = l_ * l_ * l_;
          const M = m_ * m_ * m_;
          const S = s_ * s_ * s_;

          let r = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
          let g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
          let blue = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

          r = r >= 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
          g = g >= 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
          blue = blue >= 0.0031308 ? 1.055 * Math.pow(blue, 1 / 2.4) - 0.055 : 12.92 * blue;

          const R = Math.min(255, Math.max(0, Math.round(r * 255)));
          const G = Math.min(255, Math.max(0, Math.round(g * 255)));
          const B = Math.min(255, Math.max(0, Math.round(blue * 255)));

          if (alpha < 1) {
            return `rgba(${R}, ${G}, ${B}, ${alpha})`;
          }
          return `rgb(${R}, ${G}, ${B})`;
        }
      } catch {
        // ignore
      }

      return 'rgb(79, 70, 229)';
    });
  };

  // Handle PDF Export
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const styleTags = clonedDoc.querySelectorAll('style');
          styleTags.forEach((styleTag) => {
            if (styleTag.textContent && styleTag.textContent.includes('oklch')) {
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

          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const styleAttr = htmlEl.getAttribute('style');
            if (styleAttr && styleAttr.includes('oklch')) {
              htmlEl.setAttribute('style', replaceOklchInString(styleAttr));
            }
            try {
              const computed = window.getComputedStyle(htmlEl);
              colorProps.forEach((prop) => {
                const val = computed.getPropertyValue(prop);
                if (val && val.includes('oklch')) {
                  htmlEl.style.setProperty(prop, replaceOklchInString(val), 'important');
                }
              });
            } catch {
              // ignore
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const isLandscape = selectedDayFilter === 'ALL' && !activeSingleRes;
      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const suffix = activeSingleRes 
        ? `Single_Exp_${activeSingleRes.teacher.replace(/\s+/g, '_')}`
        : selectedDayFilter;

      pdf.save(`Science_Lab_Report_${section}_${suffix}_${dateStr}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('An error occurred while generating the PDF. Try printing directly.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Direct Browser Print
  const handlePrint = () => {
    try {
      window.focus();
      document.body.classList.add('pdf-modal-printing');
      
      // Delay slightly to let class apply before browser print dialog captures DOM
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('pdf-modal-printing');
        }, 1000);
      }, 50);
    } catch (err) {
      console.error('Print failed:', err);
      document.body.classList.remove('pdf-modal-printing');
    }
  };

  return (
    <div className="pdf-report-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:p-0 print:static print:bg-white print:z-auto">
      <div className="pdf-report-modal-content bg-white border-2 border-slate-300 rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[92vh] overflow-y-auto font-sans print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none print:p-0">
        
        {/* Modal Actions Header (Hidden during Print) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 pb-4 border-b border-slate-200 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <FileText className="w-5 h-5" />
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {activeSingleRes 
                  ? 'Experiment Practical Sheet & PDF Voucher' 
                  : 'Experiments & Materials PDF Report'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeSingleRes
                ? `Single experiment voucher for ${activeSingleRes.teacher} (Class ${activeSingleRes.className})`
                : `Official science lab prep sheet for ${selectedDayFilter === 'ALL' ? 'All Scheduled Days' : `${selectedDayFilter.toUpperCase()} Experiments`}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            
            {/* Toggle View: All Days vs Specific Day or Switch off Single View */}
            {activeSingleRes ? (
              <button
                type="button"
                onClick={() => setActiveSingleRes(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-300 cursor-pointer"
              >
                ← View All Day Reports
              </button>
            ) : (
              <select
                value={selectedDayFilter}
                onChange={(e) => setSelectedDayFilter(e.target.value as Day | 'ALL')}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 cursor-pointer"
              >
                <option value="ALL">All Days (Master Report)</option>
                {DAYS_LIST.map(d => (
                  <option key={d.id} value={d.id}>{d.label} Experiments</option>
                ))}
              </select>
            )}

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition border border-slate-300 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-xl p-2 transition border border-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT BODY - EQUIPMENT REQUISITION FORM TEMPLATE */}
        <div 
          ref={reportRef} 
          className="rsm-official-report p-6 sm:p-10 bg-white text-slate-900 border-2 border-black rounded-none shadow-none print:border-none print:shadow-none print:p-0"
        >
          {/* MASTER SUMMARY TABLE (ESSENTIAL INFO ONLY) */}
          {!activeSingleRes && displayList.length > 0 && (
            <div className="mb-10 border-2 border-black break-inside-avoid">
              <div className="bg-black text-white p-3 font-bold text-xs uppercase tracking-wider flex justify-between items-center">
                <span>Master Requisition Summary Index</span>
                <span className="text-[11px] font-mono font-normal">Total: {displayList.length} Experiments</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-black font-bold border-b border-black">
                    <th className="p-2.5 border-r border-slate-400 w-2/5">Name of the Experiment</th>
                    <th className="p-2.5 border-r border-slate-400 w-1/4">Date / Reservation Slot</th>
                    <th className="p-2.5 border-r border-slate-400 w-1/6">Class</th>
                    <th className="p-2.5">Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 bg-white">
                  {displayList.map((res, i) => {
                    const exp = getEffectiveExperimentDetails(res);
                    const labObj = labs.find(l => l.id === res.labId);
                    const labName = labObj ? labObj.name : res.labId;
                    return (
                      <tr key={res.id || i} className="hover:bg-slate-50">
                        <td className="p-2.5 border-r border-slate-300 font-bold text-black" title={exp.experimentName}>
                          {exp.experimentName.length > 25 ? `${exp.experimentName.slice(0, 25).trim()}...` : exp.experimentName}
                        </td>
                        <td className="p-2.5 border-r border-slate-300 font-mono text-slate-800 capitalize">
                          {res.day} (Period {res.period}) • {labName}
                        </td>
                        <td className="p-2.5 border-r border-slate-300 font-semibold text-slate-900">
                          {res.className}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {res.teacher}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {displayList.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-300 text-slate-600 text-xs italic">
              No experiment requisitions found for the selected view.
            </div>
          ) : (
            <div className="space-y-12">
              {displayList.map((res, index) => {
                const labObj = labs.find(l => l.id === res.labId);
                const labName = labObj ? labObj.name : res.labId;
                const exp = getEffectiveExperimentDetails(res);

                return (
                  <div key={res.id || index} className="break-inside-avoid page-break-after-always">
                    
                    {/* FORM TITLE (CENTERED LIKE TEMPLATE IMAGE) */}
                    <div className="text-center border-b-2 border-black pb-4 mb-6">
                      <h1 className="text-xl sm:text-2xl font-black uppercase text-black tracking-tight">
                        Riyadh Schools - ALMALQA
                      </h1>
                      <h2 className="text-base sm:text-lg font-bold text-slate-800 uppercase tracking-widest mt-0.5">
                        Equipment Requisition Form
                      </h2>
                      <p className="text-xs text-slate-600 font-mono mt-0.5">
                        Science Department • Laboratory Services
                      </p>
                    </div>

                    {/* FORM METADATA FIELDS (LIKE TEMPLATE IMAGE) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-8 text-xs font-sans mb-6">
                      <div className="flex items-baseline border-b border-slate-400 pb-1">
                        <span className="font-bold text-black min-w-[140px]">Date / Reservation:</span>
                        <span className="text-slate-900 font-bold capitalize">{res.day} (Period {res.period})</span>
                      </div>
                      <div className="flex items-baseline border-b border-slate-400 pb-1">
                        <span className="font-bold text-black min-w-[140px]">Requisition Ref:</span>
                        <span className="text-slate-900 font-mono font-bold">RSM-REQ-{res.id?.slice(-5) || (index + 101)}</span>
                      </div>
                      <div className="flex items-baseline border-b border-slate-400 pb-1">
                        <span className="font-bold text-black min-w-[140px]">Requested By (Teacher):</span>
                        <span className="text-slate-900 font-bold">{res.teacher}</span>
                      </div>
                      <div className="flex items-baseline border-b border-slate-400 pb-1">
                        <span className="font-bold text-black min-w-[140px]">Department / Class:</span>
                        <span className="text-slate-900">{sectionTitle} — Class {res.className}</span>
                      </div>
                      <div className="flex items-baseline border-b border-slate-400 pb-1">
                        <span className="font-bold text-black min-w-[140px]">Lab Location:</span>
                        <span className="text-slate-900 font-bold">{labName}</span>
                      </div>
                      <div className="flex items-baseline border-b border-slate-400 pb-1">
                        <span className="font-bold text-black min-w-[140px]">Setup & Support:</span>
                        <span className="text-slate-900 font-medium">
                          {exp.numberOfGroups || 1} Groups • Tech: {exp.needsTechSupport ? 'Yes' : 'No'} • Worksheets: {exp.needsPrintedWorksheets ? `${exp.worksheetCopies} Copies` : 'None'}
                        </span>
                      </div>
                      <div className="sm:col-span-2 flex items-baseline border-b border-slate-400 pb-1">
                        <span className="font-bold text-black min-w-[140px]">Experiment Name:</span>
                        <span className="text-slate-900 font-black text-sm">{exp.experimentName}</span>
                      </div>
                    </div>

                    {/* REQUIRED EQUIPMENT & MATERIALS */}
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase text-black tracking-wider mb-1">
                        Required Equipment & Materials
                      </h3>
                      <div className="border border-slate-400 p-3 text-xs text-slate-900 bg-white font-mono min-h-[60px] whitespace-pre-wrap">
                        {exp.materialsNeeded && exp.materialsNeeded.trim() ? (
                          exp.materialsNeeded
                        ) : (
                          <span className="text-slate-500 italic">No specific materials listed.</span>
                        )}
                      </div>
                    </div>

                    {/* ATTACHED FILE / LINK */}
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase text-black tracking-wider mb-1">
                        Attached File / Link
                      </h3>
                      <div className="border border-slate-400 p-2.5 text-xs text-slate-900 bg-white font-mono flex items-center justify-between">
                        {exp.fileName && exp.fileUrl ? (
                          <a
                            href={exp.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-slate-900 underline flex items-center gap-2 hover:text-black cursor-pointer print:no-underline"
                          >
                            <Paperclip className="w-4 h-4 text-slate-800 shrink-0" />
                            <span className="truncate max-w-md">{exp.fileName}</span>
                            <span className="text-[10px] text-slate-500 font-sans print:hidden">(Click to open attachment)</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 italic">No attached files or links uploaded for this experiment.</span>
                        )}
                      </div>
                    </div>

                    {/* TECHNICIAN NOTES & INSTRUCTIONS */}
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase text-black tracking-wider mb-1">
                        Technician Notes & Special Instructions
                      </h3>
                      <div className="border border-slate-400 p-3 text-xs text-slate-800 bg-white font-mono min-h-[50px] whitespace-pre-wrap">
                        {exp.techNotes ? exp.techNotes : 'Standard laboratory preparation for practical science experiment. Clean apparatus after session.'}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* DOCUMENT FOOTER */}
          <div className="mt-12 pt-4 border-t border-slate-400 flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Riyadh Schools - ALMALQA • Science Laboratory Management System</span>
            <span>Official Equipment Requisition Form</span>
          </div>

        </div>

      </div>
    </div>
  );
};
