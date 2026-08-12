import React, { useState } from 'react';
import { X, Lock, ShieldCheck, Plus, Trash2, Calendar, RotateCcw, Layers, Users, BookOpen, BarChart3, FlaskConical, FileText, Search, Shield, Paperclip, Printer } from 'lucide-react';
import { Reservation, SectionData } from '../types';
import { DAYS_LIST } from '../data/initialData';
import { getEffectiveExperimentDetails } from '../utils/experimentUtils';

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

  // Active Admin View Tab
  const [activeTab, setActiveTab] = useState<'settings' | 'stats' | 'log'>('settings');

  // Stats & Log Filter State
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState('ALL');

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

  // Gathering all reservations for statistics
  const allCurrentReservations: Reservation[] = [];
  Object.values(sectionData.reservations).forEach(list => {
    if (Array.isArray(list)) {
      allCurrentReservations.push(...list);
    }
  });

  // Include historical reservations if present
  const allHistoricalReservations: { week: number; reservation: Reservation }[] = [];
  if (sectionData.history && Array.isArray(sectionData.history)) {
    sectionData.history.forEach(item => {
      if (item.reservations) {
        Object.values(item.reservations).forEach(list => {
          if (Array.isArray(list)) {
            list.forEach(r => allHistoricalReservations.push({ week: item.week, reservation: r }));
          }
        });
      }
    });
  }

  // Combined active + history for comprehensive reporting
  const allCombinedReservations = [
    ...allCurrentReservations,
    ...allHistoricalReservations.map(h => h.reservation)
  ];

  // Calculate stats using effective experiment details
  const totalReservations = allCombinedReservations.length;
  const totalExperimentsWithDetails = allCombinedReservations.length;
  const totalTechSupportRequests = allCombinedReservations.filter(r => getEffectiveExperimentDetails(r).needsTechSupport).length;
  
  const totalGroupsServed = allCombinedReservations.reduce((sum, r) => {
    return sum + (getEffectiveExperimentDetails(r).numberOfGroups || 1);
  }, 0);

  const totalWorksheetCopiesNeeded = allCombinedReservations.reduce((sum, r) => {
    const exp = getEffectiveExperimentDetails(r);
    return sum + (exp.needsPrintedWorksheets ? (exp.worksheetCopies || 0) : 0);
  }, 0);

  const totalUploadedFiles = allCombinedReservations.filter(r => {
    const exp = getEffectiveExperimentDetails(r);
    return Boolean(exp.fileName && exp.fileUrl);
  }).length;

  // Stats per Teacher
  const teacherStatsMap: Record<string, { count: number; experiments: string[]; totalGroups: number; worksheets: number }> = {};
  allCombinedReservations.forEach(r => {
    const exp = getEffectiveExperimentDetails(r);
    if (!teacherStatsMap[r.teacher]) {
      teacherStatsMap[r.teacher] = { count: 0, experiments: [], totalGroups: 0, worksheets: 0 };
    }
    teacherStatsMap[r.teacher].count += 1;
    if (exp.experimentName) {
      teacherStatsMap[r.teacher].experiments.push(exp.experimentName);
    }
    if (exp.numberOfGroups) {
      teacherStatsMap[r.teacher].totalGroups += exp.numberOfGroups;
    }
    if (exp.needsPrintedWorksheets && exp.worksheetCopies) {
      teacherStatsMap[r.teacher].worksheets += exp.worksheetCopies;
    }
  });

  // Safety items frequency map
  const safetyItemsFreq: Record<string, number> = {};
  allCombinedReservations.forEach(r => {
    const exp = getEffectiveExperimentDetails(r);
    if (exp.safetyItems && Array.isArray(exp.safetyItems)) {
      exp.safetyItems.forEach(item => {
        safetyItemsFreq[item] = (safetyItemsFreq[item] || 0) + 1;
      });
    }
  });

  // Filtered log items
  const filteredLog = allCombinedReservations.filter(r => {
    if (selectedTeacherFilter !== 'ALL' && r.teacher !== selectedTeacherFilter) {
      return false;
    }
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const name = r.experimentDetails?.experimentName.toLowerCase() || '';
      const mat = r.experimentDetails?.materialsNeeded.toLowerCase() || '';
      const t = r.teacher.toLowerCase();
      const c = r.className.toLowerCase();
      const notes = r.experimentDetails?.techNotes?.toLowerCase() || '';
      const fn = r.experimentDetails?.fileName?.toLowerCase() || '';
      return name.includes(q) || mat.includes(q) || t.includes(q) || c.includes(q) || notes.includes(q) || fn.includes(q);
    }
    return true;
  });

  const handleDownloadFile = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'worksheet_file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[92vh] overflow-y-auto text-slate-900 font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b-2 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                Science Lab Admin Panel
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                System configuration, lab scheduling controls, & experiment analytics.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg p-2 transition border border-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AUTHENTICATION SCREEN IF NOT LOGGED IN */}
        {!isAdminLoggedIn ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-sm mx-auto py-8 text-center font-sans">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-xs">
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
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600 text-center"
            />

            {authError && (
              <p className="text-xs font-mono text-rose-600 font-bold">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold uppercase tracking-wider text-xs rounded-xl transition shadow-xs cursor-pointer"
            >
              Unlock Admin Panel
            </button>
          </form>
        ) : (
          /* ADMIN DASHBOARD CONTENT WITH TABS */
          <div className="space-y-5 font-sans">
            
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
                  activeTab === 'settings'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Settings & Controls</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
                  activeTab === 'stats'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Experiments & Usage Stats</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('log')}
                className={`pb-2.5 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
                  activeTab === 'log'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FlaskConical className="w-4 h-4" />
                <span>Materials & Worksheets Log</span>
              </button>
            </div>

            {/* TAB 1: SETTINGS & CONTROLS */}
            {activeTab === 'settings' && (
              <div className="space-y-5">
                
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
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-600 font-mono font-bold text-xs uppercase tracking-wider">
                      <Calendar className="w-4 h-4" />
                      <span>Weekly Booking Cutoff</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={deadlineDay}
                        onChange={(e) => setDeadlineDay(parseInt(e.target.value, 10))}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900"
                      >
                        {DAYS_LIST.map((d, idx) => (
                          <option key={d.id} value={idx}>{d.label}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={deadlineTime}
                        onChange={(e) => setDeadlineTime(e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900"
                      />
                    </div>
                    <button
                      onClick={handleDeadlineSubmit}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition"
                    >
                      Save Cutoff
                    </button>
                  </div>

                  {/* Weekly Rollover / Open Next Week */}
                  <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 flex flex-col justify-between">
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
                      className="mt-3 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition shadow-xs"
                    >
                      Archive & Start Week {sectionData.weekNumber + 1}
                    </button>
                  </div>

                </div>

                {/* Middle Row: Manage Labs */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-mono font-bold text-xs uppercase tracking-wider">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>Manage Labs ({sectionData.labs.length} Configured)</span>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                      Supports up to 3 active lab reservations per period
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {sectionData.labs.map(lab => (
                      <div key={lab.id} className="bg-white border border-slate-300 rounded-lg p-2 flex items-center justify-between">
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
                      className="w-1/2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                    />
                    <input
                      type="text"
                      value={newLabCode}
                      onChange={(e) => setNewLabCode(e.target.value)}
                      placeholder="Code..."
                      className="w-1/3 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                    />
                    <button
                      type="submit"
                      className="w-1/6 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-lg flex items-center justify-center uppercase cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Bottom Row: Manage Teachers & Classes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Teachers */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-mono font-bold text-xs uppercase tracking-wider mb-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>Teachers List</span>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 mb-3">
                      {sectionData.teachers.map((t, idx) => (
                        <div key={idx} className="bg-white px-3 py-1 rounded-lg border border-slate-300 flex justify-between items-center text-xs font-mono text-slate-800">
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
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                      />
                      <button type="submit" className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-lg uppercase cursor-pointer">
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Classes */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-mono font-bold text-xs uppercase tracking-wider mb-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>Classes List</span>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 mb-3">
                      {sectionData.classes.map((c, idx) => (
                        <div key={idx} className="bg-white px-3 py-1 rounded-lg border border-slate-300 flex justify-between items-center text-xs font-mono text-slate-800">
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
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                      />
                      <button type="submit" className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-lg uppercase cursor-pointer">
                        Add
                      </button>
                    </form>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: EXPERIMENT STATISTICS & TEACHER CONDUCTED LABS */}
            {activeTab === 'stats' && (
              <div className="space-y-5">
                
                {/* Header Actions for Stats */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      <span>Teacher Conducted Experiments Statistics</span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Overview of total experiments conducted per teacher, schedule days, and materials required.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const headers = [
                        'Teacher',
                        'Day',
                        'Period',
                        'Class',
                        'Lab Name',
                        'Experiment Title',
                        'Materials & Chemicals Needed',
                        'Number of Groups',
                        'Tech Support Needed',
                        'Worksheet Copies',
                        'Safety Equipment'
                      ];

                      const rows = allCombinedReservations.map(r => {
                        const labObj = sectionData.labs.find(l => l.id === r.labId);
                        const labName = labObj ? labObj.name : r.labId;
                        const exp = getEffectiveExperimentDetails(r);
                        return [
                          `"${r.teacher.replace(/"/g, '""')}"`,
                          `"${r.day}"`,
                          `"Period ${r.period}"`,
                          `"${r.className}"`,
                          `"${labName.replace(/"/g, '""')}"`,
                          `"${(exp.experimentName || r.subject || '').replace(/"/g, '""')}"`,
                          `"${(exp.materialsNeeded || '').replace(/"/g, '""')}"`,
                          `"${exp.numberOfGroups || 1}"`,
                          `"${exp.needsTechSupport ? 'Yes' : 'No'}"`,
                          `"${exp.needsPrintedWorksheets ? exp.worksheetCopies : 0}"`,
                          `"${(exp.safetyItems || []).join(', ').replace(/"/g, '""')}"`
                        ].join(',');
                      });

                      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute('download', `Teacher_Experiments_Statistics_${sectionData.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-2xs shrink-0 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export Teacher Statistics (CSV)</span>
                  </button>
                </div>
                
                {/* Stat Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">Total Bookings</span>
                    <span className="text-2xl font-black text-indigo-900">{totalReservations}</span>
                    <span className="text-[10px] text-indigo-600 font-medium block mt-0.5">Active & historical lab slots</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Practical Experiments</span>
                    <span className="text-2xl font-black text-purple-900">{totalExperimentsWithDetails}</span>
                    <span className="text-[10px] text-purple-600 font-medium block mt-0.5">Recorded with materials</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Tech Support Needed</span>
                    <span className="text-2xl font-black text-blue-900">{totalTechSupportRequests}</span>
                    <span className="text-[10px] text-blue-600 font-medium block mt-0.5">Technician assistance requests</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Student Groups</span>
                    <span className="text-2xl font-black text-emerald-900">{totalGroupsServed}</span>
                    <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Total lab practical groups</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Worksheet Print Copies</span>
                    <span className="text-2xl font-black text-amber-900">{totalWorksheetCopiesNeeded}</span>
                    <span className="text-[10px] text-amber-600 font-medium block mt-0.5">Requested printed sheets</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-950">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">Uploaded Worksheet Files</span>
                    <span className="text-2xl font-black text-teal-900">{totalUploadedFiles}</span>
                    <span className="text-[10px] text-teal-600 font-medium block mt-0.5">Attached protocol documents</span>
                  </div>
                </div>

                {/* Teacher Experiment Conducted Summary Table */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>Conducted Experiments Matrix per Teacher</span>
                    </h4>
                    <span className="text-[10px] font-mono text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      Day & Experiment Mapping for Admin Statistics
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                    {sectionData.teachers.map((tName) => {
                      const teacherResList = allCombinedReservations.filter(r => r.teacher === tName);
                      if (teacherResList.length === 0) {
                        return (
                          <div key={tName} className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                            <div className="flex justify-between items-center font-bold text-slate-900">
                              <span>{tName}</span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">
                                0 sessions scheduled
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={tName} className="p-3.5 rounded-xl bg-white border-2 border-slate-200 text-xs space-y-2">
                          <div className="flex justify-between items-center font-black text-slate-900 border-b pb-2 border-slate-200">
                            <span className="text-sm text-indigo-950">{tName}</span>
                            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-900 rounded-full text-[10.5px] font-extrabold">
                              {teacherResList.length} {teacherResList.length === 1 ? 'Experiment Session' : 'Experiment Sessions'}
                            </span>
                          </div>

                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="p-2">Day & Period</th>
                                  <th className="p-2">Lab & Class</th>
                                  <th className="p-2">Experiment Title</th>
                                  <th className="p-2">Materials Needed</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                 {teacherResList.map((res, idx) => {
                                  const labObj = sectionData.labs.find(l => l.id === res.labId);
                                  const labName = labObj ? labObj.name : res.labId;
                                  const exp = getEffectiveExperimentDetails(res);
                                  return (
                                    <tr key={res.id || idx} className="hover:bg-slate-50">
                                      <td className="p-2 font-bold text-indigo-700 capitalize">
                                        {res.day} • P{res.period}
                                      </td>
                                      <td className="p-2 font-semibold text-slate-800">
                                        {labName} <span className="text-slate-500">({res.className})</span>
                                      </td>
                                      <td className="p-2 font-black text-slate-900">
                                        {exp.experimentName}
                                      </td>
                                      <td className="p-2 font-mono text-[10.5px] text-slate-800 whitespace-pre-wrap max-w-xs">
                                        {exp.materialsNeeded}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Safety Items Usage Breakdown */}
                {Object.keys(safetyItemsFreq).length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>Requested Safety Equipment Breakdown</span>
                    </h4>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(safetyItemsFreq).map(([item, count]) => (
                        <div key={item} className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                          <span>{item}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-black">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB 3: MATERIALS & EXPERIMENTS LOG */}
            {activeTab === 'log' && (
              <div className="space-y-4">
                
                {/* Search & Filter Header */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-2/3">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder="Search experiment, materials, file name, or teacher..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                    />
                  </div>

                  <select
                    value={selectedTeacherFilter}
                    onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                    className="w-full sm:w-1/3 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    <option value="ALL">All Teachers</option>
                    {sectionData.teachers.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Log Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Teacher & Class</th>
                        <th className="p-2.5">Lab & Period</th>
                        <th className="p-2.5">Experiment & Materials</th>
                        <th className="p-2.5">Printed Worksheets & Files</th>
                        <th className="p-2.5">Safety Gear</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredLog.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                            No experiment details found matching your filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredLog.map((res, i) => {
                          const labObj = sectionData.labs.find(l => l.id === res.labId);
                          const labName = labObj ? labObj.name : res.labId;
                          const exp = res.experimentDetails;

                          return (
                            <tr key={res.id || i} className="hover:bg-slate-50 transition">
                              <td className="p-2.5 align-top">
                                <span className="font-bold text-slate-900 block">{res.teacher}</span>
                                <span className="text-[10px] text-slate-500">Class {res.className}</span>
                              </td>

                              <td className="p-2.5 align-top">
                                <span className="font-semibold text-indigo-700 block">{labName}</span>
                                <span className="text-[10px] text-slate-500 capitalize">{res.day} • P{res.period}</span>
                              </td>

                              <td className="p-2.5 align-top">
                                <span className="font-extrabold text-slate-900 block">{exp?.experimentName || res.subject || 'Practical Lab'}</span>
                                {exp?.materialsNeeded && (
                                  <p className="text-[10.5px] font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 mt-1 whitespace-pre-wrap">
                                    {exp.materialsNeeded}
                                  </p>
                                )}
                                {exp?.techNotes && (
                                  <p className="text-[10px] italic text-amber-800 mt-1">
                                    Notes: "{exp.techNotes}"
                                  </p>
                                )}
                              </td>

                              <td className="p-2.5 align-top space-y-1">
                                <div>
                                  {exp?.needsPrintedWorksheets ? (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold text-[10px] block w-fit">
                                      🖨️ {exp.worksheetCopies} Copies Req.
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">No prints needed</span>
                                  )}
                                </div>

                                {exp?.fileName && exp?.fileUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(exp.fileUrl, exp.fileName)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[10.5px] font-bold flex items-center gap-1 transition truncate max-w-[150px] cursor-pointer"
                                    title={`Download ${exp.fileName}`}
                                  >
                                    <Paperclip className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span className="truncate">{exp.fileName}</span>
                                  </button>
                                ) : null}
                              </td>

                              <td className="p-2.5 align-top">
                                {exp?.safetyItems && exp.safetyItems.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {exp.safetyItems.map((s, idx) => (
                                      <span key={idx} className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9.5px]">
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* Bottom Demo Reset & Close Buttons */}
            <div className="pt-3 flex justify-between items-center border-t-2 border-slate-200">
              <button
                type="button"
                onClick={onResetDemoData}
                className="text-xs font-mono font-bold text-amber-700 hover:text-amber-900 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo Data</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer"
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
