import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FlaskConical, AlertOctagon } from 'lucide-react';
import {
  AppState,
  Day,
  Section,
  Reservation,
  ConflictAlert,
  ExperimentDetails,
  SupervisorReview,
  Material,
  SectionData
} from './types';
import { INITIAL_APP_STATE } from './data/initialData';
import { detectAllConflicts } from './utils/conflictDetector';
import { themeFor } from './theme';
import { SCHOOL_NAME, SCHOOL_NAME_AR, SCHOOL_LABEL, DEPARTMENT_NAME } from './brand';
import {
  ADMIN_PASSWORD,
  MAX_TEACHER_NAME_LENGTH,
  MAX_CLASS_NAME_LENGTH,
  MAX_LAB_NAME_LENGTH
} from './constants';
import {
  seedInitialDataIfNeeded,
  subscribeToAppState,
  addOrUpdateReservation,
  removeReservation,
  updateSectionSettings,
  openNewWeekInFirestore,
  clearAllReservations,
  setSupervisorReview,
  subscribeToMaterials,
  saveMaterial,
  deleteMaterial,
  upsertMaterials,
  SlotTakenError
} from './services/firebaseService';

import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { ScheduleGrid } from './components/ScheduleGrid';
import { BookingModal } from './components/BookingModal';
import { ConflictResolverModal } from './components/ConflictResolverModal';
import { AdminModal } from './components/AdminModal';
import { HistoryModal } from './components/HistoryModal';
import { LockPeriodModal, LockSlot } from './components/LockPeriodModal';
import { SectionSelector } from './components/SectionSelector';
import { MaterialsModal } from './components/MaterialsModal';
import { MaterialImportDialog } from './components/MaterialImportDialog';
import { NotificationToast, ToastMessage, ToastAction } from './components/NotificationToast';
import { ConfirmDialog, ConfirmRequest } from './components/ConfirmDialog';

const LAST_SECTION_KEY = 'labScheduler.lastSection';

export default function App() {
  const [appState, setAppState] = useState<AppState>(INITIAL_APP_STATE);

  // Until Firestore answers, the app is rendering INITIAL_APP_STATE, which is
  // demo content. Showing it as if it were real made phantom bookings appear
  // and then vanish on every cold load.
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Seeding is best-effort: a database that is already populated needs no
    // seed, and a genuine connectivity failure surfaces through the
    // subscription's onError below. Failing here must not blank the app.
    seedInitialDataIfNeeded().catch((err) => {
      console.error('Initial seed skipped:', err);
    });

    const unsubscribe = subscribeToAppState({
      onStateChange: (newState) => {
        if (!cancelled) setAppState(newState);
      },
      onReady: () => {
        if (!cancelled) {
          setIsLoading(false);
          setLoadError(null);
        }
      },
      onError: (err) => {
        if (cancelled) return;
        setIsLoading(false);
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Lost connection to the scheduling database.'
        );
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const [currentSection, setCurrentSection] = useState<Section | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLabFilter, setSelectedLabFilter] = useState<string>('ALL');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('ALL');

  // Modals
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingSlot, setBookingSlot] = useState<{
    day: Day;
    period: number;
    labId: string;
    slotIndex: number;
  }>({ day: 'sunday', period: 1, labId: 'lab-1', slotIndex: 0 });

  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState<boolean>(false);
  const [lockSlotTarget, setLockSlotTarget] = useState<{ day: Day; period: number } | null>(null);

  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  /**
   * The materials inventory.
   *
   * Held whole rather than paged: Firestore cannot do substring search, and
   * searching by name, code, location or supplier is the entire point of the
   * feature. A school lab runs to hundreds of items, so the collection is small
   * enough to filter in memory.
   */
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  /**
   * Why the stockroom is empty, when it is empty for a reason other than
   * "nobody has added anything".
   *
   * A denied read resolves to an empty array, which the modal rendered as
   * "No materials yet" -- indistinguishable from a genuinely empty stockroom,
   * and the actual cause (Firestore rules refusing the collection) appeared
   * only in the browser console. An import into a collection that cannot be
   * read then failed at the last step with a generic message.
   */
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  /**
   * The school an import writes into.
   *
   * Normally the one you are looking at. It is only genuinely unknown when the
   * stockroom was opened from the picker screen, where the list covers both
   * schools -- and then the dialog asks rather than refusing.
   */
  const [importSection, setImportSection] = useState<Section | null>(null);

  const openImport = () => {
    setImportSection(currentSection);
    setIsImportOpen(true);
  };

  useEffect(
    () =>
      subscribeToMaterials(
        list => {
          setMaterials(list);
          setMaterialsError(null);
        },
        err => {
          console.error('Materials subscription error:', err);
          const denied =
            typeof err === 'object' && err !== null && 'code' in err &&
            (err as { code?: string }).code === 'permission-denied';
          setMaterialsError(
            denied
              ? 'The database is refusing access to the stockroom. Enable Anonymous ' +
                  'sign-in in the Firebase console, then deploy firestore.rules ' +
                  '(`firebase deploy --only firestore:rules`).'
              : 'Could not reach the stockroom. Check the connection and reload.'
          );
        }
      ),
    []
  );

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'info' = 'success',
      action?: ToastAction
    ) => {
      // Clearing the previous timer matters: without it an earlier timeout
      // dismissed the newer toast partway through its own lifetime.
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ id: `${Date.now()}`, type, message, action });
      toastTimerRef.current = window.setTimeout(
        () => setToast(null),
        action ? 8000 : 4000
      );
    },
    []
  );

  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Restore the last section so returning users skip the picker.
  useEffect(() => {
    const saved = window.localStorage.getItem(LAST_SECTION_KEY);
    if (saved === 'boys' || saved === 'girls') setCurrentSection(saved);
  }, []);

  const currentSectionData = currentSection ? appState[currentSection] : null;
  const otherSectionKey: Section = currentSection === 'boys' ? 'girls' : 'boys';

  /**
   * Which school the admin panel is editing.
   *
   * Separate from `currentSection` because the panel is reachable from the
   * school picker, where no timetable has been chosen yet. It used to be
   * rendered there hard-coded to "boys" while every one of its handlers bailed
   * out on `!currentSection` -- so the whole panel silently did nothing:
   * teachers appeared to be added, the week appeared to be set, and no write
   * ever left the browser.
   *
   * It follows the timetable you are looking at, and the panel exposes a
   * switcher so one administrator can set up both schools without leaving.
   */
  const [adminSection, setAdminSection] = useState<Section>('boys');
  useEffect(() => {
    if (currentSection) setAdminSection(currentSection);
  }, [currentSection]);
  const adminSectionData = appState[adminSection];
  const otherSectionData = appState[otherSectionKey];

  const activeConflicts: ConflictAlert[] = useMemo(() => {
    if (!currentSectionData) return [];
    return detectAllConflicts(currentSectionData, otherSectionData);
  }, [currentSectionData, otherSectionData]);

  const countBookings = (data: SectionData | null) =>
    data
      ? Object.values(data.reservations).reduce(
          (count, list) => count + (Array.isArray(list) ? list.length : 0),
          0
        )
      : 0;

  const totalBookingsCount = useMemo(
    () => countBookings(currentSectionData),
    [currentSectionData]
  );

  /** Bookings in whichever school the admin panel is pointed at. */
  const adminBookingsCount = useMemo(
    () => countBookings(adminSectionData),
    [adminSectionData]
  );

  // --- HANDLERS ---

  const handleSelectSection = (sec: Section) => {
    setCurrentSection(sec);
    window.localStorage.setItem(LAST_SECTION_KEY, sec);
  };

  const handleReturnToSectionSelect = () => {
    setCurrentSection(null);
    window.localStorage.removeItem(LAST_SECTION_KEY);
  };

  /** Shared guard for both entry points into the booking modal. */
  const openBookingModal = (
    day: Day,
    period: number,
    labId: string,
    slotIndex: number
  ) => {
    if (!currentSectionData) return;

    if (currentSectionData.isLocked && !isAdminLoggedIn) {
      showToast('Booking is currently locked by the administrator.', 'error');
      return;
    }

    const blocked = currentSectionData.blockedPeriods?.[`${day}_p${period}`];
    if (blocked && !isAdminLoggedIn) {
      showToast(`That period is blocked by the lab technician — ${blocked.reason}`, 'error');
      return;
    }

    setBookingSlot({ day, period, labId, slotIndex });
    setIsBookingModalOpen(true);
  };

  // The header's "Book Lab" button used to skip the lock check entirely,
  // which made the administrator's schedule lock trivially bypassable.
  const handleOpenGeneralBook = () => {
    if (!currentSectionData) return;
    const firstLab = currentSectionData.labs[0]?.id || 'lab-1';
    openBookingModal('sunday', 1, firstLab, 0);
  };

  const handleOpenQuickBook = (day: Day, period: number, labId: string, slotIndex: number) => {
    openBookingModal(day, period, labId, slotIndex);
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
    experimentDetails?: ExperimentDetails;
  }): Promise<boolean> => {
    if (!currentSection) return false;

    const newRes: Reservation = {
      id: '', // assigned by the service from the slot coordinates
      day: bookingData.day,
      period: bookingData.period,
      labId: bookingData.labId,
      slotIndex: bookingData.slotIndex,
      teacher: bookingData.teacher,
      className: bookingData.className,
      subject: bookingData.subject,
      createdAt: new Date().toISOString(),
      isOverride: bookingData.isOverride,
      experimentDetails: bookingData.experimentDetails
    };

    try {
      await addOrUpdateReservation(currentSection, newRes, Boolean(bookingData.isOverride));
      showToast(
        `Reservation confirmed for ${bookingData.teacher} (Slot ${bookingData.slotIndex + 1}).`,
        'success'
      );
      return true;
    } catch (err) {
      console.error('Add reservation error:', err);
      showToast(
        err instanceof SlotTakenError
          ? err.message
          : 'Failed to save the reservation. Check your connection and try again.',
        'error'
      );
      return false;
    }
  };

  /**
   * Records the lab supervisor's response to a booking.
   *
   * Fire-and-report rather than optimistic: the Firestore snapshot is the
   * source of truth for every other open browser, and a decline that only
   * appeared locally would be worse than none.
   */
  const handleSetSupervisorReview = async (
    reservationId: string,
    review: SupervisorReview | null
  ) => {
    try {
      await setSupervisorReview(reservationId, review);
      showToast(
        review === null
          ? 'Review cleared.'
          : review.status === 'declined'
            ? 'Marked as “cannot prepare”. The teacher will see your reason.'
            : 'Marked as reviewed.',
        review?.status === 'declined' ? 'info' : 'success'
      );
    } catch (err) {
      console.error('Supervisor review error:', err);
      showToast('Could not save the review.', 'error');
    }
  };

  const handleCancelReservation = (reservationId: string) => {
    if (!currentSection || !currentSectionData) return;

    const target = Object.values(currentSectionData.reservations)
      .flat()
      .find(r => r && r.id === reservationId);

    const doCancel = async () => {
      try {
        await removeReservation(reservationId);
        showToast(
          'Reservation cancelled.',
          'info',
          target
            ? {
                label: 'Undo',
                onClick: () => {
                  addOrUpdateReservation(currentSection, target, true).catch(() =>
                    showToast('Could not restore the reservation.', 'error')
                  );
                }
              }
            : undefined
        );
      } catch (err) {
        console.error('Cancel reservation error:', err);
        showToast('Failed to cancel the reservation.', 'error');
      }
    };

    setConfirmRequest({
      title: 'Cancel this reservation?',
      message: target
        ? `${target.teacher} — Class ${target.className}, ${target.day} Period ${target.period}. You can undo this straight after.`
        : 'This booking will be removed from the schedule.',
      confirmLabel: 'Cancel booking',
      onConfirm: () => {
        void doCancel();
      }
    });
  };

  // Admin
  const handleAdminLogin = (pass: string) => {
    if (pass === ADMIN_PASSWORD) {
      setIsAdminLoggedIn(true);
      showToast('Admin access granted.', 'success');
      return true;
    }
    return false;
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setIsAdminModalOpen(false);
    showToast('Admin session ended.', 'info');
  };

  const handleUpdateDeadline = async (day: number, time: string) => {
    try {
      await updateSectionSettings(adminSection, { deadlineDay: day, deadlineTime: time });
      showToast('Booking cutoff deadline updated.', 'success');
    } catch {
      showToast('Failed to update the deadline.', 'error');
    }
  };

  const handleToggleLockSchedule = async (isLocked: boolean) => {
    try {
      await updateSectionSettings(adminSection, { isLocked });
      showToast(`Schedule ${isLocked ? 'locked' : 'unlocked'}.`, 'info');
    } catch {
      showToast('Failed to update the lock state.', 'error');
    }
  };

  const handleOpenNewWeek = () => {
    setConfirmRequest({
      title: `Archive week ${adminSectionData.weekNumber}?`,
      message: `All ${adminBookingsCount} reservations for ${SCHOOL_LABEL[adminSection]} will be moved to the history log and the grid cleared for week ${adminSectionData.weekNumber + 1}. This cannot be undone.`,
      confirmLabel: 'Archive and start new week',
      onConfirm: () => {
        void (async () => {
          try {
            const archivedWeek = adminSectionData.weekNumber;
            await openNewWeekInFirestore(adminSection, adminSectionData);
            setIsAdminModalOpen(false);
            // Archiving clears the grid, so without a way straight back into
            // the archive the week the user just filed appears to have simply
            // vanished.
            showToast(`Week ${archivedWeek} archived. New week opened.`, 'success', {
              label: `View week ${archivedWeek}`,
              onClick: () => setIsHistoryModalOpen(true)
            });
          } catch (err) {
            console.error('Open new week error:', err);
            showToast('Failed to open the new week.', 'error');
          }
        })();
      }
    });
  };

  /**
   * Deletes every booking in the live week without archiving it.
   *
   * Separate from "archive and start next week" on purpose: that one keeps the
   * week and rolls the counter, this one throws it away. The confirmation spells
   * out that nothing is recoverable, because the two buttons sit in the same
   * panel and the wrong one is unrecoverable.
   */
  const handleClearSchedule = () => {
    setConfirmRequest({
      title: `Delete all ${adminBookingsCount} bookings?`,
      message:
        `Every booking in week ${adminSectionData.weekNumber} for ` +
        `${SCHOOL_LABEL[adminSection]} will be permanently deleted. They are NOT ` +
        `archived and cannot be recovered. Rosters, labs and period locks are ` +
        `kept. To keep a copy instead, cancel and use "Archive and start week ` +
        `${adminSectionData.weekNumber + 1}".`,
      confirmLabel: 'Delete everything',
      tone: 'danger',
      onConfirm: () => {
        void (async () => {
          try {
            const removed = await clearAllReservations(adminSection);
            setIsAdminModalOpen(false);
            showToast(
              `Cleared ${removed} booking${removed === 1 ? '' : 's'} from week ` +
                `${adminSectionData.weekNumber}.`,
              'success'
            );
          } catch (err) {
            console.error('Clear schedule error:', err);
            showToast('Failed to clear the schedule.', 'error');
          }
        })();
      }
    });
  };

  /**
   * Renames the current week without touching anything else.
   *
   * Needed because the week counter was previously write-only: it moved when
   * you archived and never otherwise. An accidental archive, a vacation week,
   * or a term that starts at week 5 all left the number wrong with no way to
   * correct it short of archiving repeatedly -- which files an empty week into
   * history each time.
   */
  const handleSetWeekNumber = async (week: number) => {
    if (!Number.isInteger(week) || week < 1) return;

    try {
      await updateSectionSettings(adminSection, { weekNumber: week });
      showToast(`Now showing week ${week}.`, 'success');
    } catch (err) {
      console.error('Set week number error:', err);
      showToast('Could not change the week number.', 'error');
    }
  };

  const handleSaveMaterial = async (
    material: Omit<Material, 'id' | 'updatedAt'> & { id?: string }
  ) => {
    try {
      await saveMaterial({ ...material, updatedAt: '' });
      showToast(material.id ? 'Material updated.' : 'Material added.', 'success');
    } catch (err) {
      console.error('Save material error:', err);
      showToast('Could not save that material.', 'error');
    }
  };

  const handleDeleteMaterial = (material: Material) => {
    setConfirmRequest({
      title: `Delete ${material.name}?`,
      message:
        'This removes the item from the stock list. Bookings and requisitions are not affected.',
      confirmLabel: 'Delete item',
      tone: 'danger',
      onConfirm: () => {
        void (async () => {
          try {
            await deleteMaterial(material.id);
            showToast('Material deleted.', 'success');
          } catch (err) {
            console.error('Delete material error:', err);
            showToast('Could not delete that material.', 'error');
          }
        })();
      }
    });
  };

  const handleImportMaterials = async (
    rows: Omit<Material, 'id' | 'section' | 'updatedAt'>[]
  ) => {
    if (!importSection) return { created: 0, updated: 0 };
    const result = await upsertMaterials(importSection, rows, materials);
    showToast(
      `Imported ${result.created} new and updated ${result.updated} item` +
        `${result.created + result.updated === 1 ? '' : 's'}.`,
      'success'
    );
    return result;
  };

  const handleAddTeacher = async (name: string) => {
    if (name.length > MAX_TEACHER_NAME_LENGTH) {
      showToast(
        `Teacher names are limited to ${MAX_TEACHER_NAME_LENGTH} characters.`,
        'error'
      );
      return;
    }
    if (adminSectionData.teachers.some(t => t.toLowerCase() === name.toLowerCase())) {
      showToast(`"${name}" is already on the teacher list.`, 'error');
      return;
    }
    try {
      await updateSectionSettings(adminSection, {
        teachers: [...adminSectionData.teachers, name]
      });
      showToast(`Teacher "${name}" added.`, 'success');
    } catch {
      showToast('Failed to add the teacher.', 'error');
    }
  };

  const handleRemoveTeacher = (idx: number) => {
    const name = adminSectionData.teachers[idx];
    if (!name) return;

    setConfirmRequest({
      title: `Remove ${name}?`,
      message:
        'They will no longer be selectable for new bookings. Existing reservations keep their name.',
      confirmLabel: 'Remove teacher',
      onConfirm: () => {
        void (async () => {
          try {
            const updated = adminSectionData.teachers.filter((_, i) => i !== idx);
            await updateSectionSettings(adminSection, { teachers: updated });
            showToast(`Removed ${name}.`, 'info');
          } catch {
            showToast('Failed to remove the teacher.', 'error');
          }
        })();
      }
    });
  };

  const handleAddClass = async (className: string) => {
    if (className.length > MAX_CLASS_NAME_LENGTH) {
      showToast(`Class names are limited to ${MAX_CLASS_NAME_LENGTH} characters.`, 'error');
      return;
    }
    if (adminSectionData.classes.some(c => c.toLowerCase() === className.toLowerCase())) {
      showToast(`Class "${className}" already exists.`, 'error');
      return;
    }
    try {
      await updateSectionSettings(adminSection, {
        classes: [...adminSectionData.classes, className]
      });
      showToast(`Class "${className}" added.`, 'success');
    } catch {
      showToast('Failed to add the class.', 'error');
    }
  };

  const handleRemoveClass = (idx: number) => {
    const name = adminSectionData.classes[idx];
    if (!name) return;

    setConfirmRequest({
      title: `Remove class ${name}?`,
      message: 'It will no longer be selectable for new bookings.',
      confirmLabel: 'Remove class',
      onConfirm: () => {
        void (async () => {
          try {
            const updated = adminSectionData.classes.filter((_, i) => i !== idx);
            await updateSectionSettings(adminSection, { classes: updated });
            showToast(`Removed class ${name}.`, 'info');
          } catch {
            showToast('Failed to remove the class.', 'error');
          }
        })();
      }
    });
  };

  const handleAddLab = async (name: string, code: string) => {
    if (name.length > MAX_LAB_NAME_LENGTH) {
      showToast(`Lab names are limited to ${MAX_LAB_NAME_LENGTH} characters.`, 'error');
      return;
    }
    if (adminSectionData.labs.some(l => l.name.toLowerCase() === name.toLowerCase())) {
      showToast(`A lab called "${name}" already exists.`, 'error');
      return;
    }
    try {
      const newLab = {
        id: `lab-${Date.now()}`,
        name,
        code,
        capacity: 30,
        color: 'indigo'
      };
      await updateSectionSettings(adminSection, {
        labs: [...adminSectionData.labs, newLab]
      });
      showToast(`Lab "${name}" added.`, 'success');
    } catch {
      showToast('Failed to add the lab.', 'error');
    }
  };

  const handleRemoveLab = (id: string) => {
    if (adminSectionData.labs.length <= 1) {
      showToast('You must keep at least one lab available.', 'error');
      return;
    }
    const lab = adminSectionData.labs.find(l => l.id === id);
    if (!lab) return;

    const affected = Object.values(adminSectionData.reservations)
      .flat()
      .filter(r => r && r.labId === id).length;

    setConfirmRequest({
      title: `Remove ${lab.name}?`,
      message: affected
        ? `${affected} existing reservation${affected === 1 ? '' : 's'} point at this room and will show an unknown lab. Remove it anyway?`
        : 'This room will no longer be selectable for bookings.',
      confirmLabel: 'Remove lab',
      onConfirm: () => {
        void (async () => {
          try {
            const updated = adminSectionData.labs.filter(l => l.id !== id);
            await updateSectionSettings(adminSection, { labs: updated });
            showToast(`Removed ${lab.name}.`, 'info');
          } catch {
            showToast('Failed to remove the lab.', 'error');
          }
        })();
      }
    });
  };

  const handleSaveLockPeriods = async (slots: LockSlot[], reason: string | null) => {
    if (!currentSection || !currentSectionData || slots.length === 0) return;

    /**
     * Deliberately open, not admin-gated.
     *
     * Blocking a period is the lab technician's job -- it is how they say "I am
     * covering a class / doing maintenance this period, do not book me". Making
     * it an administrator action meant the one person who actually knows when
     * the lab is unavailable had to go and find someone with the password, so
     * in practice the blocks never got recorded and teachers booked into
     * periods the lab could not service.
     *
     * This matches how the rest of the app already works: any teacher can
     * cancel any booking. There is no per-user identity here (see README), so a
     * gate on this one action bought nothing except friction.
     *
     * The section-wide booking lock in the admin panel is a different control
     * and stays admin-only.
     *
     * The whole selection is applied as one merged write. Blocking a day used
     * to be seven sequential round trips, each racing the snapshot that the
     * previous one triggered.
     */
    const nextBlocks = { ...(currentSectionData.blockedPeriods || {}) };
    const createdAt = new Date().toISOString();

    slots.forEach(({ day, period }) => {
      const key = `${day}_p${period}`;
      if (reason === null) {
        delete nextBlocks[key];
      } else {
        nextBlocks[key] = {
          day,
          period,
          reason,
          blockedBy: 'Lab Technician',
          createdAt
        };
      }
    });

    const n = slots.length;
    const label = n === 1 ? `${slots[0].day.toUpperCase()} period ${slots[0].period}` : `${n} periods`;

    try {
      await updateSectionSettings(currentSection, { blockedPeriods: nextBlocks });
      showToast(reason === null ? `Unblocked ${label}.` : `Blocked ${label}.`, 'success');
    } catch (err) {
      console.error('Save period blocks error:', err);
      showToast('Failed to update the period blocks.', 'error');
    }
  };

  /**
   * Clears one or more period blocks from the admin panel.
   *
   * Same write as unblocking from the lock modal -- `handleSaveLockPeriods`
   * with a null reason deletes the keys -- but reachable from the one screen
   * that lists them all. A block left over from a maintenance day otherwise
   * kept a period unbookable with nothing on screen saying why.
   */
  const handleUnblockPeriods = (slots: { day: Day; period: number }[]) => {
    if (slots.length === 0) return;

    const nextBlocks = { ...(adminSectionData.blockedPeriods || {}) };
    slots.forEach(({ day, period }) => {
      delete nextBlocks[`${day}_p${period}`];
    });

    void (async () => {
      try {
        await updateSectionSettings(adminSection, { blockedPeriods: nextBlocks });
        showToast(
          slots.length === 1
            ? `Unblocked ${slots[0].day} period ${slots[0].period}.`
            : `Unblocked ${slots.length} periods.`,
          'success'
        );
      } catch (err) {
        console.error('Unblock periods error:', err);
        showToast('Failed to clear the period blocks.', 'error');
      }
    })();
  };

  const openLockModal = (day?: Day, period?: number) => {
    setLockSlotTarget(day && period ? { day, period } : null);
    setIsLockModalOpen(true);
  };

  // --- RENDER ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-brand-kingdom-600 rounded-2xl mx-auto flex items-center justify-center text-white animate-pulse">
            <FlaskConical className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Science Lab Scheduler</h1>
            <p className="text-sm text-slate-500 mt-1">Loading this week's schedule…</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-coral-100 text-brand-coral-800 mx-auto flex items-center justify-center">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Can't reach the schedule</h1>
            <p className="text-sm text-slate-600 mt-1">
              The scheduler could not load live data, so nothing is shown rather than
              stale or demo bookings.
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-mono break-words">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!currentSection || !currentSectionData) {
    return (
      <>
        <NotificationToast toast={toast} onClose={() => setToast(null)} />
        <SectionSelector
          onSelectSection={handleSelectSection}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
          onOpenMaterials={() => setIsMaterialsOpen(true)}
        />
        <AdminModal
          isOpen={isAdminModalOpen}
          isAdminLoggedIn={isAdminLoggedIn}
          section={adminSection}
          sectionData={adminSectionData}
          onSelectSection={setAdminSection}
          onClose={() => setIsAdminModalOpen(false)}
          onLogin={handleAdminLogin}
          onLogout={handleAdminLogout}
          onUpdateDeadline={handleUpdateDeadline}
          onToggleLockSchedule={handleToggleLockSchedule}
          onOpenNewWeek={handleOpenNewWeek}
        onClearSchedule={handleClearSchedule}
        onSetWeekNumber={handleSetWeekNumber}
          onAddTeacher={handleAddTeacher}
          onRemoveTeacher={handleRemoveTeacher}
          onAddClass={handleAddClass}
          onRemoveClass={handleRemoveClass}
          onAddLab={handleAddLab}
          onRemoveLab={handleRemoveLab}
          onUnblockPeriods={handleUnblockPeriods}
          onOpenMaterials={() => setIsMaterialsOpen(true)}
        />
        {/* No school chosen yet, so this covers both and the importer -- which
            writes into one school -- is not offered. */}
        <MaterialsModal
          isOpen={isMaterialsOpen}
          section={null}
          labsBySection={{ boys: appState.boys.labs, girls: appState.girls.labs }}
          materials={materials}
          onClose={() => setIsMaterialsOpen(false)}
          onSave={handleSaveMaterial}
          onDelete={handleDeleteMaterial}
          onOpenImport={openImport}
          isAdminLoggedIn={isAdminLoggedIn}
          loadError={materialsError}
        />

        <MaterialImportDialog
          isOpen={isImportOpen}
          section={importSection}
          onSelectSection={setImportSection}
          labsBySection={{ boys: appState.boys.labs, girls: appState.girls.labs }}
          isAdminLoggedIn={isAdminLoggedIn}
          onLogin={handleAdminLogin}
          loadError={materialsError}
          onClose={() => setIsImportOpen(false)}
          onImport={handleImportMaterials}
        />

        <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
      </>
    );
  }

  const theme = themeFor(currentSection);

  return (
    <div
      className={`${theme.page} ${theme.texture} ${theme.selection} text-slate-900 min-h-screen flex flex-col font-sans transition-colors duration-300 print:bg-white`}
    >
      <NotificationToast toast={toast} onClose={() => setToast(null)} />

      <Header
        currentSection={currentSection}
        weekNumber={currentSectionData.weekNumber}
        conflictCount={activeConflicts.length}
        isAdminLoggedIn={isAdminLoggedIn}
        isScheduleLocked={Boolean(currentSectionData.isLocked)}
        onSelectSection={handleSelectSection}
        onReturnToSectionSelect={handleReturnToSectionSelect}
        onOpenQuickBook={handleOpenGeneralBook}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenMaterials={() => setIsMaterialsOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onOpenConflictResolver={() => setIsConflictModalOpen(true)}
        onOpenLockModal={() => openLockModal()}
      />

      {/* The schedule is a five-day matrix; a 7xl container left ~265px of the
          viewport unused while the table overflowed by ~198px and Thursday fell
          off the edge. The cap is now wide enough for the full week and still
          stops the layout stretching absurdly on an ultrawide display. */}
      <main className="max-w-[1700px] mx-auto px-4 py-6 flex-grow w-full">
        {/* Printed masthead. The app header is `print:hidden`, so a printed
            schedule used to come out of the printer carrying no school name, no
            school, no week number and no date -- a grid of names with nothing
            saying what it was. This block only exists on paper. */}
        <div className="hidden print:block mb-4 pb-3 border-b-2 border-black">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-base font-black text-black leading-tight">{SCHOOL_NAME}</p>
              <p className="text-sm font-bold text-black leading-tight" lang="ar" dir="rtl">
                {SCHOOL_NAME_AR}
              </p>
              <p className="text-xs text-black mt-1">{DEPARTMENT_NAME}</p>
            </div>
            <div className="text-right text-xs text-black shrink-0">
              <p className="text-sm font-bold uppercase tracking-wide">
                {/* A filtered printout has to say so on the page. Handing a
                    teacher a sheet headed "Weekly lab schedule" that silently
                    contains only their own sessions invites it being read as
                    the whole week's. */}
                {selectedTeacherFilter === 'ALL'
                  ? 'Weekly lab schedule'
                  : 'Personal lab schedule'}
              </p>
              {selectedTeacherFilter !== 'ALL' && (
                <p className="text-sm font-bold mt-0.5">{selectedTeacherFilter}</p>
              )}
              <p className="mt-0.5">
                {SCHOOL_LABEL[currentSection]} · Week {currentSectionData.weekNumber}
              </p>
              {selectedLabFilter !== 'ALL' && (
                <p className="mt-0.5">
                  {currentSectionData.labs.find(l => l.id === selectedLabFilter)?.name ||
                    selectedLabFilter}{' '}
                  only
                </p>
              )}
              <p className="mt-0.5">
                Printed {new Date().toLocaleDateString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        <StatsBar
          totalBookings={totalBookingsCount}
          totalLabs={currentSectionData.labs.length}
          conflictCount={activeConflicts.length}
          labsList={currentSectionData.labs}
          searchQuery={searchQuery}
          selectedLabFilter={selectedLabFilter}
          selectedTeacherFilter={selectedTeacherFilter}
          teachersList={currentSectionData.teachers}
          onTeacherFilterChange={setSelectedTeacherFilter}
          onSearchChange={setSearchQuery}
          onLabFilterChange={setSelectedLabFilter}
          onResetFilters={() => {
            setSearchQuery('');
            setSelectedLabFilter('ALL');
            setSelectedTeacherFilter('ALL');
          }}
          onOpenConflicts={() => setIsConflictModalOpen(true)}
        />

        <ScheduleGrid
          section={currentSection}
          labs={currentSectionData.labs}
          reservations={currentSectionData.reservations}
          conflicts={activeConflicts}
          searchQuery={searchQuery}
          selectedLabFilter={selectedLabFilter}
          selectedTeacherFilter={selectedTeacherFilter}
          teacherRoster={currentSectionData.teachers}
          blockedPeriods={currentSectionData.blockedPeriods || {}}
          isAdminLoggedIn={isAdminLoggedIn}
          isScheduleLocked={Boolean(currentSectionData.isLocked)}
          onQuickBook={handleOpenQuickBook}
          onCancelReservation={handleCancelReservation}
          onSetSupervisorReview={handleSetSupervisorReview}
          onOpenLockModal={openLockModal}
        />
      </main>

      <footer className="py-4 bg-white border-t border-slate-200 text-slate-500 text-xs px-6 flex items-center justify-between print:hidden">
        <span>Science Lab Scheduler</span>
        <span>Week {currentSectionData.weekNumber} · {SCHOOL_LABEL[currentSection]}</span>
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
        section={adminSection}
        sectionData={adminSectionData}
        onSelectSection={setAdminSection}
        onClose={() => setIsAdminModalOpen(false)}
        onLogin={handleAdminLogin}
        onLogout={handleAdminLogout}
        onUpdateDeadline={handleUpdateDeadline}
        onToggleLockSchedule={handleToggleLockSchedule}
        onOpenNewWeek={handleOpenNewWeek}
        onClearSchedule={handleClearSchedule}
        onSetWeekNumber={handleSetWeekNumber}
        onAddTeacher={handleAddTeacher}
        onRemoveTeacher={handleRemoveTeacher}
        onAddClass={handleAddClass}
        onRemoveClass={handleRemoveClass}
        onAddLab={handleAddLab}
        onRemoveLab={handleRemoveLab}
        onUnblockPeriods={handleUnblockPeriods}
        onOpenMaterials={() => setIsMaterialsOpen(true)}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        section={currentSection}
        sectionData={currentSectionData}
        labs={currentSectionData.labs}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      <LockPeriodModal
        isOpen={isLockModalOpen}
        sectionData={currentSectionData}
        initialDay={lockSlotTarget?.day || 'sunday'}
        initialPeriod={lockSlotTarget?.period || 1}
        onClose={() => setIsLockModalOpen(false)}
        onSaveLocks={handleSaveLockPeriods}
      />

      <MaterialsModal
        isOpen={isMaterialsOpen}
        section={currentSection}
        labsBySection={{ boys: appState.boys.labs, girls: appState.girls.labs }}
        materials={materials}
        onClose={() => setIsMaterialsOpen(false)}
        onSave={handleSaveMaterial}
        onDelete={handleDeleteMaterial}
        onOpenImport={openImport}
        isAdminLoggedIn={isAdminLoggedIn}
        loadError={materialsError}
      />

      <MaterialImportDialog
        isOpen={isImportOpen}
        section={importSection}
        onSelectSection={setImportSection}
        labsBySection={{ boys: appState.boys.labs, girls: appState.girls.labs }}
        isAdminLoggedIn={isAdminLoggedIn}
        onLogin={handleAdminLogin}
        loadError={materialsError}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportMaterials}
      />

      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </div>
  );
}
