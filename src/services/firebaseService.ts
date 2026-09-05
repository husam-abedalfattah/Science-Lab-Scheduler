import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  runTransaction,
  deleteField,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, authReady } from '../firebase';
import {
  AppState,
  Section,
  Reservation,
  SectionData,
  SupervisorReview,
  Material,
  AuditEntry,
  StoredAdminAccount
} from '../types';
import { INITIAL_APP_STATE } from '../data/initialData';
import { MAX_ARCHIVED_WEEKS, MAX_AUDIT_ENTRIES } from '../constants';
import { planMaterialImport } from '../utils/materialImport';
import { SCHOOL_LABEL } from '../brand';
import { reservationKey } from '../utils/scheduleKeys';

const SECTIONS_COLLECTION = 'sections';
const RESERVATIONS_COLLECTION = 'reservations';
const MATERIALS_COLLECTION = 'materials';
const AUDITS_COLLECTION = 'audits';
const ADMIN_ACCOUNTS_COLLECTION = 'adminAccounts';

/**
 * Deterministic document id for a booking slot.
 *
 * Ids used to be `res-${Date.now()}-${random}`, so two teachers submitting the
 * same slot at the same moment both wrote successfully. Keying the document by
 * the slot itself makes a collision impossible at the storage layer.
 */
export function reservationSlotId(
  section: Section,
  day: string,
  period: number,
  slotIndex: number
): string {
  return `${section}__${day}_p${period}_slot${slotIndex}`;
}

export class SlotTakenError extends Error {
  constructor(public readonly takenBy: string) {
    super(`This slot was just booked by ${takenBy}. Please pick another slot.`);
    this.name = 'SlotTakenError';
  }
}

/** Strips inline attachment payloads. Archives keep the file name, not the bytes. */
function stripAttachments(
  reservations: Record<string, Reservation[]>
): Record<string, Reservation[]> {
  const out: Record<string, Reservation[]> = {};
  Object.entries(reservations || {}).forEach(([key, list]) => {
    if (!Array.isArray(list)) return;
    out[key] = list.map(res =>
      res.experimentDetails?.fileUrl
        ? { ...res, experimentDetails: { ...res.experimentDetails, fileUrl: '' } }
        : res
    );
  });
  return out;
}

// Helper to seed initial data if database is empty
export async function seedInitialDataIfNeeded() {
  try {
    await authReady;
    const sectionsSnap = await getDocs(collection(db, SECTIONS_COLLECTION));
    if (sectionsSnap.empty) {
      console.log('Firestore empty. Seeding initial sections and reservations...');

      const { reservations: boysRes, ...boysSettings } = INITIAL_APP_STATE.boys;
      await setDoc(doc(db, SECTIONS_COLLECTION, 'boys'), {
        sectionId: 'boys',
        ...boysSettings
      });

      const { reservations: girlsRes, ...girlsSettings } = INITIAL_APP_STATE.girls;
      await setDoc(doc(db, SECTIONS_COLLECTION, 'girls'), {
        sectionId: 'girls',
        ...girlsSettings
      });

      const batch = writeBatch(db);

      const seedSection = (
        section: Section,
        grouped: Record<string, Reservation[]>
      ) => {
        Object.values(grouped).forEach((list) => {
          list.forEach((res) => {
            const id = reservationSlotId(section, res.day, res.period, res.slotIndex);
            batch.set(doc(db, RESERVATIONS_COLLECTION, id), { ...res, id, section });
          });
        });
      };

      seedSection('boys', boysRes);
      seedSection('girls', girlsRes);

      await batch.commit();
      console.log('Initial seed complete.');
    }
  } catch (err) {
    console.error('Error checking/seeding initial data:', err);
    throw err;
  }
}

export interface SubscriptionHandlers {
  onStateChange: (state: AppState) => void;
  onReady?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Subscribe to real-time updates for both sections and reservations.
 *
 * `onReady` fires once both collections have reported at least once, so the UI
 * can stop showing demo placeholder data.
 */
export function subscribeToAppState(handlers: SubscriptionHandlers) {
  const { onStateChange, onReady, onError } = handlers;

  let latestSections: { boys?: Partial<SectionData>; girls?: Partial<SectionData> } = {};
  let latestReservations: Record<Section, Record<string, Reservation[]>> = {
    boys: {},
    girls: {}
  };

  let sectionsLoaded = false;
  let reservationsLoaded = false;
  let readyAnnounced = false;

  /**
   * Neutral defaults for a section document that is missing fields. The merge
   * base used to be INITIAL_APP_STATE, so a partially written document
   * silently repopulated the UI with the demo teachers and classes.
   */
  const emptySection = (section: Section): SectionData => ({
    name: SCHOOL_LABEL[section],
    themeColor: section === 'boys' ? 'brand-green' : 'brand-violet',
    weekNumber: 1,
    deadlineDay: 0,
    deadlineTime: '06:00',
    isLocked: false,
    teachers: [],
    classes: [],
    labs: [],
    reservations: {},
    blockedPeriods: {},
    history: []
  });

  const notify = () => {
    onStateChange({
      boys: {
        ...emptySection('boys'),
        ...latestSections.boys,
        reservations: latestReservations.boys || {}
      },
      girls: {
        ...emptySection('girls'),
        ...latestSections.girls,
        reservations: latestReservations.girls || {}
      }
    });

    if (!readyAnnounced && sectionsLoaded && reservationsLoaded) {
      readyAnnounced = true;
      onReady?.();
    }
  };

  let unsubscribeSections: (() => void) | null = null;
  let unsubscribeReservations: (() => void) | null = null;
  let cancelled = false;

  // Listeners must not attach before sign-in resolves. firestore.rules requires
  // `request.auth != null`, and a listener that is refused once fails
  // terminally -- Firestore does not silently retry it after auth lands. On a
  // cold load over a slow connection that surfaced as the red "Can't reach the
  // schedule" screen even though sign-in succeeded a moment later.
  const attach = () => {
    if (cancelled) return;

    unsubscribeSections = onSnapshot(
      collection(db, SECTIONS_COLLECTION),
      (snapshot) => {
        // Rebuild rather than merge so a deleted section document does not
        // linger in memory forever.
        const next: typeof latestSections = {};
        snapshot.forEach((docSnap) => {
          const id = docSnap.id as Section;
          if (id === 'boys' || id === 'girls') {
            next[id] = docSnap.data() as Partial<SectionData>;
          }
        });
        latestSections = next;
        sectionsLoaded = true;
        notify();
      },
      (err) => {
        console.error('Firestore sections snapshot error:', err);
        onError?.(err);
      }
    );

    unsubscribeReservations = onSnapshot(
      collection(db, RESERVATIONS_COLLECTION),
      (snapshot) => {
        const boysRes: Record<string, Reservation[]> = {};
        const girlsRes: Record<string, Reservation[]> = {};

        snapshot.forEach((docSnap) => {
          const res = docSnap.data() as Reservation & { section?: Section };
          const sec: Section = res.section || 'boys';
          const key = reservationKey(res.day, res.period, res.labId);

          const target = sec === 'boys' ? boysRes : girlsRes;
          if (!target[key]) target[key] = [];
          target[key].push({ ...res, id: docSnap.id });
        });

        latestReservations = { boys: boysRes, girls: girlsRes };
        reservationsLoaded = true;
        notify();
      },
      (err) => {
        console.error('Firestore reservations snapshot error:', err);
        onError?.(err);
      }
    );
  };

  // authReady resolves rather than rejects even when anonymous sign-in fails,
  // so the app still attaches and surfaces any real permission error through
  // the snapshot error handlers above.
  void authReady.then(attach, attach);

  return () => {
    cancelled = true;
    unsubscribeSections?.();
    unsubscribeReservations?.();
  };
}

/**
 * Creates a reservation, refusing to overwrite a slot that someone else won.
 *
 * Pass `allowOverwrite` for an administrator force-book.
 */
export async function addOrUpdateReservation(
  section: Section,
  reservation: Reservation,
  allowOverwrite = false
) {
  await authReady;

  const id = reservationSlotId(
    section,
    reservation.day,
    reservation.period,
    reservation.slotIndex
  );
  const resRef = doc(db, RESERVATIONS_COLLECTION, id);
  const payload = { ...reservation, id, section };

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(resRef);
    if (existing.exists() && !allowOverwrite) {
      const takenBy = (existing.data() as Reservation).teacher || 'another teacher';
      throw new SlotTakenError(takenBy);
    }
    tx.set(resRef, payload);
  });

  return payload;
}

export async function removeReservation(reservationId: string) {
  await authReady;
  await deleteDoc(doc(db, RESERVATIONS_COLLECTION, reservationId));
}

/**
 * Records the lab supervisor's response to a booking, or clears it.
 *
 * Written as a merge on the single field rather than by re-saving the whole
 * reservation: the supervisor is acting on a row they are reading, and a full
 * overwrite would silently stamp their stale copy over any edit the teacher
 * made to the experiment details in between.
 *
 * Passing `null` removes the review, which is how the supervisor undoes a
 * decision -- `deleteField()` rather than an undefined, so the key actually
 * leaves the document instead of failing validation as a null.
 */
export async function setSupervisorReview(
  reservationId: string,
  review: SupervisorReview | null
) {
  await authReady;
  await setDoc(
    doc(db, RESERVATIONS_COLLECTION, reservationId),
    { supervisorReview: review ?? deleteField() },
    { merge: true }
  );
}

export async function updateSectionSettings(
  section: Section,
  updatedSettings: Partial<SectionData>
) {
  await authReady;
  await setDoc(doc(db, SECTIONS_COLLECTION, section), updatedSettings, { merge: true });
}

/* --- Lab materials inventory ------------------------------------------- */

/**
 * Firestore rejects `undefined`, and the rules validate optional fields only
 * when the key is present -- so an empty spreadsheet cell must drop the key
 * rather than write an empty string. Otherwise the stockroom listing fills up
 * with blank hazards and zero-length units that filters then have to special-
 * case everywhere.
 */
function pruneEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && v.trim() === '') return;
    out[k] = typeof v === 'string' ? v.trim() : v;
  });
  return out as Partial<T>;
}

export function subscribeToMaterials(
  onChange: (materials: Material[]) => void,
  onError?: (err: unknown) => void
) {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  // Same reason the schedule listeners wait: a listener refused before sign-in
  // resolves fails terminally, Firestore does not silently retry it.
  authReady.then(() => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      collection(db, MATERIALS_COLLECTION),
      (snap) => {
        onChange(snap.docs.map((d) => ({ ...(d.data() as Material), id: d.id })));
      },
      (err) => {
        console.error('Firestore materials snapshot error:', err);
        onError?.(err);
      }
    );
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function saveMaterial(material: Omit<Material, 'id'> & { id?: string }) {
  await authReady;
  const id = material.id || doc(collection(db, MATERIALS_COLLECTION)).id;
  const { id: _ignored, ...rest } = material;
  await setDoc(
    doc(db, MATERIALS_COLLECTION, id),
    pruneEmpty({ ...rest, updatedAt: new Date().toISOString() }),
    { merge: true }
  );
  return id;
}

export async function deleteMaterial(materialId: string) {
  await authReady;
  await deleteDoc(doc(db, MATERIALS_COLLECTION, materialId));
}

export interface MaterialUpsertResult {
  /** New stock lines added to the school. */
  created: number;
  /** Existing lines whose quantity the sheet added to. */
  merged: number;
}

/**
 * Bulk upsert for the spreadsheet import.
 *
 * The decision of what merges into what is `planMaterialImport` in
 * utils/materialImport.ts -- pure, and covered by `npm run verify:import`.
 * This function is only the writer: it turns the plan into documents.
 *
 * Two rules, both from the plan and both worth restating here because they are
 * what an administrator is trusting when they press the button:
 *
 * - **Nothing is deleted or blanked.** Records the sheet does not mention are
 *   left alone. An import adds to the stockroom; it never replaces it.
 * - **A matching line has the sheet's quantity added to its own**, rather than
 *   overwritten. A line matches only when the school, the lab and every other
 *   field are identical -- so the same reagent on a different shelf stays a
 *   separate record instead of quietly moving.
 *
 * Batched at 400 because Firestore caps a batch at 500 writes and the whole
 * batch fails rather than partially applying.
 */
export async function upsertMaterials(
  section: Section,
  rows: Omit<Material, 'id' | 'section' | 'updatedAt'>[],
  existing: Material[]
): Promise<MaterialUpsertResult> {
  await authReady;

  const plan = planMaterialImport(section, rows, existing);
  const updatedAt = new Date().toISOString();

  const writes = plan.entries.map((entry) => ({
    id: entry.existing?.id || doc(collection(db, MATERIALS_COLLECTION)).id,
    data: pruneEmpty({
      ...entry.row,
      // Explicit rather than carried by the spread: the summed quantity is the
      // whole point, and `entry.row` still holds the sheet's raw value.
      quantity: entry.quantity,
      section,
      updatedAt
    })
  }));

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    writes.slice(i, i + 400).forEach(({ id, data }) => {
      batch.set(doc(db, MATERIALS_COLLECTION, id), data, { merge: true });
    });
    await batch.commit();
  }

  return { created: plan.created, merged: plan.merged };
}

/* --- Administrator accounts -------------------------------------------- */

/**
 * Live view of the administrator accounts.
 *
 * Every signed-in client subscribes, because the password check happens in the
 * browser -- there is no server to do it. That is why what is stored is a slow
 * salted hash and never the password; see src/utils/adminAuth.ts.
 */
export function subscribeToAdminAccounts(
  onChange: (accounts: StoredAdminAccount[]) => void,
  onError?: (err: unknown) => void
) {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  authReady.then(() => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      collection(db, ADMIN_ACCOUNTS_COLLECTION),
      (snap) => {
        onChange(
          snap.docs
            .map((d) => ({ ...(d.data() as StoredAdminAccount), id: d.id }))
            // Stable order, so "the first match wins" is the same answer on
            // every client rather than whatever Firestore returned today.
            .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        );
      },
      (err) => {
        console.error('Firestore admin accounts snapshot error:', err);
        onError?.(err);
      }
    );
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/**
 * Creates or updates an administrator account.
 *
 * Takes the already-hashed material rather than a password: hashing is the
 * caller's job, so a plaintext password never reaches this module and cannot
 * be logged, retried or accidentally written by a later edit here.
 */
export async function saveAdminAccount(
  account: Omit<StoredAdminAccount, 'id'> & { id?: string }
): Promise<string> {
  await authReady;
  const id = account.id || doc(collection(db, ADMIN_ACCOUNTS_COLLECTION)).id;
  const { id: _ignored, section, ...rest } = account;

  await setDoc(
    doc(db, ADMIN_ACCOUNTS_COLLECTION, id),
    {
      ...pruneEmpty(rest),
      // `section` is the one field here that can be cleared, and a merge write
      // that simply omits a key leaves the old value in place -- so moving
      // someone from one school back to "Both schools" silently did nothing.
      // deleteField() actually removes it.
      section: section ?? deleteField()
    },
    { merge: true }
  );
  return id;
}

export async function deleteAdminAccount(accountId: string) {
  await authReady;
  await deleteDoc(doc(db, ADMIN_ACCOUNTS_COLLECTION, accountId));
}

/* --- Modification history ---------------------------------------------- */

/**
 * Appends one line to the modification history.
 *
 * Deliberately never throws. The log exists to say what happened to the
 * stockroom, and a stockroom edit that genuinely succeeded must not be
 * reported to the user as a failure because the bookkeeping write behind it
 * did not land. A dropped entry is a gap in the record; a false error message
 * is a technician re-doing a delete that already worked.
 *
 * Append-only is enforced in firestore.rules, not here: `audits` allows create
 * and denies update and delete, so an entry cannot be edited away by the
 * person it names.
 */
export async function recordAudit(entry: Omit<AuditEntry, 'id'>): Promise<void> {
  try {
    await authReady;
    const ref = doc(collection(db, AUDITS_COLLECTION));
    await setDoc(ref, pruneEmpty({ ...entry, id: ref.id }));
  } catch (err) {
    console.error('Audit write failed (the change itself was not affected):', err);
  }
}

/**
 * Live view of the modification history, newest first.
 *
 * Capped at MAX_AUDIT_ENTRIES on the query rather than in the component: the
 * collection grows for the life of the school and downloading all of it to
 * render the last twenty rows would get slower every term. Older entries stay
 * in Firestore -- an audit trail that drops its own evidence is not one.
 */
export function subscribeToAudits(
  onChange: (entries: AuditEntry[]) => void,
  onError?: (err: unknown) => void
) {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  authReady.then(() => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(
        collection(db, AUDITS_COLLECTION),
        orderBy('at', 'desc'),
        limit(MAX_AUDIT_ENTRIES)
      ),
      (snap) => {
        onChange(snap.docs.map((d) => ({ ...(d.data() as AuditEntry), id: d.id })));
      },
      (err) => {
        console.error('Firestore audits snapshot error:', err);
        onError?.(err);
      }
    );
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/**
 * Deletes every reservation in a section, leaving the week number, rosters,
 * period blocks and archive untouched.
 *
 * This is the blunt instrument, distinct from `openNewWeekInFirestore`: that
 * one files the week into history first and rolls the counter forward. Nothing
 * here is recoverable, which is why the caller is expected to confirm
 * explicitly.
 *
 * Returns the number of documents removed so the caller can report it rather
 * than claiming success over an empty grid.
 */
export async function clearAllReservations(section: Section): Promise<number> {
  await authReady;

  const snap = await getDocs(collection(db, RESERVATIONS_COLLECTION));

  // Firestore caps a batch at 500 writes; a full term of bookings across both
  // schools can exceed that, and the whole batch fails rather than partially
  // applying. Chunking keeps it correct as the school grows.
  const targets = snap.docs.filter(
    (d) => (d.data() as { section?: Section }).section === section
  );

  for (let i = 0; i < targets.length; i += 400) {
    const batch = writeBatch(db);
    targets.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return targets.length;
}

/**
 * Archives the current week and clears the grid for the next one.
 *
 * The archive drops inline attachment payloads and keeps a bounded number of
 * weeks -- the section document has a 1 MiB ceiling and history used to grow
 * without limit until writes started failing.
 */
export async function openNewWeekInFirestore(
  section: Section,
  currentSectionData: SectionData
) {
  await authReady;

  const reservationsSnap = await getDocs(collection(db, RESERVATIONS_COLLECTION));
  const batch = writeBatch(db);

  reservationsSnap.forEach((docSnap) => {
    const data = docSnap.data() as { section?: Section };
    if (data.section === section) {
      batch.delete(docSnap.ref);
    }
  });

  const archiveItem = {
    week: currentSectionData.weekNumber,
    dateArchived: new Date().toISOString(),
    reservations: stripAttachments(currentSectionData.reservations)
  };

  const newHistory = [archiveItem, ...(currentSectionData.history || [])].slice(
    0,
    MAX_ARCHIVED_WEEKS
  );

  batch.set(
    doc(db, SECTIONS_COLLECTION, section),
    {
      weekNumber: currentSectionData.weekNumber + 1,
      history: newHistory,
      blockedPeriods: {}
    },
    { merge: true }
  );

  await batch.commit();
}
