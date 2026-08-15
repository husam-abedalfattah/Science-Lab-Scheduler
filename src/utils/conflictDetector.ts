import { ConflictAlert, Day, Reservation, SectionData } from '../types';
import {
  MAX_CONCURRENT_LABS_PER_PERIOD,
  MAX_ACTIVE_PERIODS_PER_DAY
} from '../constants';

function flatten(reservations: Record<string, Reservation[]> | undefined): Reservation[] {
  const out: Reservation[] = [];
  Object.values(reservations || {}).forEach(list => {
    if (Array.isArray(list)) out.push(...list);
  });
  return out;
}

function labNameFor(sectionData: SectionData, labId: string): string {
  return sectionData.labs.find(l => l.id === labId)?.name || labId;
}

/**
 * Scans all reservations in a section (and optionally both sections) to detect conflicts.
 */
export function detectAllConflicts(
  currentSectionData: SectionData,
  otherSectionData?: SectionData
): ConflictAlert[] {
  const alerts: ConflictAlert[] = [];
  const allReservations = flatten(currentSectionData.reservations);
  const otherReservations = flatten(otherSectionData?.reservations);

  // 1. Group by (day, period) to detect same-slot conflicts
  const timeSlotGroups: Record<string, Reservation[]> = {};
  allReservations.forEach(res => {
    const timeKey = `${res.day}_p${res.period}`;
    if (!timeSlotGroups[timeKey]) timeSlotGroups[timeKey] = [];
    timeSlotGroups[timeKey].push(res);
  });

  Object.entries(timeSlotGroups).forEach(([timeKey, list]) => {
    const [day, periodStr] = timeKey.split('_p');
    const period = parseInt(periodStr, 10);

    // A. Teacher double-bookings
    const teacherMap = new Map<string, Reservation[]>();
    list.forEach(res => {
      teacherMap.set(res.teacher, [...(teacherMap.get(res.teacher) || []), res]);
    });

    teacherMap.forEach((resList, teacher) => {
      if (resList.length > 1) {
        const labNames = resList.map(r => labNameFor(currentSectionData, r.labId)).join(' & ');
        alerts.push({
          type: 'teacher_double_booked',
          severity: 'error',
          day: day as Day,
          period,
          entityName: teacher,
          message: `Teacher ${teacher} is double-booked in Period ${period} (${day.toUpperCase()}) across ${labNames}.`,
          reservationId1: resList[0].id,
          reservationId2: resList[1].id
        });
      }
    });

    // B. Class double-bookings
    const classMap = new Map<string, Reservation[]>();
    list.forEach(res => {
      classMap.set(res.className, [...(classMap.get(res.className) || []), res]);
    });

    classMap.forEach((resList, className) => {
      if (resList.length > 1) {
        const labNames = resList.map(r => labNameFor(currentSectionData, r.labId)).join(' & ');
        alerts.push({
          type: 'class_double_booked',
          severity: 'error',
          day: day as Day,
          period,
          entityName: className,
          message: `Class ${className} is double-booked in Period ${period} (${day.toUpperCase()}) across ${labNames}.`,
          reservationId1: resList[0].id,
          reservationId2: resList[1].id
        });
      }
    });

    // C. Technician concurrency limit for the whole period.
    // Previously this counted per-lab against a hardcoded limit of 2, which
    // disagreed with both the grid (3 slots) and validateNewBooking (3).
    if (list.length > MAX_CONCURRENT_LABS_PER_PERIOD) {
      alerts.push({
        type: 'lab_overbooked',
        severity: 'error',
        day: day as Day,
        period,
        entityName: `Period ${period}`,
        message: `Period ${period} (${day.toUpperCase()}) has ${list.length} lab sessions booked; the technician can cover ${MAX_CONCURRENT_LABS_PER_PERIOD}.`,
        reservationId1: list[MAX_CONCURRENT_LABS_PER_PERIOD]?.id
      });
    }
  });

  // 2. Same lab room booked twice in one period
  const labPeriodMap = new Map<string, Reservation[]>();
  allReservations.forEach(res => {
    const key = `${res.day}_p${res.period}_${res.labId}`;
    labPeriodMap.set(key, [...(labPeriodMap.get(key) || []), res]);
  });

  labPeriodMap.forEach((list) => {
    if (list.length > 1) {
      const first = list[0];
      const labName = labNameFor(currentSectionData, first.labId);
      alerts.push({
        type: 'lab_overbooked',
        severity: 'error',
        day: first.day,
        period: first.period,
        entityName: labName,
        message: `${labName} is booked ${list.length} times in Period ${first.period} (${first.day.toUpperCase()}). A room can only host one class at a time.`,
        reservationId1: list[0].id,
        reservationId2: list[1].id
      });
    }
  });

  // 3. Technician daily load
  const periodsByDay = new Map<Day, Set<number>>();
  allReservations.forEach(res => {
    const set = periodsByDay.get(res.day) || new Set<number>();
    set.add(res.period);
    periodsByDay.set(res.day, set);
  });

  periodsByDay.forEach((periods, day) => {
    if (periods.size > MAX_ACTIVE_PERIODS_PER_DAY) {
      alerts.push({
        type: 'lab_overbooked',
        severity: 'warning',
        day,
        period: 0,
        entityName: day,
        message: `${day.toUpperCase()} has ${periods.size} active periods; the technician's daily limit is ${MAX_ACTIVE_PERIODS_PER_DAY}.`
      });
    }
  });

  // 4. Cross-section teacher double-booking.
  // Carries the offending reservation id so the conflict resolver can act on
  // it, and is emitted once per (teacher, day, period) rather than once per
  // matching pair, which used to produce duplicate rows.
  if (otherReservations.length > 0) {
    const seen = new Set<string>();
    allReservations.forEach(res => {
      const key = `${res.teacher}_${res.day}_p${res.period}`;
      if (seen.has(key)) return;

      const crossMatch = otherReservations.find(
        oRes => oRes.day === res.day && oRes.period === res.period && oRes.teacher === res.teacher
      );
      if (crossMatch) {
        seen.add(key);
        alerts.push({
          type: 'teacher_double_booked',
          severity: 'warning',
          day: res.day,
          period: res.period,
          entityName: res.teacher,
          message: `Cross-Section Alert: ${res.teacher} is also scheduled in ${otherSectionData?.name} during Period ${res.period} (${res.day.toUpperCase()}).`,
          reservationId1: res.id
        });
      }
    });
  }

  return alerts;
}

export interface BookingValidationResult {
  isValid: boolean;
  canOverride: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validates a potential new reservation before submission.
 */
export function validateNewBooking(
  day: Day,
  period: number,
  labId: string,
  slotIndex: number,
  teacher: string,
  className: string,
  currentSectionData: SectionData,
  otherSectionData?: SectionData
): BookingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const allSectionReservations = flatten(currentSectionData.reservations);
  const periodReservations = allSectionReservations.filter(
    r => r.day === day && r.period === period
  );
  const existingSlotRes = periodReservations.find(r => r.slotIndex === slotIndex);

  // 0. Schedule-wide lock set by the administrator
  if (currentSectionData.isLocked) {
    errors.push('Bookings are currently locked by the administrator for this section.');
  }

  // 0b. Period blocked by the lab technician.
  // The grid rendered these but nothing validated them, so a blocked period
  // was still bookable through the modal's day/period dropdowns.
  const blocked = currentSectionData.blockedPeriods?.[`${day}_p${period}`];
  if (blocked) {
    errors.push(
      `Period Blocked: the lab technician has blocked ${day.toUpperCase()} Period ${period} — "${blocked.reason}".`
    );
  }

  // 1. Technician concurrency limit
  if (!existingSlotRes && periodReservations.length >= MAX_CONCURRENT_LABS_PER_PERIOD) {
    errors.push(
      `Technician Capacity Limit: max ${MAX_CONCURRENT_LABS_PER_PERIOD} labs can be reserved concurrently in Period ${period} on ${day.toUpperCase()}.`
    );
  }

  // 1b. Technician daily load
  const dayReservations = allSectionReservations.filter(
    r => r.day === day && !(r.period === period && r.slotIndex === slotIndex)
  );
  const activePeriodsOnDay = new Set(dayReservations.map(r => r.period));
  if (!activePeriodsOnDay.has(period) && activePeriodsOnDay.size >= MAX_ACTIVE_PERIODS_PER_DAY) {
    errors.push(
      `Technician Daily Limit: the lab technician is already scheduled for ${MAX_ACTIVE_PERIODS_PER_DAY} periods on ${day.toUpperCase()}.`
    );
  }

  // 2. Lab room already reserved this period
  const samePeriodSameLab = periodReservations.find(
    r => r.labId === labId && r.slotIndex !== slotIndex
  );
  if (samePeriodSameLab) {
    errors.push(
      `Lab Already Reserved: ${labNameFor(currentSectionData, labId)} is already booked in Period ${period} by ${samePeriodSameLab.teacher}. Please select a different lab.`
    );
  }

  // 3. Teacher double-booking
  const samePeriodTeacherRes = periodReservations.find(
    r => r.teacher === teacher && r.slotIndex !== slotIndex
  );
  if (samePeriodTeacherRes) {
    errors.push(
      `Teacher Double-Booking: "${teacher}" is already scheduled in ${labNameFor(currentSectionData, samePeriodTeacherRes.labId)} during Period ${period}.`
    );
  }

  // 4. Class double-booking
  const samePeriodClassRes = periodReservations.find(
    r => r.className === className && r.slotIndex !== slotIndex
  );
  if (samePeriodClassRes) {
    errors.push(
      `Class Double-Booking: Class "${className}" is already in ${labNameFor(currentSectionData, samePeriodClassRes.labId)} during Period ${period}.`
    );
  }

  // 5. Cross-section teacher conflict (advisory)
  if (otherSectionData) {
    const crossTeacher = flatten(otherSectionData.reservations).find(
      r => r.day === day && r.period === period && r.teacher === teacher
    );
    if (crossTeacher) {
      warnings.push(
        `Cross-Section Warning: "${teacher}" has a reservation in ${otherSectionData.name} during Period ${period}.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    canOverride: errors.length > 0,
    warnings,
    errors
  };
}
