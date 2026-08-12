import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertOctagon, ShieldAlert, UserCheck } from 'lucide-react';
import { Day, SectionData } from '../types';
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
  }) => void;
}

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
  const [day, setDay] = useState<Day>(initialDay);
  const [period, setPeriod] = useState<number>(initialPeriod);
  const [labId, setLabId] = useState<string>(initialLabId);
  const [slotIndex, setSlotIndex] = useState<number>(initialSlotIndex);
  const [teacher, setTeacher] = useState<string>('');
  const [className, setClassName] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  
  const [validation, setValidation] = useState<BookingValidationResult | null>(null);

  // Sync state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen, initialDay, initialPeriod, initialLabId, initialSlotIndex, currentSectionData]);

  // Run Conflict & Technician Validation whenever selection changes
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

  const handleSubmit = (e: React.FormEvent, forceOverride = false) => {
    e.preventDefault();
    if (!teacher || !className) return;

    if (!validation?.isValid && !forceOverride && !isAdminLoggedIn) {
      return;
    }

    onSubmit({
      day,
      period,
      labId,
      slotIndex,
      teacher,
      className,
      subject,
      isOverride: forceOverride
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 text-slate-900">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Reserve Science Lab
            </h3>
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

        {/* Technician Rule Callout */}
        <div className="mb-4 p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center gap-2 text-xs text-indigo-900">
          <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Only 1 Lab Technician on duty (Max 2 active labs / period).</span>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-3.5 text-xs">
          
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

          {/* Subject / Experiment Title */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject / Topic (Optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Acid Titration, Microscope Study..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500"
            />
          </div>

          {/* Validation Feedback */}
          {validation && (
            <div className="pt-1">
              {validation.isValid ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Lab available! Technician on duty.</span>
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

          {/* Actions */}
          <div className="pt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition"
            >
              Cancel
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
                disabled={validation !== null && !validation.isValid}
                className={`w-2/3 py-2 rounded-lg font-medium transition ${
                  validation && !validation.isValid
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
              >
                Confirm Reservation
              </button>
            )}
          </div>

        </form>

      </div>
    </div>
  );
};
