import React, { useState, useEffect, useMemo } from 'react';
import { AppState, Day, Section, Reservation, ConflictAlert } from './types';
import { INITIAL_APP_STATE, DEFAULT_LABS } from './data/initialData';
import { detectAllConflicts } from './utils/conflictDetector';
import {
  seedInitialDataIfNeeded,
  subscribeToAppState,
  addOrUpdateReservation,
  removeReservation,
  updateSectionSettings,
  openNewWeekInFirestore
} from './services/firebaseService';

import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { ScheduleGrid } from './components/ScheduleGrid';
import { BookingModal } from './components/BookingModal';
import { ConflictResolverModal } from './components/ConflictResolverModal';
import { AdminModal } from './components/AdminModal';
import { HistoryModal } from './components/HistoryModal';
import { SectionSelector } from './components/SectionSelector';
import { NotificationToast, ToastMessage } from './components/NotificationToast';

export default function App() {
  // App State with Firebase Firestore Realtime Sync
  const [appState, setAppState] = useState<AppState>(INITIAL_APP_STATE);

  useEffect(() => {
    // Seed initial data if Firestore is empty on first boot
    seedInitialDataIfNeeded();

    // Subscribe to real-time changes in Firestore
    const unsubscribe = subscribeToAppState((newState) => {
      setAppState(newState);
    });

    return () => unsubscribe();
  }, []);

  // Selected Section (starts as null to show section landing screen)
  const [currentSection, setCurrentSection] = useState<Section | null>(null);

  // Admin Auth
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLabFilter, setSelectedLabFilter] = useState<string>('ALL');

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingSlot, setBookingSlot] = useState<{
    day: Day;
    period: number;
    labId: string;
    slotIndex: number;
  }>({
    day: 'sunday',
    period: 1,
    labId: 'lab-1',
    slotIndex: 0
  });

  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Toast Notification
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ id: Date.now().toString(), type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Active section data
  const currentSectionData = appState[currentSection];
  const otherSectionKey: Section = currentSection === 'boys' ? 'girls' : 'boys';
  const otherSectionData = appState[otherSectionKey];

  // Real-time conflict recalculation
  const activeConflicts: ConflictAlert[] = useMemo(() => {
    if (!currentSectionData) return [];
    return detectAllConflicts(currentSectionData, otherSectionData);
  }, [currentSectionData, otherSectionData]);

  // Count total booked slots
  const totalBookingsCount = useMemo(() => {
    if (!currentSectionData) return 0;
    let count = 0;
    Object.values(currentSectionData.reservations).forEach(list => {
      if (Array.isArray(list)) count += list.length;
    });
    return count;
  }, [currentSectionData]);

  // --- HANDLERS ---

  const handleSelectSection = (sec: Section) => {
    setCurrentSection(sec);
  };

  const handleOpenGeneralBook = () => {
    const firstLab = currentSectionData.labs[0]?.id || 'lab-1';
    setBookingSlot({ day: 'sunday', period: 1, labId: firstLab, slotIndex: 0 });
    setIsBookingModalOpen(true);
  };

  const handleOpenQuickBook = (day: Day, period: number, labId: string, slotIndex: number) => {
    // Check if schedule is explicitly locked by admin
    if (currentSectionData && currentSectionData.isLocked && !isAdminLoggedIn) {
      showToast(`Booking is currently locked by Administrator.`, 'error');
      return;
    }

    setBookingSlot({ day, period, labId, slotIndex });
    setIsBookingModalOpen(true);
  };

  const handleAddReservation = async (bookingData: {
    day: Day;
    period: number;
    labId: string;
    slotIndex: number;
    teacher: string;
    className: string;
    subject?: string;
    isOverride?: boolean;
  }) => {
    if (!currentSection) return;

    const newRes: Reservation = {
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      day: bookingData.day,
      period: bookingData.period,
      labId: bookingData.labId,
      slotIndex: bookingData.slotIndex,
      teacher: bookingData.teacher,
      className: bookingData.className,
      subject: bookingData.subject,
      createdAt: new Date().toISOString(),
      isOverride: bookingData.isOverride
    };

    try {
      await addOrUpdateReservation(currentSection, newRes);
      showToast(`Reservation confirmed for ${bookingData.teacher} (Slot ${bookingData.slotIndex + 1})`, 'success');
    } catch (err) {
      console.error('Add reservation error:', err);
      showToast('Failed to save reservation to cloud.', 'error');
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!currentSection) return;

    try {
      await removeReservation(reservationId);
      showToast('Reservation cancelled.', 'info');
    } catch (err) {
      console.error('Cancel reservation error:', err);
      showToast('Failed to cancel reservation.', 'error');
    }
  };

  // Admin Actions
  const handleAdminLogin = (pass: string) => {
    if (pass === 'admin123') {
      setIsAdminLoggedIn(true);
      showToast('Admin access granted.', 'success');
      return true;
    }
    return false;
  };

  const handleUpdateDeadline = async (day: number, time: string) => {
    if (!currentSection) return;
    try {
      await updateSectionSettings(currentSection, { deadlineDay: day, deadlineTime: time });
      showToast('Booking cutoff deadline updated.', 'success');
    } catch (err) {
      showToast('Failed to update deadline.', 'error');
    }
  };

  const handleToggleLockSchedule = async (isLocked: boolean) => {
    if (!currentSection) return;
    try {
      await updateSectionSettings(currentSection, { isLocked });
      showToast(`Schedule ${isLocked ? 'Locked' : 'Unlocked'} successfully.`, 'info');
    } catch (err) {
      showToast('Failed to update lock state.', 'error');
    }
  };

  const handleOpenNewWeek = async () => {
    if (!currentSection || !currentSectionData) return;

    try {
      await openNewWeekInFirestore(currentSection, currentSectionData);
      setIsAdminModalOpen(false);
      showToast('Schedule archived! New week opened.', 'success');
    } catch (err) {
      showToast('Failed to open new week.', 'error');
    }
  };

  const handleAddTeacher = async (name: string) => {
    if (!currentSection || !currentSectionData) return;
    try {
      const updated = [...currentSectionData.teachers, name];
      await updateSectionSettings(currentSection, { teachers: updated });
      showToast(`Teacher "${name}" added.`, 'success');
    } catch (err) {
      showToast('Failed to add teacher.', 'error');
    }
  };

  const handleRemoveTeacher = async (idx: number) => {
    if (!currentSection || !currentSectionData) return;
    try {
      const updated = [...currentSectionData.teachers];
      updated.splice(idx, 1);
      await updateSectionSettings(currentSection, { teachers: updated });
    } catch (err) {
      showToast('Failed to remove teacher.', 'error');
    }
  };

  const handleAddClass = async (className: string) => {
    if (!currentSection || !currentSectionData) return;
    try {
      const updated = [...currentSectionData.classes, className];
      await updateSectionSettings(currentSection, { classes: updated });
      showToast(`Class "${className}" added.`, 'success');
    } catch (err) {
      showToast('Failed to add class.', 'error');
    }
  };

  const handleRemoveClass = async (idx: number) => {
    if (!currentSection || !currentSectionData) return;
    try {
      const updated = [...currentSectionData.classes];
      updated.splice(idx, 1);
      await updateSectionSettings(currentSection, { classes: updated });
    } catch (err) {
      showToast('Failed to remove class.', 'error');
    }
  };

  const handleAddLab = async (name: string, code: string) => {
    if (!currentSection || !currentSectionData) return;
    const newLab = {
      id: `lab-${Date.now()}`,
      name,
      code,
      capacity: 30,
      color: 'indigo'
    };
    try {
      const updated = [...currentSectionData.labs, newLab];
      await updateSectionSettings(currentSection, { labs: updated });
      showToast(`Lab "${name}" added to list.`, 'success');
    } catch (err) {
      showToast('Failed to add lab.', 'error');
    }
  };

  const handleRemoveLab = async (id: string) => {
    if (!currentSection || !currentSectionData) return;
    if (currentSectionData.labs.length <= 1) {
      showToast('You must keep at least 1 lab available.', 'error');
      return;
    }
    try {
      const updated = currentSectionData.labs.filter(l => l.id !== id);
      await updateSectionSettings(currentSection, { labs: updated });
    } catch (err) {
      showToast('Failed to remove lab.', 'error');
    }
  };

  const handleResetDemoData = () => {
    setAppState(INITIAL_APP_STATE);
    setIsAdminModalOpen(false);
    showToast('Reset to default demo dataset.', 'info');
  };

  // If no section chosen, display SectionSelector
  if (!currentSection || !currentSectionData) {
    return (
      <>
        <SectionSelector 
          onSelectSection={handleSelectSection} 
          onOpenAdmin={() => setIsAdminModalOpen(true)} 
        />
        <AdminModal
          isOpen={isAdminModalOpen}
          isAdminLoggedIn={isAdminLoggedIn}
          sectionData={appState.boys}
          onClose={() => setIsAdminModalOpen(false)}
          onLogin={handleAdminLogin}
          onUpdateDeadline={handleUpdateDeadline}
          onOpenNewWeek={handleOpenNewWeek}
          onAddTeacher={handleAddTeacher}
          onRemoveTeacher={handleRemoveTeacher}
          onAddClass={handleAddClass}
          onRemoveClass={handleRemoveClass}
          onAddLab={handleAddLab}
          onRemoveLab={handleRemoveLab}
          onResetDemoData={handleResetDemoData}
        />
      </>
    );
  }

  const isBoys = currentSection === 'boys';
  const bgThemeClass = isBoys
    ? 'bg-emerald-50/90 text-slate-900 min-h-screen flex flex-col font-sans selection:bg-emerald-600 selection:text-white transition-colors duration-300'
    : 'bg-pink-50/90 text-slate-900 min-h-screen flex flex-col font-sans selection:bg-pink-600 selection:text-white transition-colors duration-300';

  return (
    <div className={bgThemeClass}>
      
      {/* Toast Notification */}
      <NotificationToast toast={toast} onClose={() => setToast(null)} />

      {/* Main App Header */}
      <Header
        currentSection={currentSection}
        sectionName={currentSectionData.name}
        weekNumber={currentSectionData.weekNumber}
        conflictCount={activeConflicts.length}
        isAdminLoggedIn={isAdminLoggedIn}
        onSelectSection={handleSelectSection}
        onReturnToSectionSelect={() => setCurrentSection(null)}
        onOpenQuickBook={handleOpenGeneralBook}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onOpenConflictResolver={() => setIsConflictModalOpen(true)}
      />

      {/* Main Content View */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full">
        
        {/* Statistics & Filter Controls */}
        <StatsBar
          totalBookings={totalBookingsCount}
          totalLabs={currentSectionData.labs.length}
          conflictCount={activeConflicts.length}
          labsList={currentSectionData.labs}
          searchQuery={searchQuery}
          selectedLabFilter={selectedLabFilter}
          onSearchChange={setSearchQuery}
          onLabFilterChange={setSelectedLabFilter}
          onResetFilters={() => {
            setSearchQuery('');
            setSelectedLabFilter('ALL');
          }}
        />

        {/* Schedule Matrix Grid */}
        <ScheduleGrid
          section={currentSection}
          labs={currentSectionData.labs}
          reservations={currentSectionData.reservations}
          conflicts={activeConflicts}
          searchQuery={searchQuery}
          selectedLabFilter={selectedLabFilter}
          onQuickBook={handleOpenQuickBook}
          onCancelReservation={handleCancelReservation}
        />

      </main>

      {/* Simple Footer */}
      <footer className="py-4 bg-white border-t border-slate-200 text-slate-500 text-xs px-6 flex items-center justify-between print:hidden">
        <span>Science Lab Scheduler</span>
        <span>Easy & Fast Lab Reservations</span>
      </footer>

      {/* MODALS */}
      <BookingModal
        isOpen={isBookingModalOpen}
        initialDay={bookingSlot.day}
        initialPeriod={bookingSlot.period}
        initialLabId={bookingSlot.labId}
        initialSlotIndex={bookingSlot.slotIndex}
        currentSectionData={currentSectionData}
        otherSectionData={otherSectionData}
        isAdminLoggedIn={isAdminLoggedIn}
        onClose={() => setIsBookingModalOpen(false)}
        onSubmit={handleAddReservation}
      />

      <ConflictResolverModal
        isOpen={isConflictModalOpen}
        conflicts={activeConflicts}
        onClose={() => setIsConflictModalOpen(false)}
        onCancelReservation={handleCancelReservation}
      />

      <AdminModal
        isOpen={isAdminModalOpen}
        isAdminLoggedIn={isAdminLoggedIn}
        sectionData={currentSectionData}
        onClose={() => setIsAdminModalOpen(false)}
        onLogin={handleAdminLogin}
        onUpdateDeadline={handleUpdateDeadline}
        onToggleLockSchedule={handleToggleLockSchedule}
        onOpenNewWeek={handleOpenNewWeek}
        onAddTeacher={handleAddTeacher}
        onRemoveTeacher={handleRemoveTeacher}
        onAddClass={handleAddClass}
        onRemoveClass={handleRemoveClass}
        onAddLab={handleAddLab}
        onRemoveLab={handleRemoveLab}
        onResetDemoData={handleResetDemoData}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        sectionData={currentSectionData}
        onClose={() => setIsHistoryModalOpen(false)}
      />

    </div>
  );
}
