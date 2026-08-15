import { AppState, Day, Lab } from '../types';
import { reservationKey } from '../utils/scheduleKeys';
import { SCHOOL_LABEL } from '../brand';

export const DEFAULT_LABS: Lab[] = [
  { id: 'lab-1', name: 'Chemistry Lab', code: 'CHEM-01', capacity: 30, color: 'emerald' },
  { id: 'lab-2', name: 'Biology Lab', code: 'BIO-01', capacity: 30, color: 'teal' },
  { id: 'lab-3', name: 'Physics Lab', code: 'PHYS-01', capacity: 30, color: 'indigo' },
  { id: 'lab-4', name: 'General Science Lab 1', code: 'SCI-01', capacity: 28, color: 'cyan' },
  { id: 'lab-5', name: 'General Science Lab 2', code: 'SCI-02', capacity: 28, color: 'sky' },
];

export const INITIAL_APP_STATE: AppState = {
  boys: {
    name: SCHOOL_LABEL.boys,
    themeColor: 'brand-green',
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
      [reservationKey('sunday', 1, 'lab-1')]: [
        {
          id: 'res-1',
          day: 'sunday',
          period: 1,
          labId: 'lab-1',
          slotIndex: 0,
          teacher: 'Dr. Ahmed Al-Harbi',
          className: '4A',
          subject: 'Acid-Base Titration',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Acid-Base Neutralization & Titration',
            materialsNeeded: '1. Hydrochloric Acid Solution (HCl 0.1M, 500mL)\n2. Sodium Hydroxide (NaOH 0.1M, 500mL)\n3. Phenolphthalein indicator bottle (50mL)\n4. Burettes (x10) & Retort Stands (x10)\n5. Erlenmeyer Flasks 250mL (x20)\n6. Volumetric Pipettes 25mL (x10)',
            numberOfGroups: 5,
            needsTechSupport: true,
            safetyItems: ['Safety Goggles', 'Lab Coat', 'Nitrile Gloves'],
            techNotes: 'Prepare fresh 0.1M NaOH solution on Sunday morning before Period 1.',
            needsPrintedWorksheets: true,
            worksheetCopies: 25
          }
        }
      ],
      // Slot 1 of this period runs in the general-science room. It used to be
      // booked into the Chemistry Lab alongside slot 0, which meant the seed
      // data shipped a room double-booking and every fresh install opened with
      // conflict alerts already showing.
      [reservationKey('sunday', 1, 'lab-4')]: [
        {
          id: 'res-2',
          day: 'sunday',
          period: 1,
          labId: 'lab-4',
          slotIndex: 1,
          teacher: 'Husam Abed Alfattah',
          className: '4B',
          subject: 'Chemical Reaction Rates',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Factors Affecting Reaction Rates',
            materialsNeeded: '1. Sodium Thiosulfate 0.1M (1L)\n2. Hydrochloric Acid 2M (500mL)\n3. Stopwatches (x8)\n4. Conical Flasks 100mL with marked X paper (x8)\n5. Thermometers (x8)',
            numberOfGroups: 4,
            needsTechSupport: false,
            safetyItems: ['Safety Goggles', 'Lab Coat'],
            needsPrintedWorksheets: true,
            worksheetCopies: 22
          }
        }
      ],
      [reservationKey('sunday', 2, 'lab-2')]: [
        {
          id: 'res-3',
          day: 'sunday',
          period: 2,
          labId: 'lab-2',
          slotIndex: 0,
          teacher: 'Fahad Al-Otaibi',
          className: '5A',
          subject: 'Microscope Cell Analysis',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Onion Epidermis & Cheek Cell Microscopy',
            materialsNeeded: '1. Compound Light Microscopes (x12)\n2. Glass Microscope Slides & Coverslips (x50)\n3. Methylene Blue Stain & Iodine Solution\n4. Dissecting Needles & Forceps\n5. Fresh Onion Bulbs & Cotton Swabs',
            numberOfGroups: 6,
            needsTechSupport: true,
            safetyItems: ['Safety Goggles', 'Nitrile Gloves'],
            techNotes: 'Check microscope halogen bulbs and glass slide covers beforehand.',
            needsPrintedWorksheets: true,
            worksheetCopies: 28
          }
        }
      ],
      [reservationKey('monday', 3, 'lab-3')]: [
        {
          id: 'res-4',
          day: 'monday',
          period: 3,
          labId: 'lab-3',
          slotIndex: 0,
          teacher: 'Khalid Al-Ghamdi',
          className: '6A',
          subject: 'Optics & Refraction',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Refraction of Light & Prism Dispersion',
            materialsNeeded: '1. Glass Prisms & Glass Rectangular Blocks (x10)\n2. Ray Boxes with Single/Triple Slits (x10)\n3. Power Supplies 12V (x10)\n4. Protractors & White Drawing Sheets (x30)\n5. Convex & Concave Lenses (f=10cm, 15cm)',
            numberOfGroups: 5,
            needsTechSupport: false,
            safetyItems: ['Safety Glasses'],
            needsPrintedWorksheets: true,
            worksheetCopies: 26
          }
        }
      ],
      // Moved out of the Physics Lab, which slot 0 already occupies this period.
      [reservationKey('monday', 3, 'lab-4')]: [
        {
          id: 'res-5',
          day: 'monday',
          period: 3,
          labId: 'lab-4',
          slotIndex: 1,
          teacher: 'Sultan Al-Mansoor',
          className: '6B',
          subject: 'Circuits & Electricity',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Ohm\'s Law & Series/Parallel Circuits',
            materialsNeeded: '1. DC Variable Power Supplies 0-12V (x8)\n2. Digital Multimeters (Ammeters & Voltmeters) (x16)\n3. Resistors (10Ω, 47Ω, 100Ω) (x24)\n4. Connecting Leads with Crocodile Clips (x50)\n5. Circuit Switches & Rheostats (x8)',
            numberOfGroups: 4,
            needsTechSupport: true,
            safetyItems: ['Safety Glasses'],
            techNotes: 'Verify multimeter fuses before lesson.',
            needsPrintedWorksheets: true,
            worksheetCopies: 24
          }
        }
      ],
      [reservationKey('tuesday', 2, 'lab-4')]: [
        {
          id: 'res-6',
          day: 'tuesday',
          period: 2,
          labId: 'lab-4',
          slotIndex: 0,
          teacher: 'Tariq Al-Zahrani',
          className: '5B',
          subject: 'Density & Measurement',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Measuring Density of Irregular Solids',
            materialsNeeded: '1. Electronic Digital Balances (±0.01g) (x6)\n2. Graduated Cylinders 100mL & 250mL (x12)\n3. Irregular Metal Samples (Copper, Aluminum, Lead) (x18)\n4. Water Beakers 500mL (x12)\n5. Vernier Calipers & Micrometers (x6)',
            numberOfGroups: 6,
            needsTechSupport: false,
            safetyItems: ['Safety Glasses'],
            needsPrintedWorksheets: true,
            worksheetCopies: 25
          }
        }
      ]
    },
    history: []
  },
  girls: {
    name: SCHOOL_LABEL.girls,
    themeColor: 'brand-violet',
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
      [reservationKey('sunday', 1, 'lab-2')]: [
        {
          id: 'res-g1',
          day: 'sunday',
          period: 1,
          labId: 'lab-2',
          slotIndex: 0,
          teacher: 'Noura Al-Shammari',
          className: '4G1',
          subject: 'Plant Biology Observation',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Stomata Count & Plant Transpiration',
            materialsNeeded: '1. Fresh Plant Leaves (Spinach & Hibiscus)\n2. Clear Nail Polish & Transparent Tape\n3. Compound Microscopes (x10)\n4. Microscope Slides & Coverslips (x30)\n5. Forceps & Scissors',
            numberOfGroups: 5,
            needsTechSupport: true,
            safetyItems: ['Safety Goggles', 'Lab Coat'],
            needsPrintedWorksheets: true,
            worksheetCopies: 24
          }
        }
      ],
      // Moved out of the Biology Lab, which slot 0 already occupies this period.
      [reservationKey('sunday', 1, 'lab-4')]: [
        {
          id: 'res-g2',
          day: 'sunday',
          period: 1,
          labId: 'lab-4',
          slotIndex: 1,
          teacher: 'Sara Al-Mutairi',
          className: '4G2',
          subject: 'Photosynthesis Rate',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Measuring Photosynthesis in Elodea Pondweed',
            materialsNeeded: '1. Fresh Elodea/Cabomba Pondweed sprigs (x10)\n2. Sodium Bicarbonate Solution 1% (1L)\n3. Boiling Tubes & Test Tube Racks (x10)\n4. Desk Lamps with 60W bulbs (x10)\n5. Meter Rulers & Timers (x10)',
            numberOfGroups: 5,
            needsTechSupport: false,
            safetyItems: ['Safety Goggles'],
            needsPrintedWorksheets: true,
            worksheetCopies: 22
          }
        }
      ],
      [reservationKey('wednesday', 4, 'lab-5')]: [
        {
          id: 'res-g3',
          day: 'wednesday',
          period: 4,
          labId: 'lab-5',
          slotIndex: 0,
          teacher: 'Fatima Al-Zahrani',
          className: '6G1',
          subject: 'States of Matter',
          createdAt: new Date().toISOString(),
          experimentDetails: {
            experimentName: 'Phase Changes & Heating Curve of Water',
            materialsNeeded: '1. Ice Cubes (1kg in Ice Chest)\n2. Electric Heating Plates 500W (x6)\n3. Beakers 250mL (x6)\n4. Digital Temperature Probes / Thermometers (x6)\n5. Stopwatch Timers (x6)',
            numberOfGroups: 6,
            needsTechSupport: true,
            safetyItems: ['Heat Resistant Gloves', 'Safety Goggles'],
            techNotes: 'Fill ice chest at 10:00 AM before Period 4.',
            needsPrintedWorksheets: true,
            worksheetCopies: 27
          }
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
