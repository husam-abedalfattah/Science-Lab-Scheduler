import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { AppState, Section, Reservation, SectionData } from '../types';
import { INITIAL_APP_STATE } from '../data/initialData';

const SECTIONS_COLLECTION = 'sections';
const RESERVATIONS_COLLECTION = 'reservations';

// Helper to seed initial data if database is empty
export async function seedInitialDataIfNeeded() {
  try {
    const sectionsSnap = await getDocs(collection(db, SECTIONS_COLLECTION));
    if (sectionsSnap.empty) {
      console.log('Firestore empty. Seeding initial sections and reservations...');
      
      // Seed Boys Section Settings
      const boysData = { ...INITIAL_APP_STATE.boys };
      const { reservations: boysRes, ...boysSettings } = boysData;
      await setDoc(doc(db, SECTIONS_COLLECTION, 'boys'), {
        sectionId: 'boys',
        ...boysSettings
      });

      // Seed Girls Section Settings
      const girlsData = { ...INITIAL_APP_STATE.girls };
      const { reservations: girlsRes, ...girlsSettings } = girlsData;
      await setDoc(doc(db, SECTIONS_COLLECTION, 'girls'), {
        sectionId: 'girls',
        ...girlsSettings
      });

      // Seed Initial Reservations
      const batch = writeBatch(db);
      
      // Boys Reservations
      Object.values(boysRes).forEach((list) => {
        list.forEach((res) => {
          const resRef = doc(db, RESERVATIONS_COLLECTION, res.id);
          batch.set(resRef, { ...res, section: 'boys' });
        });
      });

      // Girls Reservations
      Object.values(girlsRes).forEach((list) => {
        list.forEach((res) => {
          const resRef = doc(db, RESERVATIONS_COLLECTION, res.id);
          batch.set(resRef, { ...res, section: 'girls' });
        });
      });

      await batch.commit();
      console.log('Initial seed complete.');
    }
  } catch (err) {
    console.error('Error checking/seeding initial data:', err);
  }
}

// Subscribe to real-time updates for both sections and reservations
export function subscribeToAppState(onStateChange: (state: AppState) => void) {
  let latestSections: { boys?: Partial<SectionData>; girls?: Partial<SectionData> } = {};
  let latestReservations: Record<Section, Record<string, Reservation[]>> = {
    boys: {},
    girls: {}
  };

  const notify = () => {
    onStateChange({
      boys: {
        ...INITIAL_APP_STATE.boys,
        ...latestSections.boys,
        reservations: latestReservations.boys || {}
      },
      girls: {
        ...INITIAL_APP_STATE.girls,
        ...latestSections.girls,
        reservations: latestReservations.girls || {}
      }
    });
  };

  // 1. Listen to Sections
  const unsubscribeSections = onSnapshot(
    collection(db, SECTIONS_COLLECTION),
    (snapshot) => {
      snapshot.forEach((docSnap) => {
        const id = docSnap.id as Section;
        if (id === 'boys' || id === 'girls') {
          latestSections[id] = docSnap.data() as Partial<SectionData>;
        }
      });
      notify();
    },
    (err) => console.error('Firestore sections snapshot error:', err)
  );

  // 2. Listen to Reservations
  const unsubscribeReservations = onSnapshot(
    collection(db, RESERVATIONS_COLLECTION),
    (snapshot) => {
      const boysRes: Record<string, Reservation[]> = {};
      const girlsRes: Record<string, Reservation[]> = {};

      snapshot.forEach((docSnap) => {
        const res = docSnap.data() as Reservation & { section?: Section };
        const sec: Section = res.section || 'boys';
        const key = `${res.day}_p${res.period}_lab${res.labId}`;

        const target = sec === 'boys' ? boysRes : girlsRes;
        if (!target[key]) target[key] = [];
        target[key].push({ ...res, id: docSnap.id });
      });

      latestReservations = {
        boys: boysRes,
        girls: girlsRes
      };
      notify();
    },
    (err) => console.error('Firestore reservations snapshot error:', err)
  );

  return () => {
    unsubscribeSections();
    unsubscribeReservations();
  };
}

// Add or update a reservation in Firestore
export async function addOrUpdateReservation(section: Section, reservation: Reservation) {
  try {
    const resRef = doc(db, RESERVATIONS_COLLECTION, reservation.id);
    await setDoc(resRef, {
      ...reservation,
      section
    });
  } catch (err) {
    console.error('Error adding reservation to Firestore:', err);
    throw err;
  }
}

// Remove a reservation from Firestore
export async function removeReservation(reservationId: string) {
  try {
    const resRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
    await deleteDoc(resRef);
  } catch (err) {
    console.error('Error deleting reservation from Firestore:', err);
    throw err;
  }
}

// Update Section Settings (isLocked, deadline, teachers, classes, etc.)
export async function updateSectionSettings(
  section: Section,
  updatedSettings: Partial<SectionData>
) {
  try {
    const secRef = doc(db, SECTIONS_COLLECTION, section);
    await setDoc(secRef, updatedSettings, { merge: true });
  } catch (err) {
    console.error('Error updating section settings in Firestore:', err);
    throw err;
  }
}

// Open new week (Clear all reservations for a section and increment week number)
export async function openNewWeekInFirestore(
  section: Section,
  currentSectionData: SectionData
) {
  try {
    // 1. Fetch current section reservations
    const reservationsSnap = await getDocs(collection(db, RESERVATIONS_COLLECTION));
    const batch = writeBatch(db);

    reservationsSnap.forEach((docSnap) => {
      const data = docSnap.data() as { section?: Section };
      if (data.section === section) {
        batch.delete(docSnap.ref);
      }
    });

    // 2. Increment week number and store history
    const archiveItem = {
      week: currentSectionData.weekNumber,
      dateArchived: new Date().toLocaleDateString(),
      reservations: { ...currentSectionData.reservations }
    };

    const newHistory = [archiveItem, ...(currentSectionData.history || [])];

    const secRef = doc(db, SECTIONS_COLLECTION, section);
    batch.set(
      secRef,
      {
        weekNumber: currentSectionData.weekNumber + 1,
        history: newHistory
      },
      { merge: true }
    );

    await batch.commit();
  } catch (err) {
    console.error('Error opening new week in Firestore:', err);
    throw err;
  }
}
