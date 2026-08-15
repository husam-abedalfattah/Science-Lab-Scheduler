/**
 * Offline integrity check for the seeded schedule.
 *
 * Run with `npm run verify:data`. It needs no network and no Firebase project.
 *
 * This exists because the seed data once shipped three room double-bookings
 * (two classes in one lab in the same period), so a fresh install opened with
 * conflict alerts already showing, and because the reservation map keys in the
 * seed file had drifted out of sync with the keys the live subscription builds.
 * Both are silent failures that a type-check cannot catch.
 */
import { INITIAL_APP_STATE } from '../src/data/initialData';
import { detectAllConflicts, validateNewBooking } from '../src/utils/conflictDetector';
import { reservationKey } from '../src/utils/scheduleKeys';
import type { Reservation, Section } from '../src/types';

/** Mirrors reservationSlotId in src/services/firebaseService.ts. Inlined so
 *  this script does not pull the Firebase SDK into a node process. */
const reservationSlotId = (section: Section, day: string, period: number, slotIndex: number) =>
  `${section}__${day}_p${period}_slot${slotIndex}`;

const VALID_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  FAIL: ${msg}`);
};

for (const section of ['boys', 'girls'] as Section[]) {
  const data = INITIAL_APP_STATE[section];
  console.log(`\n=== ${section.toUpperCase()} (${data.name}) ===`);

  const all: Reservation[] = [];
  Object.entries(data.reservations).forEach(([key, list]) => {
    if (!Array.isArray(list)) return;
    list.forEach((r) => {
      all.push(r);
      const expected = reservationKey(r.day, r.period, r.labId);
      if (key !== expected) fail(`map key "${key}" does not match body-derived "${expected}"`);
    });
  });
  console.log(`reservations: ${all.length}`);

  // The Firestore document id is (section, day, period, slotIndex) and ignores
  // labId, so two rows sharing those coordinates would overwrite each other.
  const byDocId = new Map<string, Reservation[]>();
  all.forEach((r) => {
    const id = reservationSlotId(section, r.day, r.period, r.slotIndex);
    byDocId.set(id, [...(byDocId.get(id) || []), r]);
  });
  byDocId.forEach((list, id) => {
    if (list.length > 1) {
      fail(
        `slot id collision "${id}" -> ${list.length} rows: ` +
          list.map((r) => `${r.teacher}/${r.labId}`).join(', ')
      );
    }
  });
  console.log(`unique slot ids: ${byDocId.size}`);

  // Field constraints mirrored from firestore.rules.
  all.forEach((r) => {
    if (!VALID_DAYS.includes(r.day)) fail(`invalid day "${r.day}"`);
    if (!Number.isInteger(r.period) || r.period < 1 || r.period > 7) {
      fail(`period ${r.period} out of range 1-7 (${r.teacher})`);
    }
    if (!Number.isInteger(r.slotIndex) || r.slotIndex < 0 || r.slotIndex > 2) {
      fail(`slotIndex ${r.slotIndex} out of range 0-2 (${r.teacher})`);
    }
    if (!r.labId || r.labId.length > 100) fail(`invalid labId "${r.labId}"`);
    if (!r.teacher || r.teacher.length > 200) fail(`invalid teacher "${r.teacher}"`);
    if (!r.className || r.className.length > 50) fail(`invalid className "${r.className}"`);
    if (!data.labs.some((l) => l.id === r.labId)) {
      fail(`labId "${r.labId}" is not one of this section's labs (${r.teacher})`);
    }
    if (!data.teachers.includes(r.teacher)) fail(`teacher "${r.teacher}" is not on the roster`);
    if (!data.classes.includes(r.className)) fail(`class "${r.className}" is not on the roster`);
  });

  const other = INITIAL_APP_STATE[section === 'boys' ? 'girls' : 'boys'];

  const conflicts = detectAllConflicts(data, other);
  const errors = conflicts.filter((c) => c.severity === 'error');
  const warnings = conflicts.filter((c) => c.severity === 'warning');
  console.log(`conflicts: ${errors.length} error, ${warnings.length} warning`);
  errors.forEach((c) => fail(`[${c.type}] ${c.message}`));
  warnings.forEach((c) => console.log(`  warning: [${c.type}] ${c.message}`));

  // Re-validating a booking in place must not report it as conflicting with
  // itself; if it does, editing an existing row is impossible in the UI.
  all.forEach((r) => {
    const result = validateNewBooking(
      r.day, r.period, r.labId, r.slotIndex, r.teacher, r.className, data, other
    );
    if (!result.isValid) {
      fail(
        `existing booking fails self-revalidation ` +
          `(${r.teacher} ${r.day} p${r.period} slot${r.slotIndex}): ${result.errors.join(' | ')}`
      );
    }
  });
}

if (failures > 0) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log('\nAll seed data checks passed.');
