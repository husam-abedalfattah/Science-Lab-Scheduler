import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertOctagon, ShieldAlert, ArrowRight, ArrowLeft, FlaskConical, Shield, Users, FileText, Upload, Printer, Trash2, Paperclip } from 'lucide-react';
import { Day, SectionData, ExperimentDetails } from '../types';
import { DAYS_LIST, PERIODS_LIST } from '../data/initialData';
import { validateNewBooking, BookingValidationResult } from '../utils/conflictDetector';

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
  }) => void;
}

const DEFAULT_SAFETY_ITEMS = [
  'Lab Coats',
  'Safety Goggles',
  'Protective Gloves',
  'Face Shield',
  'Fume Hood',
  'First Aid Kit'
];

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
  onSubmit,
}) => {
  // Wizard Step
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 State
  const [day, setDay] = useState<Day>(initialDay);
  const [period, setPeriod] = useState<number>(initialPeriod);
  const [labId, setLabId] = useState<string>(initialLabId);
  const [slotIndex, setSlotIndex] = useState<number>(initialSlotIndex);
  const [teacher, setTeacher] = useState<string>('');
  const [className, setClassName] = useState<string>('');
  const [subject, setSubject] = useState<string>('');

  // Step 2 State (Experiment & Materials Details)
  const [experimentName, setExperimentName] = useState<string>('');
  const [materialsNeeded, setMaterialsNeeded] = useState<string>('');
  const [numberOfGroups, setNumberOfGroups] = useState<number>(4);
  const [needsTechSupport, setNeedsTechSupport] = useState<boolean>(true);
  const [selectedSafetyItems, setSelectedSafetyItems] = useState<string[]>(['Lab Coats', 'Safety Goggles']);
  const [customSafetyItem, setCustomSafetyItem] = useState<string>('');
  const [techNotes, setTechNotes] = useState<string>('');

  // Printed Worksheets state
  const [needsPrintedWorksheets, setNeedsPrintedWorksheets] = useState<boolean>(false);
  const [worksheetCopies, setWorksheetCopies] = useState<number>(25);

  // File Upload state
  const [fileName, setFileName] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');

  const [validation, setValidation] = useState<BookingValidationResult | null>(null);

  // Sync state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setDay(initialDay);
      setPeriod(initialPeriod);
      setLabId(initialLabId);
      setSlotIndex(initialSlotIndex);
      
      if (!teacher && currentSectionData.teachers.length > 0) {
        setTeacher(currentSectionData.teachers[0]);
      }
      if (!className && currentSectionData.classes.length > 0) {
        setClassName(currentSectionData.classes[0]);
      }
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
    }
  }, [isOpen, initialDay, initialPeriod, initialLabId, initialSlotIndex, currentSectionData]);

  // Run Conflict & Validation whenever selection changes
  useEffect(() => {
    if (isOpen && teacher && className) {
      const res = validateNewBooking(
        day,
        period,
        labId,
        slotIndex,
        teacher,
        className,
        currentSectionData,
        otherSectionData
      );
      setValidation(res);
    } else {
      setValidation(null);
    }
  }, [isOpen, day, period, labId, slotIndex, teacher, className, currentSectionData, otherSectionData]);

  if (!isOpen) return null;

  const currentLabObj = currentSectionData.labs.find(l => l.id === labId);

  const toggleSafetyItem = (item: string) => {
    setSelectedSafetyItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleAddCustomSafetyItem = () => {
    if (customSafetyItem.trim() && !selectedSafetyItems.includes(customSafetyItem.trim())) {
      setSelectedSafetyItems(prev => [...prev, customSafetyItem.trim()]);
      setCustomSafetyItem('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max ~4MB for browser storage/Firestore doc)
    if (file.size > 4 * 1024 * 1024) {
      alert('File size exceeds 4MB. Please select a smaller file.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setFileName('');
    setFileUrl('');
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher || !className) return;
    if (!validation?.isValid && !isAdminLoggedIn) return;

    // Default experiment name if left empty
    if (!experimentName) {
      setExperimentName(subject ? subject : `Practical Lab - Class ${className}`);
    }

    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent, forceOverride = false) => {
    e.preventDefault();
    if (!teacher || !className) return;

    if (!validation?.isValid && !forceOverride && !isAdminLoggedIn) {
      return;
    }

    const expDetails: ExperimentDetails = {
      experimentName: experimentName || subject || `Practical Lab - Class ${className}`,
      materialsNeeded: materialsNeeded || 'Standard lab equipment',
      numberOfGroups: numberOfGroups || 1,
      needsTechSupport,
      safetyItems: selectedSafetyItems,
      techNotes,
      needsPrintedWorksheets,
      worksheetCopies: needsPrintedWorksheets ? worksheetCopies : 0,
      fileName,
      fileUrl
    };

    onSubmit({
      day,
      period,
      labId,
      slotIndex,
      teacher,
      className,
      subject: subject || experimentName,
      isOverride: forceOverride,
      experimentDetails: expDetails
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-900 transition-all">
        
        {/* Modal Header & Step Indicator */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                Step {step} of 2
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {step === 1 ? '1. Reservation Details' : '2. Experiment & Materials Setup'}
              </h3>
            </div>
            <p className="text-xs text-indigo-600 font-medium mt-0.5 capitalize">
              {day} • Period {period} • {currentLabObj?.name || labId}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg p-1.5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Basic Reservation Details */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-3.5 text-xs">
            
            {/* Day & Period */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Day</label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value as Day)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
                >
                  {DAYS_LIST.map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
                >
                  {PERIODS_LIST.map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select Lab */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lab Room</label>
              <select
                value={labId}
                onChange={(e) => setLabId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
              >
                {currentSectionData.labs.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                ))}
              </select>
            </div>

            {/* Teacher */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Teacher</label>
              <select
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
              >
                <option value="" disabled>Select teacher...</option>
                {currentSectionData.teachers.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Class</label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
              >
                <option value="" disabled>Select class...</option>
                {currentSectionData.classes.map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>

            {/* Subject / Topic */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject / General Topic (Optional)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Organic Chemistry, Physics Optics..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>

            {/* Validation Feedback */}
            {validation && (
              <div className="pt-1">
                {validation.isValid ? (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Lab available! Up to 3 active lab slots per period.</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-800">
                      <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Booking Not Allowed</span>
                    </div>
                    {validation.errors.map((err, i) => (
                      <p key={i} className="text-[11px] text-rose-700 pl-5">
                        • {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 1 Actions */}
            <div className="pt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={validation !== null && !validation.isValid && !isAdminLoggedIn}
                className={`w-2/3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  validation && !validation.isValid && !isAdminLoggedIn
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer'
                }`}
              >
                <span>Next: Materials & Experiment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>
        )}

        {/* STEP 2: Required Materials & Experiment Details */}
        {step === 2 && (
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1">
            
            {/* Experiment Name */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
                <span>Experiment Name <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                value={experimentName}
                onChange={(e) => setExperimentName(e.target.value)}
                placeholder="e.g. Acid-Base Titration & pH Measurement"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>

            {/* Materials Needed */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Required Materials & Chemicals</span>
              </label>
              <textarea
                rows={2}
                value={materialsNeeded}
                onChange={(e) => setMaterialsNeeded(e.target.value)}
                placeholder="List required apparatus or chemicals (e.g., 5x 250ml Beakers, Hydrochloric Acid 0.1M, Phenolphthalein, Bunsen Burners...)"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>

            {/* File Upload Option */}
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-indigo-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Upload Experiment Sheet / Video (Optional)</span>
                </span>
                <span className="text-[10px] text-indigo-500 font-normal">PDF, Word, Video (MP4/MOV), PNG</span>
              </label>

              {fileName ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-indigo-200 text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Paperclip className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{fileName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                    title="Remove attachment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 border-dashed border-indigo-200 bg-white hover:bg-indigo-50/50 text-indigo-700 text-xs font-semibold cursor-pointer transition">
                  <Upload className="w-4 h-4 text-indigo-500" />
                  <span>Choose file to upload...</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Printed Worksheets Question & Number */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Do you need printed worksheets?</span>
                </label>
                
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNeedsPrintedWorksheets(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      needsPrintedWorksheets
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedsPrintedWorksheets(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      !needsPrintedWorksheets
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {needsPrintedWorksheets && (
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-700">Number of printed copies required:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={worksheetCopies}
                    onChange={(e) => setWorksheetCopies(parseInt(e.target.value, 10) || 1)}
                    className="w-24 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 text-center"
                  />
                </div>
              )}
            </div>

            {/* Number of Groups & Tech Support */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Number of Groups</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={numberOfGroups}
                  onChange={(e) => setNumberOfGroups(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Lab Tech Support Needed?
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setNeedsTechSupport(true)}
                    className={`flex-1 py-1.5 rounded-lg font-semibold border transition text-center ${
                      needsTechSupport
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedsTechSupport(false)}
                    className={`flex-1 py-1.5 rounded-lg font-semibold border transition text-center ${
                      !needsTechSupport
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* Safety Items Needed */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Required Safety Items</span>
              </label>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {DEFAULT_SAFETY_ITEMS.map((item) => {
                  const isSelected = selectedSafetyItems.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleSafetyItem(item)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                        isSelected
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{item}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSafetyItem}
                  onChange={(e) => setCustomSafetyItem(e.target.value)}
                  placeholder="Other safety item..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSafetyItem}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Tech Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Notes for Lab Technician
              </label>
              <textarea
                rows={2}
                value={techNotes}
                onChange={(e) => setTechNotes(e.target.value)}
                placeholder="Any special setup instructions, safety precautions, or chemical storage notes..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>

            {/* Step 2 Actions */}
            <div className="pt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              {validation && !validation.isValid && isAdminLoggedIn ? (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  className="w-2/3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Admin Force Book</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="w-2/3 py-2 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer"
                >
                  Confirm Reservation & Details
                </button>
              )}
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
