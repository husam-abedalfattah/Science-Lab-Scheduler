import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  CheckCircle,
  AlertOctagon,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  FlaskConical,
  Shield,
  Users,
  FileText,
  Upload,
  Printer,
  Trash2,
  Paperclip,
  AlertTriangle
} from 'lucide-react';
import { Day, SectionData, ExperimentDetails, Reservation } from '../types';
import { DAYS_LIST, PERIODS_LIST } from '../data/initialData';
import { validateNewBooking, BookingValidationResult } from '../utils/conflictDetector';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_CONCURRENT_LABS_PER_PERIOD,
  ACCEPTED_ATTACHMENT_TYPES,
  ACCEPTED_ATTACHMENT_LABEL
} from '../constants';
import { useModalA11y } from '../hooks/useModalA11y';

interface BookingModalProps {
  isOpen: boolean;
  initialDay: Day;
  initialPeriod: number;
  initialLabId: string;
  initialSlotIndex: number;
  currentSectionData: SectionData;
  otherSectionData?: SectionData;
  isAdminLoggedIn: boolean;
  onClose: () => void;
  onSubmit: (bookingData: {
    day: Day;
    period: number;
    labId: string;
    slotIndex: number;
    teacher: string;
    className: string;
    subject?: string;
    isOverride?: boolean;
    experimentDetails?: ExperimentDetails;
  }) => boolean | Promise<boolean>;
}

const DEFAULT_SAFETY_ITEMS = [
  'Lab Coats',
  'Safety Goggles',
  'Protective Gloves',
  'Face Shield',
  'Fume Hood',
  'First Aid Kit'
];

const inputClass =
  'w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 focus:border-brand-kingdom-500 focus:bg-white transition';
const labelClass = 'block text-sm font-semibold text-slate-800 mb-1';

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  initialDay,
  initialPeriod,
  initialLabId,
  initialSlotIndex,
  currentSectionData,
  otherSectionData,
  isAdminLoggedIn,
  onClose,
  onSubmit
}) => {
  const panelRef = useModalA11y(isOpen, onClose);

  const [step, setStep] = useState<1 | 2>(1);

  const [day, setDay] = useState<Day>(initialDay);
  const [period, setPeriod] = useState<number>(initialPeriod);
  const [labId, setLabId] = useState<string>(initialLabId);
  const [slotIndex, setSlotIndex] = useState<number>(initialSlotIndex);
  const [teacher, setTeacher] = useState<string>('');
  const [className, setClassName] = useState<string>('');
  const [subject, setSubject] = useState<string>('');

  const [experimentName, setExperimentName] = useState<string>('');
  const [materialsNeeded, setMaterialsNeeded] = useState<string>('');
  const [numberOfGroups, setNumberOfGroups] = useState<number>(4);
  const [needsTechSupport, setNeedsTechSupport] = useState<boolean>(true);
  const [selectedSafetyItems, setSelectedSafetyItems] = useState<string[]>([
    'Lab Coats',
    'Safety Goggles'
  ]);
  const [customSafetyItem, setCustomSafetyItem] = useState<string>('');
  const [techNotes, setTechNotes] = useState<string>('');

  const [needsPrintedWorksheets, setNeedsPrintedWorksheets] = useState<boolean>(false);
  const [worksheetCopies, setWorksheetCopies] = useState<number>(25);

  const [fileName, setFileName] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [validation, setValidation] = useState<BookingValidationResult | null>(null);

  /**
   * The experiment name is the only required field, and its failure used to
   * surface as a generic message in the form-level error box at the very
   * bottom -- the field itself carried no indication and nothing linked the
   * two, so on a long form the user got "something is wrong" with no pointer
   * to what. It is now an inline error tied to the input via
   * `aria-describedby`, and submit moves focus there.
   *
   * `required` alone does not cover this: a whitespace-only value satisfies
   * the browser, and the override path submits via a plain button that skips
   * native validation entirely.
   */
  const [nameError, setNameError] = useState<string>('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Rosters are read on open only. Depending on the whole sectionData object
  // meant every Firestore snapshot -- including someone else's booking --
  // rebuilt this form and wiped whatever the user was typing.
  const teachersRef = useRef(currentSectionData.teachers);
  const classesRef = useRef(currentSectionData.classes);
  teachersRef.current = currentSectionData.teachers;
  classesRef.current = currentSectionData.classes;

  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setDay(initialDay);
    setPeriod(initialPeriod);
    setLabId(initialLabId);
    setSlotIndex(initialSlotIndex);
    setTeacher(teachersRef.current[0] || '');
    setClassName(classesRef.current[0] || '');
    setSubject('');
    setExperimentName('');
    setMaterialsNeeded('');
    setNumberOfGroups(4);
    setNeedsTechSupport(true);
    setSelectedSafetyItems(['Lab Coats', 'Safety Goggles']);
    setCustomSafetyItem('');
    setTechNotes('');
    setNeedsPrintedWorksheets(false);
    setWorksheetCopies(25);
    setFileName('');
    setFileUrl('');
    setFileError('');
    setIsSubmitting(false);
    setSaveError('');
    setNameError('');
  }, [isOpen, initialDay, initialPeriod, initialLabId, initialSlotIndex]);

  useEffect(() => {
    if (isOpen && teacher && className) {
      setValidation(
        validateNewBooking(
          day,
          period,
          labId,
          slotIndex,
          teacher,
          className,
          currentSectionData,
          otherSectionData
        )
      );
    } else {
      setValidation(null);
    }
  }, [
    isOpen,
    day,
    period,
    labId,
    slotIndex,
    teacher,
    className,
    currentSectionData,
    otherSectionData
  ]);

  /** Availability annotations so the picker shows what is free before submitting. */
  const availability = useMemo(() => {
    const all: Reservation[] = [];
    Object.values(currentSectionData.reservations).forEach(list => {
      if (Array.isArray(list)) all.push(...list);
    });

    const periodCounts = new Map<string, number>();
    const takenLabs = new Set<string>();

    all.forEach(r => {
      const key = `${r.day}_p${r.period}`;
      periodCounts.set(key, (periodCounts.get(key) || 0) + 1);
      if (r.day === day && r.period === period) takenLabs.add(r.labId);
    });

    return { periodCounts, takenLabs };
  }, [currentSectionData.reservations, day, period]);

  const periodLabel = (p: number) => {
    const key = `${day}_p${p}`;
    const blocked = currentSectionData.blockedPeriods?.[key];
    if (blocked) return `Period ${p} — blocked`;
    const count = availability.periodCounts.get(key) || 0;
    if (count >= MAX_CONCURRENT_LABS_PER_PERIOD) return `Period ${p} — full`;
    return `Period ${p} — ${MAX_CONCURRENT_LABS_PER_PERIOD - count} free`;
  };

  if (!isOpen) return null;

  const currentLabObj = currentSectionData.labs.find(l => l.id === labId);
  const blockedForSubmission = validation !== null && !validation.isValid && !isAdminLoggedIn;

  const toggleSafetyItem = (item: string) => {
    setSelectedSafetyItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleAddCustomSafetyItem = () => {
    const value = customSafetyItem.trim();
    if (value && !selectedSafetyItems.includes(value)) {
      setSelectedSafetyItems(prev => [...prev, value]);
      setCustomSafetyItem('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');

    // Attachments are inlined into the Firestore document, which is capped at
    // 1 MiB; base64 adds ~33% on top of the raw bytes.
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFileError(
        `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${Math.round(
          MAX_ATTACHMENT_BYTES / 1024
        )} KB — please attach a smaller file.`
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileName(file.name);
        setFileUrl(reader.result);
      }
    };
    reader.onerror = () => setFileError('Could not read that file. Please try another.');
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setFileName('');
    setFileUrl('');
    setFileError('');
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher || !className || blockedForSubmission) return;
    if (!experimentName && subject) setExperimentName(subject);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent, forceOverride = false) => {
    e.preventDefault();
    if (!teacher || !className || isSubmitting) return;

    // Validation is recomputed from live data, so a slot that was free on step
    // 1 can be taken by the time step 2 is submitted. This guard used to return
    // silently, leaving a teacher clicking an enabled button that did nothing.
    if (!validation?.isValid && !forceOverride && !isAdminLoggedIn) {
      setSaveError(
        validation?.errors.length
          ? `This slot is no longer bookable: ${validation.errors.join(' ')} Go back and choose another slot.`
          : 'This slot is no longer bookable. Go back and choose another slot.'
      );
      return;
    }

    const trimmedName = experimentName.trim();
    if (!trimmedName) {
      // Inline, on the field, with focus moved there -- not a message at the
      // far end of the form that never says which input is at fault.
      setNameError('Enter a name for the experiment.');
      nameInputRef.current?.focus();
      return;
    }

    setNameError('');
    setSaveError('');

    const expDetails: ExperimentDetails = {
      experimentName: trimmedName,
      materialsNeeded: materialsNeeded.trim(),
      numberOfGroups: numberOfGroups || 1,
      needsTechSupport,
      safetyItems: selectedSafetyItems,
      techNotes: techNotes.trim(),
      needsPrintedWorksheets,
      worksheetCopies: needsPrintedWorksheets ? worksheetCopies : 0,
      fileName,
      fileUrl
    };

    setIsSubmitting(true);
    try {
      // Only dismiss on a confirmed write. The save can still fail after all
      // validation passes -- most often because another teacher won the same
      // slot in between -- and closing regardless threw away the whole
      // two-step form with nothing but a toast to explain it.
      const saved = await onSubmit({
        day,
        period,
        labId,
        slotIndex,
        teacher,
        className,
        subject: subject.trim() || trimmedName,
        isOverride: forceOverride,
        experimentDetails: expDetails
      });
      if (saved) {
        onClose();
      } else {
        setSaveError(
          'The reservation could not be saved. Your details are kept below — adjust the slot if it was just taken, then try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-900 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wide bg-brand-kingdom-100 text-brand-kingdom-900 px-2 py-0.5 rounded-full">
                Step {step} of 2
              </span>
              <h2 id="booking-modal-title" className="text-base font-bold text-slate-900">
                {step === 1 ? 'Reservation details' : 'Experiment and materials'}
              </h2>
            </div>
            <p className="text-sm text-brand-kingdom-700 font-medium mt-1 capitalize">
              {day} · Period {period} · {currentLabObj?.name || labId}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking form"
            className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="booking-day" className={labelClass}>
                  Day
                </label>
                <select
                  id="booking-day"
                  value={day}
                  onChange={(e) => setDay(e.target.value as Day)}
                  className={inputClass}
                >
                  {DAYS_LIST.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="booking-period" className={labelClass}>
                  Period
                </label>
                <select
                  id="booking-period"
                  value={period}
                  onChange={(e) => setPeriod(parseInt(e.target.value, 10))}
                  className={inputClass}
                >
                  {PERIODS_LIST.map(p => (
                    <option key={p} value={p}>
                      {periodLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="booking-lab" className={labelClass}>
                Lab room
              </label>
              <select
                id="booking-lab"
                value={labId}
                onChange={(e) => setLabId(e.target.value)}
                className={inputClass}
              >
                {currentSectionData.labs.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                    {availability.takenLabs.has(l.id) ? ' — already booked' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="booking-teacher" className={labelClass}>
                Teacher
              </label>
              <select
                id="booking-teacher"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Select teacher…
                </option>
                {currentSectionData.teachers.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="booking-class" className={labelClass}>
                Class
              </label>
              <select
                id="booking-class"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Select class…
                </option>
                {currentSectionData.classes.map(c => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="booking-subject" className={labelClass}>
                Subject or topic <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="booking-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Organic chemistry, optics…"
                className={inputClass}
              />
            </div>

            {validation && (
              <div aria-live="polite">
                {validation.isValid ? (
                  <div className="p-2.5 rounded-lg bg-brand-green-50 border border-brand-green-300 flex items-start gap-2 text-brand-green-900 text-sm">
                    <CheckCircle className="w-4 h-4 text-brand-green-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Slot available. Up to {MAX_CONCURRENT_LABS_PER_PERIOD} labs can run in one
                      period.
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-brand-coral-50 border border-brand-coral-300 text-brand-coral-900 space-y-1 text-sm">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertOctagon className="w-4 h-4 text-brand-coral-700 shrink-0" aria-hidden="true" />
                      <span>{isAdminLoggedIn ? 'Conflicts detected' : 'Booking not allowed'}</span>
                    </div>
                    {validation.errors.map((err, i) => (
                      <p key={i} className="text-xs pl-6 leading-relaxed">
                        • {err}
                      </p>
                    ))}
                    {isAdminLoggedIn && (
                      <p className="text-xs pl-6 pt-1 font-semibold">
                        As an administrator you can continue and force this booking.
                      </p>
                    )}
                  </div>
                )}

                {validation.warnings.map((warn, i) => (
                  <div
                    key={i}
                    className="mt-2 p-2.5 rounded-lg bg-brand-yellow-50 border border-brand-yellow-300 text-brand-yellow-900 text-xs flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-brand-yellow-700 shrink-0" aria-hidden="true" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition text-sm"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={blockedForSubmission}
                className={`w-2/3 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-sm ${
                  blockedForSubmission
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white'
                }`}
              >
                <span>Next: materials</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-3.5">
            <div>
              <label htmlFor="exp-name" className={`${labelClass} flex items-center gap-1`}>
                <FlaskConical className="w-3.5 h-3.5 text-brand-kingdom-600" aria-hidden="true" />
                <span>
                  Experiment name <span className="text-brand-coral-600">*</span>
                </span>
              </label>
              <input
                id="exp-name"
                ref={nameInputRef}
                type="text"
                required
                value={experimentName}
                onChange={(e) => {
                  setExperimentName(e.target.value);
                  if (nameError) setNameError('');
                }}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'exp-name-error' : undefined}
                placeholder="e.g. Acid-base titration and pH measurement"
                className={`${inputClass} ${nameError ? 'border-brand-coral-600' : ''}`}
              />
              {nameError && (
                <p
                  id="exp-name-error"
                  role="alert"
                  className="mt-1 text-xs font-semibold text-brand-coral-800"
                >
                  {nameError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="exp-materials" className={`${labelClass} flex items-center gap-1`}>
                <FileText className="w-3.5 h-3.5 text-brand-kingdom-600" aria-hidden="true" />
                <span>Required materials and chemicals</span>
              </label>
              <textarea
                id="exp-materials"
                rows={3}
                value={materialsNeeded}
                onChange={(e) => setMaterialsNeeded(e.target.value)}
                placeholder="List apparatus and chemicals, one per line. The technician prepares exactly this list."
                className={inputClass}
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave blank if nothing special is needed — the requisition form will say so rather
                than guess.
              </p>
            </div>

            {/* Attachment */}
            <div className="p-3 bg-brand-kingdom-50/60 border border-brand-kingdom-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-bold text-brand-kingdom-950 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-brand-kingdom-700" aria-hidden="true" />
                  <span>Worksheet attachment (optional)</span>
                </span>
                <span className="text-xs text-brand-kingdom-800">
                  {ACCEPTED_ATTACHMENT_LABEL} · max {Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB
                </span>
              </div>

              {fileName ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-brand-kingdom-300 text-sm">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Paperclip className="w-4 h-4 text-brand-kingdom-700 shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-slate-800 truncate">{fileName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    aria-label={`Remove attachment ${fileName}`}
                    className="p-1 text-brand-coral-600 hover:text-brand-coral-800 hover:bg-brand-coral-50 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 border-dashed border-brand-kingdom-300 bg-white hover:bg-brand-kingdom-50 text-brand-kingdom-800 text-sm font-semibold cursor-pointer transition">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>Choose a file…</span>
                  <input
                    type="file"
                    accept={ACCEPTED_ATTACHMENT_TYPES}
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              )}

              {fileError && (
                <p role="alert" className="text-xs font-semibold text-brand-coral-700">
                  {fileError}
                </p>
              )}
            </div>

            {/* Worksheets */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-brand-kingdom-600" aria-hidden="true" />
                  <span>Printed worksheets needed?</span>
                </span>

                <div className="flex items-center gap-1" role="group" aria-label="Printed worksheets needed">
                  <button
                    type="button"
                    aria-pressed={needsPrintedWorksheets}
                    onClick={() => setNeedsPrintedWorksheets(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                      needsPrintedWorksheets
                        ? 'bg-brand-kingdom-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    aria-pressed={!needsPrintedWorksheets}
                    onClick={() => setNeedsPrintedWorksheets(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                      !needsPrintedWorksheets
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {needsPrintedWorksheets && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                  <label htmlFor="worksheet-copies" className="text-sm font-medium text-slate-700">
                    Number of copies
                  </label>
                  <input
                    id="worksheet-copies"
                    type="number"
                    min={1}
                    max={200}
                    value={worksheetCopies}
                    onChange={(e) =>
                      setWorksheetCopies(
                        Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    className="w-24 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 text-center"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-groups" className={`${labelClass} flex items-center gap-1`}>
                  <Users className="w-3.5 h-3.5 text-brand-kingdom-600" aria-hidden="true" />
                  <span>Student groups</span>
                </label>
                <input
                  id="exp-groups"
                  type="number"
                  min={1}
                  max={15}
                  value={numberOfGroups}
                  onChange={(e) =>
                    setNumberOfGroups(Math.min(15, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <span className={labelClass}>Lab tech support?</span>
                <div className="flex items-center gap-2" role="group" aria-label="Lab tech support needed">
                  <button
                    type="button"
                    aria-pressed={needsTechSupport}
                    onClick={() => setNeedsTechSupport(true)}
                    className={`flex-1 py-2 rounded-lg font-semibold border transition text-sm ${
                      needsTechSupport
                        ? 'bg-brand-kingdom-600 text-white border-brand-kingdom-600'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    aria-pressed={!needsTechSupport}
                    onClick={() => setNeedsTechSupport(false)}
                    className={`flex-1 py-2 rounded-lg font-semibold border transition text-sm ${
                      !needsTechSupport
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* Safety */}
            <fieldset>
              <legend className={`${labelClass} flex items-center gap-1`}>
                <Shield className="w-3.5 h-3.5 text-brand-green-700" aria-hidden="true" />
                <span>Required safety items</span>
              </legend>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {[...DEFAULT_SAFETY_ITEMS, ...selectedSafetyItems.filter(i => !DEFAULT_SAFETY_ITEMS.includes(i))].map(item => {
                  const isSelected = selectedSafetyItems.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleSafetyItem(item)}
                      className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                        isSelected
                          ? 'bg-brand-green-100 text-brand-green-900 border-brand-green-400'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {item}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <label htmlFor="custom-safety" className="sr-only">
                  Add another safety item
                </label>
                <input
                  id="custom-safety"
                  type="text"
                  value={customSafetyItem}
                  onChange={(e) => setCustomSafetyItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSafetyItem();
                    }
                  }}
                  placeholder="Other safety item…"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleAddCustomSafetyItem}
                  className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold rounded-lg transition shrink-0"
                >
                  Add
                </button>
              </div>
            </fieldset>

            <div>
              <label htmlFor="tech-notes" className={labelClass}>
                Notes for the lab technician
              </label>
              <textarea
                id="tech-notes"
                rows={2}
                value={techNotes}
                onChange={(e) => setTechNotes(e.target.value)}
                placeholder="Special setup, safety precautions, chemical storage…"
                className={inputClass}
              />
            </div>

            {saveError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-brand-coral-50 border border-brand-coral-300 text-brand-coral-900 flex items-start gap-2"
              >
                <AlertOctagon className="w-4 h-4 text-brand-coral-700 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs leading-relaxed">{saveError}</p>
              </div>
            )}

            <div className="pt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition flex items-center justify-center gap-1 text-sm"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>

              {validation && !validation.isValid && isAdminLoggedIn ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={(e) => handleSubmit(e, true)}
                  className="w-2/3 py-2.5 rounded-lg bg-brand-yellow-400 hover:bg-brand-yellow-500 text-brand-yellow-950 font-semibold transition flex items-center justify-center gap-1.5 text-sm disabled:opacity-60"
                >
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                  <span>{isSubmitting ? 'Saving…' : 'Force book as admin'}</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 py-2.5 rounded-lg font-semibold bg-brand-kingdom-600 hover:bg-brand-kingdom-700 text-white transition text-sm disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving…' : 'Confirm reservation'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
