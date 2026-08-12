import React, { useState } from 'react';
import { X, Lock, ShieldCheck, Plus, Trash2, Calendar, RotateCcw, AlertTriangle, Layers, Users, BookOpen } from 'lucide-react';
import { Lab, SectionData } from '../types';
import { DAYS_LIST } from '../data/initialData';

interface AdminModalProps {
  isOpen: boolean;
  isAdminLoggedIn: boolean;
  sectionData: SectionData;
  onClose: () => void;
  onLogin: (pass: string) => boolean;
  onUpdateDeadline: (day: number, time: string) => void;
  onToggleLockSchedule: (isLocked: boolean) => void;
  onOpenNewWeek: () => void;
  onAddTeacher: (name: string) => void;
  onRemoveTeacher: (index: number) => void;
  onAddClass: (className: string) => void;
  onRemoveClass: (index: number) => void;
  onAddLab: (name: string, code: string) => void;
  onRemoveLab: (id: string) => void;
  onResetDemoData: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  isAdminLoggedIn,
  sectionData,
  onClose,
  onLogin,
  onUpdateDeadline,
  onToggleLockSchedule,
  onOpenNewWeek,
  onAddTeacher,
  onRemoveTeacher,
  onAddClass,
  onRemoveClass,
  onAddLab,
  onRemoveLab,
  onResetDemoData,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Admin Form Inputs
  const [deadlineDay, setDeadlineDay] = useState(sectionData.deadlineDay);
  const [deadlineTime, setDeadlineTime] = useState(sectionData.deadlineTime);

  const [newTeacherName, setNewTeacherName] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newLabName, setNewLabName] = useState('');
  const [newLabCode, setNewLabCode] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(passwordInput);
    if (!success) {
      setAuthError('Incorrect password.');
    } else {
      setAuthError('');
      setPasswordInput('');
    }
  };

  const handleDeadlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDeadline(deadlineDay, deadlineTime);
  };

  const handleAddTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeacherName.trim()) {
      onAddTeacher(newTeacherName.trim());
      setNewTeacherName('');
    }
  };

  const handleAddClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClassName.trim()) {
      onAddClass(newClassName.trim());
      setNewClassName('');
    }
  };

  const handleAddLabSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLabName.trim()) {
      onAddLab(newLabName.trim(), newLabCode.trim() || `LAB-0${sectionData.labs.length + 1}`);
      setNewLabName('');
      setNewLabCode('');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-lg shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto text-slate-900 font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-3 border-b-2 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-indigo-600 text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Global Admin Panel</h3>
              <p className="text-xs text-slate-500 font-mono">
                Manage 5 labs, set deadlines, edit teachers & classes, or open a new week.
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

        {/* AUTHENTICATION SCREEN IF NOT LOGGED IN */}
        {!isAdminLoggedIn ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-sm mx-auto py-8 text-center font-sans">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-sm mx-auto flex items-center justify-center shadow-xs">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-base font-black uppercase tracking-wide text-slate-900">Admin Authentication</h4>
              <p className="text-xs text-slate-500 mt-1">Enter password to access administrator controls</p>
            </div>

            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter admin password..."
              required
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600 text-center"
            />

            {authError && (
              <p className="text-xs font-mono text-rose-600 font-bold">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold uppercase tracking-wider text-xs rounded transition shadow-xs cursor-pointer"
            >
              Unlock Admin Panel
            </button>
          </form>
        ) : (
          /* ADMIN DASHBOARD CONTENT */
          <div className="space-y-6 font-sans">
            
            {/* Lock Control Banner */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              sectionData.isLocked 
                ? 'bg-rose-50 border-rose-200 text-rose-950' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${sectionData.isLocked ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">
                    Schedule Status: {sectionData.isLocked ? 'Locked (Bookings Disabled for Teachers)' : 'Unlocked (Open for Teacher Bookings)'}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {sectionData.isLocked 
                      ? 'Teachers cannot add or alter bookings right now.' 
                      : 'By default, bookings are open and unlocked for all teachers.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleLockSchedule(!sectionData.isLocked)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition shadow-2xs ${
                  sectionData.isLocked 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {sectionData.isLocked ? 'Unlock Booking' : 'Lock Booking'}
              </button>
            </div>

            {/* Top Row: Deadline & New Week */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Deadline Setting */}
              <div className="bg-slate-50 p-4 rounded border border-slate-300 space-y-3">
                <div className="flex items-center gap-2 text-indigo-600 font-mono font-bold text-xs uppercase tracking-wider">
                  <Calendar className="w-4 h-4" />
                  <span>Weekly Booking Cutoff</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={deadlineDay}
                    onChange={(e) => setDeadlineDay(parseInt(e.target.value, 10))}
                    className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  >
                    {DAYS_LIST.map((d, idx) => (
                      <option key={d.id} value={idx}>{d.label}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
                <button
                  onClick={handleDeadlineSubmit}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold uppercase tracking-wider rounded transition"
                >
                  Save Cutoff
                </button>
              </div>

              {/* Weekly Rollover / Open Next Week */}
              <div className="bg-indigo-50/60 p-4 rounded border border-indigo-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-indigo-900 font-mono font-bold text-xs uppercase tracking-wider mb-1">
                    <RotateCcw className="w-4 h-4 text-indigo-600" />
                    <span>Open Next Week (Archive Current)</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Archives active week into History log and resets grid for Week {sectionData.weekNumber + 1}.
                  </p>
                </div>
                <button
                  onClick={onOpenNewWeek}
                  className="mt-3 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold uppercase tracking-wider rounded transition shadow-xs"
                >
                  Archive & Start Week {sectionData.weekNumber + 1}
                </button>
              </div>

            </div>

            {/* Middle Row: Manage 5 Labs */}
            <div className="bg-slate-50 p-4 rounded border border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-mono font-bold text-xs uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Manage Labs ({sectionData.labs.length} Configured)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">Supports 2 slots per period</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                {sectionData.labs.map(lab => (
                  <div key={lab.id} className="bg-white border border-slate-300 rounded p-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{lab.name}</p>
                      <p className="text-[10px] text-indigo-600 font-mono font-semibold">{lab.code}</p>
                    </div>
                    {sectionData.labs.length > 1 && (
                      <button
                        onClick={() => onRemoveLab(lab.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove Lab"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Lab Form */}
              <form onSubmit={handleAddLabSubmit} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value)}
                  placeholder="Lab Name..."
                  className="w-1/2 bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-mono text-slate-900"
                />
                <input
                  type="text"
                  value={newLabCode}
                  onChange={(e) => setNewLabCode(e.target.value)}
                  placeholder="Code..."
                  className="w-1/3 bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-mono text-slate-900"
                />
                <button
                  type="submit"
                  className="w-1/6 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded flex items-center justify-center uppercase"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Bottom Row: Manage Teachers & Classes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Teachers */}
              <div className="bg-slate-50 p-4 rounded border border-slate-300 flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-mono font-bold text-xs uppercase tracking-wider mb-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Teachers List</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 mb-3">
                  {sectionData.teachers.map((t, idx) => (
                    <div key={idx} className="bg-white px-3 py-1 rounded border border-slate-300 flex justify-between items-center text-xs font-mono text-slate-800">
                      <span>{t}</span>
                      <button onClick={() => onRemoveTeacher(idx)} className="text-slate-400 hover:text-rose-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddTeacherSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    placeholder="New Teacher..."
                    className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-mono text-slate-900"
                  />
                  <button type="submit" className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded uppercase">
                    Add
                  </button>
                </form>
              </div>

              {/* Classes */}
              <div className="bg-slate-50 p-4 rounded border border-slate-300 flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-mono font-bold text-xs uppercase tracking-wider mb-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>Classes List</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 mb-3">
                  {sectionData.classes.map((c, idx) => (
                    <div key={idx} className="bg-white px-3 py-1 rounded border border-slate-300 flex justify-between items-center text-xs font-mono text-slate-800">
                      <span>Class {c}</span>
                      <button onClick={() => onRemoveClass(idx)} className="text-slate-400 hover:text-rose-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddClassSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="New Class (e.g. 5C)..."
                    className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-mono text-slate-900"
                  />
                  <button type="submit" className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded uppercase">
                    Add
                  </button>
                </form>
              </div>

            </div>

            {/* Bottom Demo Reset Button */}
            <div className="pt-2 flex justify-between items-center border-t-2 border-slate-200">
              <button
                type="button"
                onClick={onResetDemoData}
                className="text-xs font-mono font-bold text-amber-700 hover:text-amber-900 uppercase tracking-wider flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo Data</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-mono font-bold uppercase tracking-wider transition"
              >
                Close Admin Panel
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
