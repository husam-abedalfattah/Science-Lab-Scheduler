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

/* --- Who is acting, and what they did ---------------------------------- */

/**
 * An administrator identified by the password they typed.
 *
 * The app has no per-user sign-in -- Firebase auth is anonymous, and a school
 * lab is a shared machine, so a per-person account is not something anyone
 * would keep signed in. What it does have is a small set of known passwords,
 * one per person who is trusted with the stockroom: the boys' school lab
 * technician, the girls' school lab technician, and the administrator.
 *
 * That makes the password the identity. It is a weak one -- a shared secret can
 * be passed on, and anyone can read the list out of the bundle -- so it is
 * treated as an accountability record ("Mr Khalid's password made this
 * change"), never as a security boundary. The boundary, such as it is, lives in
 * firestore.rules.
 *
 * `section` records which school the holder belongs to. It is stamped on the
 * audit trail so a change can be read back in context; it does not restrict
 * what they may edit.
 */
export interface AdminAccount {
  /** Stable key written to the audit trail. Never the password. */
  id: string;
  /** Display name, shown in the header and on every audit row. */
  name: string;
  /** The school this person belongs to, if they belong to one. */
  section?: Section;
}

/**
 * What an audit entry records having happened.
 *
 * `import` is one entry for a whole spreadsheet rather than one per row: an
 * import of 400 lines would otherwise bury every hand edit in the log, and the
 * question people actually ask of it is "who reloaded the stock list", not
 * "which of these 400 rows".
 */
export type AuditAction =
  | 'material_created'
  | 'material_updated'
  | 'material_deleted'
  | 'material_imported'
  | 'material_exported'
  | 'reservation_cancelled'
  | 'admin_created'
  | 'admin_updated'
  | 'admin_deleted';

/** One field that changed, rendered as "quantity: 12 → 8". */
export interface AuditChange {
  field: string;
  from: string;
  to: string;
}

/**
 * One line of the modification history.
 *
 * Append-only by design: firestore.rules allows create and denies update and
 * delete, so a log entry cannot be edited away by the person it names. Written
 * after the change it describes succeeds, and never allowed to fail the change
 * itself -- a stockroom edit that worked must not report failure because the
 * bookkeeping write did.
 */
export interface AuditEntry {
  id: string;
  /** ISO timestamp, client clock. Display metadata, not a security claim. */
  at: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  /** The school the change landed in. */
  section?: Section;
  /** Firestore id of the thing changed, when there is a single one. */
  targetId?: string;
  /** Human label for it: the material name, or the teacher and class. */
  targetName: string;
  /** Field-level diff, for edits. */
  changes?: AuditChange[];
  /** One-line detail for actions a diff does not describe, e.g. an import. */
  detail?: string;
}

/**
 * An administrator account as stored in Firestore.
 *
 * Created and managed from the Administrators tab of the admin panel, so the
 * school can add a person without a rebuild. The two accounts that come from
 * `.env.local` are NOT stored here -- they are compiled in, always available,
 * and exist so the very first administrator has a way to sign in and create
 * the rest.
 *
 * **The password is never stored.** `passwordHash` is PBKDF2-SHA256 over
 * `passwordSalt`; see src/utils/adminAuth.ts for why a hash and not the thing
 * itself, and for the honest limits of what that buys.
 */
export interface StoredAdminAccount {
  id: string;
  /** Display name, shown in the panel and on every audit row. */
  name: string;
  /** The school this person belongs to, if they belong to one. */
  section?: Section;

  passwordHash: string;
  passwordSalt: string;
  /** Algorithm and cost the hash was produced with, for future migration. */
  passwordScheme: string;

  createdAt: string;
  /** Name of the administrator who created it. */
  createdBy: string;
  updatedAt: string;
  /** When the password was last changed, so a stale one is visible. */
  passwordChangedAt: string;
}
