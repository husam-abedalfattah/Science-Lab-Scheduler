/**
 * Central scheduling + capacity rules.
 *
 * These numbers used to be duplicated (and disagree with each other) across
 * ScheduleGrid, conflictDetector and StatsBar. Change them here only.
 */

/** Labs the technician can service concurrently within a single period. */
export const MAX_CONCURRENT_LABS_PER_PERIOD = 3;

/** Periods the technician can be scheduled for within a single day. */
export const MAX_ACTIVE_PERIODS_PER_DAY = 5;

/** Booking slots rendered per (day, period) cell. */
export const SLOTS_PER_PERIOD = MAX_CONCURRENT_LABS_PER_PERIOD;

export const DAYS_PER_WEEK = 5;
export const PERIODS_PER_DAY = 7;

/**
 * Theoretical weekly ceiling: the technician limit binds before the lab count
 * does, so capacity is days x periods x concurrent-lab limit -- NOT
 * days x periods x labs x slots, which overstated capacity ~3x.
 */
export const WEEKLY_SLOT_CAPACITY =
  DAYS_PER_WEEK * PERIODS_PER_DAY * MAX_CONCURRENT_LABS_PER_PERIOD;

/**
 * Attachments are stored inline on the reservation document as a data URI.
 * Firestore caps a document at 1 MiB and base64 inflates payloads by ~33%,
 * so the raw file has to stay well under that or the write is rejected.
 *
 * This must stay below what firestore.rules allows for
 * `experimentDetails.fileUrl` (800,000 characters). Base64 encodes 3 raw bytes
 * as 4 characters, so the rule's ceiling is 600,000 raw bytes; the previous
 * 600 KiB (614,400 bytes) limit encoded to 819,200 characters and any file
 * over ~586 KB passed the browser check only to be rejected by the rule.
 * 560 KiB encodes to ~764,600 characters, leaving room for the
 * `data:<mime>;base64,` prefix and the rest of the document.
 *
 * TODO: move attachments to Firebase Storage and keep only a download URL
 * here; that removes the cap and stops every client re-downloading every
 * attachment on every snapshot.
 */
export const MAX_ATTACHMENT_BYTES = 560 * 1024;

export const ACCEPTED_ATTACHMENT_TYPES = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
export const ACCEPTED_ATTACHMENT_LABEL = 'PDF, Word, PNG, JPG';

/** Weeks retained in the section history archive before the oldest is dropped. */
export const MAX_ARCHIVED_WEEKS = 12;

/**
 * Reasons the lab supervisor can give for declining a booking.
 *
 * Offered as one-tap choices because the supervisor is reviewing a week of
 * requisitions at a time and a free-text box, at that volume, gets left empty
 * -- which is how a teacher ends up with a refusal and no explanation. They can
 * still type their own; this is a starting point, not a closed list.
 *
 * Keep them phrased as the reason the lab cannot take the session, not as
 * instructions to the teacher.
 */
export const SUPERVISOR_DECLINE_REASONS = [
  'Busy preparing another lab this period',
  'Materials or chemicals not available',
  'Equipment is under maintenance',
  'Not enough preparation time before this period',
  'Safety check needed before this experiment can run',
  'Lab reserved for exams or an external booking',
  'Experiment details are incomplete'
] as const;

/** Free-text cap for the decline reason; mirrors what firestore.rules allows. */
export const MAX_REVIEW_REASON_LENGTH = 300;

/* --- Lab materials inventory ------------------------------------------- */

export const MATERIAL_CATEGORIES = [
  { id: 'chemical', label: 'Chemical' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'glassware', label: 'Glassware' },
  { id: 'consumable', label: 'Consumable' }
] as const;

/** Offered in the unit dropdown; the field accepts anything. */
export const MATERIAL_UNITS = [
  'piece',
  'box',
  'pack',
  'bottle',
  'jar',
  'litre',
  'ml',
  'kg',
  'g',
  'set'
] as const;

/**
 * Hazard classes offered for chemicals. Deliberately the GHS pictogram names
 * rather than free text, so "corrosive" and "Corrosive!!" do not end up as two
 * different things nobody can filter on.
 */
export const MATERIAL_HAZARDS = [
  'Flammable',
  'Corrosive',
  'Toxic',
  'Harmful / irritant',
  'Oxidising',
  'Compressed gas',
  'Health hazard',
  'Environmental hazard'
] as const;

/** Field length caps. These mirror what firestore.rules enforces. */
export const MAX_MATERIAL_NAME_LENGTH = 200;
export const MAX_MATERIAL_LOCATION_LENGTH = 200;
export const MAX_MATERIAL_CODE_LENGTH = 60;
export const MAX_MATERIAL_TEXT_LENGTH = 500;

/**
 * Ceiling on a single spreadsheet import.
 *
 * Each row is one Firestore document, batched 400 at a time. This is a guard
 * against someone importing a 50,000-row export by accident and paying for it
 * in writes, not a limit anyone should hit: a school lab runs to hundreds of
 * items, not thousands.
 */
export const MAX_MATERIAL_IMPORT_ROWS = 5000;

/**
 * Roster name caps. These mirror the per-field limits firestore.rules enforces
 * on a reservation. Validating them when the name is added to the roster keeps
 * the failure where the administrator can see it -- otherwise an over-long
 * name saves fine and only breaks later, when a teacher tries to book with it
 * and the reservation write is rejected.
 */
export const MAX_TEACHER_NAME_LENGTH = 200;
export const MAX_CLASS_NAME_LENGTH = 50;
export const MAX_LAB_NAME_LENGTH = 100;

/**
 * Gate for the admin panel.
 *
 * This is a convenience gate for the UI only -- anything shipped to the browser
 * is readable by the user. Real enforcement has to live in firestore.rules
 * (see that file), not here.
 */
// Vite statically replaces `import.meta.env` at build time, but this module is
// also imported by the offline data check in scripts/, which runs under plain
// node where it is undefined. The fallback keeps that import side-effect free.
const viteEnv: Record<string, string | boolean | undefined> = import.meta.env ?? {};

export const ADMIN_PASSWORD: string =
  (viteEnv.VITE_ADMIN_PASSWORD as string | undefined) || 'admin123';

if (!viteEnv.VITE_ADMIN_PASSWORD && viteEnv.DEV) {
  console.warn(
    '[config] VITE_ADMIN_PASSWORD is not set; falling back to the default admin password. ' +
      'Set it in .env.local before deploying.'
  );
}
