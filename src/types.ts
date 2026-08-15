export type Day = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday';

export type Section = 'boys' | 'girls';

export interface ExperimentDetails {
  experimentName: string;
  materialsNeeded: string;
  numberOfGroups: number;
  needsTechSupport: boolean;
  safetyItems: string[];
  techNotes?: string;
  fileUrl?: string;
  fileName?: string;
  needsPrintedWorksheets?: boolean;
  worksheetCopies?: number;
}

/**
 * The lab supervisor's response to a booking.
 *
 * A booking used to be a one-way message: the teacher filed a requisition and
 * found out on the day whether the lab could actually service it. This records
 * the supervisor having looked, and -- when they cannot take it -- why, so the
 * teacher can re-plan instead of arriving to an unprepared room.
 *
 * `reason` is required for `declined` and ignored for `acknowledged`; see
 * SUPERVISOR_DECLINE_REASONS in constants.ts for the offered set.
 */
export type SupervisorReviewStatus = 'acknowledged' | 'declined';

export interface SupervisorReview {
  status: SupervisorReviewStatus;
  reason?: string;
  reviewedAt: string; // ISO
}

export interface Reservation {
  id: string;
  day: Day;
  period: number; // 1 - 7
  labId: string;
  slotIndex: number;
  teacher: string;
  className: string;
  subject?: string;
  createdAt: string;
  isOverride?: boolean;
  experimentDetails?: ExperimentDetails;
  supervisorReview?: SupervisorReview;
}

/**
 * What kind of thing this is. Drives filtering and the hazard prompt.
 */
export type MaterialCategory = 'chemical' | 'equipment' | 'glassware' | 'consumable';

/**
 * One item held in a laboratory.
 *
 * Scoped per school like everything else: the two schools keep separate
 * stockrooms and separate rosters, and a shared catalogue would make "where is
 * it" ambiguous, which is the one question this table exists to answer.
 *
 * `labId` points at a Lab in the same school. Import resolves it from the
 * spreadsheet's lab *name* or code; a row whose lab cannot be resolved is
 * reported rather than silently filed somewhere wrong.
 */
export interface Material {
  id: string;
  section: Section;

  /** Required. */
  name: string;
  labId: string;
  location: string;

  /** Optional. `code` is the import's match key when present. */
  code?: string;
  category?: MaterialCategory;
  quantity?: number;
  unit?: string;
  /** Low-stock threshold: flagged when `quantity` is at or below this. */
  minQuantity?: number;
  hazard?: string;
  /** ISO `YYYY-MM-DD`. */
  expiryDate?: string;
  supplier?: string;
  notes?: string;

  updatedAt: string;
}

export interface Lab {
  id: string;
  name: string;
  code: string;
  capacity: number; // default capacity descriptor
  color: string;
}

export interface ConflictAlert {
  type: 'teacher_double_booked' | 'class_double_booked' | 'lab_overbooked';
  severity: 'error' | 'warning';
  message: string;
  reservationId1?: string;
  reservationId2?: string;
  day: Day;
  period: number;
  entityName: string;
}

export interface BlockedPeriod {
  day: Day;
  period: number;
  reason: string; // e.g. "Covering class 10B", "Busy with exam prep", "Lab maintenance"
  blockedBy?: string; // e.g. "Lab Technician"
  createdAt?: string;
}

export interface SectionData {
  name: string;
  themeColor: string;
  weekNumber: number;
  deadlineDay: number; // 0 = Sun, 1 = Mon ...
  deadlineTime: string; // "06:00"
  isLocked?: boolean; // Default false (unlocked)
  teachers: string[];
  classes: string[];
  labs: Lab[];
  reservations: Record<string, Reservation[]>; // Key: `${day}_p${period}_lab${labId}` -> Array of max 2 reservations
  blockedPeriods?: Record<string, BlockedPeriod>; // Key: `${day}_p${period}`
  history: {
    week: number;
    dateArchived: string;
    reservations: Record<string, Reservation[]>;
  }[];
}

export interface AppState {
  boys: SectionData;
  girls: SectionData;
}
