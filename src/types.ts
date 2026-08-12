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
