import { AppState, Day, Lab } from '../types';

export const DEFAULT_LABS: Lab[] = [
  { id: 'lab-1', name: 'Chemistry Lab', code: 'CHEM-01', capacity: 30, color: 'emerald' },
  { id: 'lab-2', name: 'Biology Lab', code: 'BIO-01', capacity: 30, color: 'teal' },
  { id: 'lab-3', name: 'Physics Lab', code: 'PHYS-01', capacity: 30, color: 'indigo' },
  { id: 'lab-4', name: 'General Science Lab 1', code: 'SCI-01', capacity: 28, color: 'cyan' },
  { id: 'lab-5', name: 'General Science Lab 2', code: 'SCI-02', capacity: 28, color: 'sky' },
];

export const INITIAL_APP_STATE: AppState = {
  boys: {
    name: 'Boys Section',
    themeColor: 'emerald',
    weekNumber: 1,
    deadlineDay: 0, // Sunday
    deadlineTime: '06:00',
    isLocked: false,
    teachers: [
      'Dr. Ahmed Al-Harbi',
      'Husam Abed Alfattah',
      'Fahad Al-Otaibi',
      'Khalid Al-Ghamdi',
      'Sultan Al-Mansoor',
      'Tariq Al-Zahrani',
      'Youssef Al-Qhatani'
    ],
    classes: ['4A', '4B', '4C', '5A', '5B', '5C', '6A', '6B'],
    labs: [...DEFAULT_LABS],
    reservations: {
      'sunday_p1_lab-1': [
        {
          id: 'res-1',
          day: 'sunday',
          period: 1,
          labId: 'lab-1',
          slotIndex: 0,
          teacher: 'Dr. Ahmed Al-Harbi',
          className: '4A',
          subject: 'Chemistry Experiments',
          createdAt: new Date().toISOString()
        },
        {
          id: 'res-2',
          day: 'sunday',
          period: 1,
          labId: 'lab-1',
          slotIndex: 1,
          teacher: 'Husam Abed Alfattah',
          className: '4B',
          subject: 'Acid-Base Titration',
          createdAt: new Date().toISOString()
        }
      ],
      'sunday_p2_lab-2': [
        {
          id: 'res-3',
          day: 'sunday',
          period: 2,
          labId: 'lab-2',
          slotIndex: 0,
          teacher: 'Fahad Al-Otaibi',
          className: '5A',
          subject: 'Microscope Cell Analysis',
          createdAt: new Date().toISOString()
        }
      ],
      'monday_p3_lab-3': [
        {
          id: 'res-4',
          day: 'monday',
          period: 3,
          labId: 'lab-3',
          slotIndex: 0,
          teacher: 'Khalid Al-Ghamdi',
          className: '6A',
          subject: 'Optics & Lenses',
          createdAt: new Date().toISOString()
        },
        {
          id: 'res-5',
          day: 'monday',
          period: 3,
          labId: 'lab-3',
          slotIndex: 1,
          teacher: 'Sultan Al-Mansoor',
          className: '6B',
          subject: 'Circuits & Electricity',
          createdAt: new Date().toISOString()
        }
      ],
      'tuesday_p2_lab-4': [
        {
          id: 'res-6',
          day: 'tuesday',
          period: 2,
          labId: 'lab-4',
          slotIndex: 0,
          teacher: 'Tariq Al-Zahrani',
          className: '5B',
          subject: 'Density & Measurement',
          createdAt: new Date().toISOString()
        }
      ]
    },
    history: []
  },
  girls: {
    name: 'Girls Section',
    themeColor: 'rose',
    weekNumber: 1,
    deadlineDay: 0, // Sunday
    deadlineTime: '06:00',
    isLocked: false,
    teachers: [
      'Noura Al-Shammari',
      'Sara Al-Mutairi',
      'Fatima Al-Zahrani',
      'Reem Al-Dosari',
      'Amal Al-Shehri',
      'Mona Al-Hassan',
      'Layan Al-Otaibi'
    ],
    classes: ['4G1', '4G2', '5G1', '5G2', '5G3', '6G1', '6G2'],
    labs: [...DEFAULT_LABS],
    reservations: {
      'sunday_p1_lab-2': [
        {
          id: 'res-g1',
          day: 'sunday',
          period: 1,
          labId: 'lab-2',
          slotIndex: 0,
          teacher: 'Noura Al-Shammari',
          className: '4G1',
          subject: 'Plant Biology Observation',
          createdAt: new Date().toISOString()
        },
        {
          id: 'res-g2',
          day: 'sunday',
          period: 1,
          labId: 'lab-2',
          slotIndex: 1,
          teacher: 'Sara Al-Mutairi',
          className: '4G2',
          subject: 'Photosynthesis Lab',
          createdAt: new Date().toISOString()
        }
      ],
      'wednesday_p4_lab-5': [
        {
          id: 'res-g3',
          day: 'wednesday',
          period: 4,
          labId: 'lab-5',
          slotIndex: 0,
          teacher: 'Fatima Al-Zahrani',
          className: '6G1',
          subject: 'States of Matter',
          createdAt: new Date().toISOString()
        }
      ]
    },
    history: []
  }
};

export const DAYS_LIST: { id: Day; label: string; short: string }[] = [
  { id: 'sunday', label: 'Sunday', short: 'Sun' },
  { id: 'monday', label: 'Monday', short: 'Mon' },
  { id: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { id: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { id: 'thursday', label: 'Thursday', short: 'Thu' }
];

export const PERIODS_LIST = [1, 2, 3, 4, 5, 6, 7];
