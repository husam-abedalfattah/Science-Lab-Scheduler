/**
 * Key helpers for the in-memory schedule maps.
 *
 * `SectionData.reservations` is keyed by (day, period, lab). That string was
 * built by hand in both firebaseService (from live documents) and initialData
 * (as literal object keys), and the two had drifted apart -- the seed file used
 * `sunday_p1_lab-1` while the subscription produced `sunday_p1_lablab-1`, so
 * seeded state and live state were not addressable the same way. Deriving the
 * key in one place keeps them identical by construction.
 */
export const reservationKey = (day: string, period: number, labId: string): string =>
  `${day}_p${period}_lab${labId}`;

/** Key for `SectionData.blockedPeriods`, which is per (day, period). */
export const blockedPeriodKey = (day: string, period: number): string =>
  `${day}_p${period}`;
