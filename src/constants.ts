/**
 * Central scheduling + capacity rules.
 *
 * These numbers used to be duplicated (and disagree with each other) across
 * ScheduleGrid, conflictDetector and StatsBar. Change them here only.
 */
import { AdminAccount, Section } from './types';
import { SCHOOL_LABEL } from './brand';

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
 * Who may administer, and the password that says so.
 *
 * There is no per-user sign-in: Firebase auth is anonymous and the lab machine
 * is shared. What the school does have is a handful of people trusted with the
 * stockroom and the schedule -- the boys' school lab technician, the girls'
 * school lab technician, and whoever runs the timetable -- so each gets their
 * own password, and the password that unlocked the session is what the audit
 * trail records as the actor.
 *
 * This is a convenience gate for the UI and an accountability record, NOT a
 * security boundary. Anything shipped to the browser is readable by the user,
 * and a shared secret can be passed on. Real enforcement has to live in
 * firestore.rules (see that file), not here.
 *
 * All accounts carry the same rights today. `section` is stamped on the audit
 * trail so a change reads back in context; it does not restrict what the
 * holder may edit. To make the technicians school-scoped, filter on it in
 * App.tsx's `requireAdmin` -- nothing else depends on it staying open.
 */
// Vite statically replaces `import.meta.env` at build time, but this module is
// also imported by the offline data check in scripts/, which runs under plain
// node where it is undefined. The fallback keeps that import side-effect free.
const viteEnv: Record<string, string | boolean | undefined> = import.meta.env ?? {};

const envStr = (key: string): string =>
  ((viteEnv[key] as string | undefined) || '').trim();

/**
 * The general administrator password.
 *
 * Kept as a named export because it is the one that existed first and the one
 * the deployment docs name. Falls back to the historical default so a fresh
 * checkout runs; the dev-console warning below is the nag to set it.
 */
export const ADMIN_PASSWORD: string = envStr('VITE_ADMIN_PASSWORD') || 'admin123';

export interface AdminAccountConfig extends AdminAccount {
  password: string;
}

/**
 * Accounts compiled in from `.env.local`.
 *
 * These are the floor, not the whole list: administrators are normally created
 * from the Administrators tab of the admin panel and stored in Firestore. What
 * these exist for is the case that has no other answer -- a brand-new
 * installation with no accounts yet, or a school that has forgotten the only
 * password it created. They are always available for that reason, and cannot
 * be removed from inside the app.
 *
 * Built in order, and matched in order. An account whose password is unset is
 * left out entirely rather than defaulting to something guessable -- a school
 * that never issues a girls'-side technician password should not find that
 * an empty string, or a shared fallback, unlocks it.
 */
export const BUILT_IN_ADMIN_ACCOUNTS: AdminAccountConfig[] = [
  {
    id: 'technician-boys',
    name: envStr('VITE_ADMIN_NAME_BOYS') || `${SCHOOL_LABEL.boys} lab technician`,
    section: 'boys' as Section,
    password: envStr('VITE_ADMIN_PASSWORD_BOYS')
  },
  {
    id: 'technician-girls',
    name: envStr('VITE_ADMIN_NAME_GIRLS') || `${SCHOOL_LABEL.girls} lab technician`,
    section: 'girls' as Section,
    password: envStr('VITE_ADMIN_PASSWORD_GIRLS')
  },
  {
    id: 'administrator',
    name: envStr('VITE_ADMIN_NAME') || 'Administrator',
    password: ADMIN_PASSWORD
  }
].filter(a => a.password.length > 0);

/**
 * The account a typed password identifies, or `null`.
 *
 * The technicians are matched before the general administrator so that a
 * school which has (unwisely) set two of them to the same string still
 * attributes the change to the more specific person rather than to a generic
 * "Administrator" -- the log is more useful naming someone.
 *
 * Deliberately not constant-time. The comparison is against a secret already
 * present in the bundle the attacker downloaded, so there is nothing here a
 * timing side channel could reveal that reading the source would not.
 */
export function findBuiltInAdminAccount(password: string): AdminAccount | null {
  const match = BUILT_IN_ADMIN_ACCOUNTS.find(a => a.password === password);
  if (!match) return null;
  const { password: _secret, ...account } = match;
  return account;
}

if (viteEnv.DEV) {
  if (!envStr('VITE_ADMIN_PASSWORD')) {
    console.warn(
      '[config] VITE_ADMIN_PASSWORD is not set; falling back to the default admin password. ' +
        'Set it in .env.local before deploying.'
    );
  }
  const seen = new Set<string>();
  BUILT_IN_ADMIN_ACCOUNTS.forEach(a => {
    if (seen.has(a.password)) {
      console.warn(
        `[config] Two admin accounts share a password; "${a.name}" will never be ` +
          'named in the modification history. Give each person their own.'
      );
    }
    seen.add(a.password);
  });
}

/**
 * How many modification-history entries the app holds in memory and shows.
 *
 * The collection itself is append-only and unbounded -- an audit trail that
 * quietly drops its oldest evidence is not one. This only bounds what a client
 * downloads on each load; older entries stay in Firestore and are readable
 * from the console.
 */
export const MAX_AUDIT_ENTRIES = 500;
