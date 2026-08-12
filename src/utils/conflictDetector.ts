import { ConflictAlert, Day, Reservation, SectionData } from '../types';

/**
 * Scans all reservations in a section (and optionally both sections) to detect conflicts.
 */
export function detectAllConflicts(
  currentSectionData: SectionData,
  otherSectionData?: SectionData
): ConflictAlert[] {
  const alerts: ConflictAlert[] = [];
  const reservationsMap = currentSectionData.reservations;

  // Flatten all reservations in current section
  const allReservations: Reservation[] = [];
  Object.values(reservationsMap).forEach(list => {
    if (Array.isArray(list)) {
      allReservations.push(...list);
    }
  });

  // Also gather reservations from other section for cross-section teacher double booking check
  const otherReservations: Reservation[] = [];
  if (otherSectionData) {
    Object.values(otherSectionData.reservations).forEach(list => {
      if (Array.isArray(list)) {
        otherReservations.push(...list);
      }
    });
  }

  // 1. Group by (day, period) to detect same-slot conflicts
  const timeSlotGroups: Record<string, Reservation[]> = {};
  allReservations.forEach(res => {
    const timeKey = `${res.day}_p${res.period}`;
    if (!timeSlotGroups[timeKey]) timeSlotGroups[timeKey] = [];
    timeSlotGroups[timeKey].push(res);
  });

  // Check same section conflicts
  Object.entries(timeSlotGroups).forEach(([timeKey, list]) => {
    const [day, periodStr] = timeKey.split('_p');
    const period = parseInt(periodStr, 10);

    // A. Check Teacher Double-Bookings
    const teacherMap = new Map<string, Reservation[]>();
    list.forEach(res => {
      const existing = teacherMap.get(res.teacher) || [];
      existing.push(res);
      teacherMap.set(res.teacher, existing);
    });

    teacherMap.forEach((resList, teacher) => {
      if (resList.length > 1) {
        const labNames = resList.map(r => {
          const labObj = currentSectionData.labs.find(l => l.id === r.labId);
          return labObj ? labObj.name : r.labId;
        }).join(' & ');

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

    // B. Check Class Double-Bookings
    const classMap = new Map<string, Reservation[]>();
    list.forEach(res => {
      const existing = classMap.get(res.className) || [];
      existing.push(res);
      classMap.set(res.className, existing);
    });

    classMap.forEach((resList, className) => {
      if (resList.length > 1) {
        const labNames = resList.map(r => {
          const labObj = currentSectionData.labs.find(l => l.id === r.labId);
          return labObj ? labObj.name : r.labId;
        }).join(' & ');

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
  });

  // 2. Check Lab Slot Overbooking (> 2 per lab per period)
  Object.entries(reservationsMap).forEach(([cellKey, list]) => {
    if (list && list.length > 2) {
      const [day, pPart, labPart] = cellKey.split('_');
      const period = parseInt(pPart.replace('p', ''), 10);
      const labId = labPart.replace('lab', '');
      const labObj = currentSectionData.labs.find(l => l.id === labId);
      const labName = labObj ? labObj.name : labId;

      alerts.push({
        type: 'lab_overbooked',
        severity: 'error',
        day: day as Day,
        period,
        entityName: labName,
        message: `${labName} exceeds the 2-reservation limit in Period ${period} (${list.length}/2 booked).`
      });
    }
  });

  // 3. Cross-Section Teacher Double-Booking check (if teacher teaches in both sections)
  if (otherReservations.length > 0) {
    allReservations.forEach(res => {
      const crossMatch = otherReservations.find(
        oRes => oRes.day === res.day && oRes.period === res.period && oRes.teacher === res.teacher
      );
      if (crossMatch) {
        const labObj = currentSectionData.labs.find(l => l.id === res.labId);
        alerts.push({
          type: 'teacher_double_booked',
          severity: 'warning',
          day: res.day,
          period: res.period,
          entityName: res.teacher,
          message: `Cross-Section Alert: ${res.teacher} is also scheduled in ${otherSectionData?.name} during Period ${res.period} (${res.day.toUpperCase()}).`
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

  // All reservations in current section
  const allSectionReservations: Reservation[] = [];
  Object.values(currentSectionData.reservations).forEach(list => {
    if (Array.isArray(list)) allSectionReservations.push(...list);
  });

  // Active reservations in this specific (day, period)
  const periodReservations = allSectionReservations.filter(r => r.day === day && r.period === period);
  const existingSlotRes = periodReservations.find(r => r.slotIndex === slotIndex);

  // 1. Technician Capacity Limit (Max 2 active labs per period across all 5 labs)
  if (!existingSlotRes && periodReservations.length >= 2) {
    errors.push(`Technician Limit: Only 1 lab technician is on duty. Max 2 labs can be active in Period ${period} on ${day.toUpperCase()}.`);
  }

  // 1b. Technician Daily Max Load (Max 5 periods per day)
  const dayReservations = allSectionReservations.filter(
    r => r.day === day && !(r.period === period && r.slotIndex === slotIndex)
  );
  const activePeriodsOnDay = new Set(dayReservations.map(r => r.period));
  if (!activePeriodsOnDay.has(period) && activePeriodsOnDay.size >= 5) {
    errors.push(`Technician Daily Limit: The lab technician is already scheduled for 5 periods on ${day.toUpperCase()}. Maximum allowed load is 5 periods per day.`);
  }

  // 2. Check if selected lab room is already reserved in this period by another slot
  const samePeriodSameLab = periodReservations.find(
    r => r.labId === labId && r.slotIndex !== slotIndex
  );
  if (samePeriodSameLab) {
    const labObj = currentSectionData.labs.find(l => l.id === labId);
    const labName = labObj ? labObj.name : labId;
    errors.push(`Lab Already Reserved: ${labName} is already booked in Period ${period} by ${samePeriodSameLab.teacher}. Please select a different lab.`);
  }

  // 3. Teacher Double-Booking Check
  const samePeriodTeacherRes = periodReservations.find(
    r => r.teacher === teacher && r.slotIndex !== slotIndex
  );
  if (samePeriodTeacherRes) {
    const labObj = currentSectionData.labs.find(l => l.id === samePeriodTeacherRes.labId);
    const labName = labObj ? labObj.name : samePeriodTeacherRes.labId;
    errors.push(`Teacher Double-Booking: Teacher "${teacher}" is already scheduled in ${labName} during Period ${period}.`);
  }

  // 4. Class Double-Booking Check
  const samePeriodClassRes = periodReservations.find(
    r => r.className === className && r.slotIndex !== slotIndex
  );
  if (samePeriodClassRes) {
    const labObj = currentSectionData.labs.find(l => l.id === samePeriodClassRes.labId);
    const labName = labObj ? labObj.name : samePeriodClassRes.labId;
    errors.push(`Class Double-Booking: Class "${className}" is already in ${labName} during Period ${period}.`);
  }

  // 5. Cross-section teacher conflict
  if (otherSectionData) {
    const otherReservations: Reservation[] = [];
    Object.values(otherSectionData.reservations).forEach(list => {
      if (Array.isArray(list)) otherReservations.push(...list);
    });

    const crossTeacher = otherReservations.find(
      r => r.day === day && r.period === period && r.teacher === teacher
    );

    if (crossTeacher) {
      warnings.push(`Cross-Section Warning: Teacher "${teacher}" has a reservation in ${otherSectionData.name} during Period ${period}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    canOverride: errors.length > 0, // Admin can override
    warnings,
    errors
  };
}
