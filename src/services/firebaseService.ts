import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  runTransaction,
  deleteField
} from 'firebase/firestore';
import { db, authReady } from '../firebase';
import {
  AppState,
  Section,
  Reservation,
  SectionData,
  SupervisorReview,
  Material
} from '../types';
import { INITIAL_APP_STATE } from '../data/initialData';
import { MAX_ARCHIVED_WEEKS } from '../constants';
import { SCHOOL_LABEL } from '../brand';
import { reservationKey } from '../utils/scheduleKeys';

const SECTIONS_COLLECTION = 'sections';
const RESERVATIONS_COLLECTION = 'reservations';
const MATERIALS_COLLECTION = 'materials';

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
  created: number;
  updated: number;
}

/**
 * Bulk upsert for the spreadsheet import.
 *
 * Matching, in order: the item `code` when the row has one, otherwise
 * name + lab. That is the honest key -- a school numbers its chemicals but
 * rarely its beakers, and two beakers of the same name in the same lab are the
 * same stock line.
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

  const byCode = new Map<string, Material>();
  const byNameLab = new Map<string, Material>();
  existing
    .filter((m) => m.section === section)
    .forEach((m) => {
      if (m.code) byCode.set(m.code.trim().toLowerCase(), m);
      byNameLab.set(`${m.name.trim().toLowerCase()}::${m.labId}`, m);
    });

  const updatedAt = new Date().toISOString();
  let created = 0;
  let updated = 0;
  const writes: { id: string; data: Record<string, unknown> }[] = [];

  rows.forEach((row) => {
    const match =
      (row.code && byCode.get(row.code.trim().toLowerCase())) ||
      byNameLab.get(`${row.name.trim().toLowerCase()}::${row.labId}`);

    if (match) updated += 1;
    else created += 1;

    writes.push({
      id: match?.id || doc(collection(db, MATERIALS_COLLECTION)).id,
      data: pruneEmpty({ ...row, section, updatedAt })
    });
  });

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    writes.slice(i, i + 400).forEach(({ id, data }) => {
      batch.set(doc(db, MATERIALS_COLLECTION, id), data, { merge: true });
    });
    await batch.commit();
  }

  return { created, updated };
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
