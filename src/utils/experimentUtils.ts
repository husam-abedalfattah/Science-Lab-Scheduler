import { Reservation, ExperimentDetails } from '../types';

export function getEffectiveExperimentDetails(res: Reservation): ExperimentDetails {
  if (res.experimentDetails && res.experimentDetails.materialsNeeded && res.experimentDetails.materialsNeeded.trim().length > 0) {
    return {
      experimentName: res.experimentDetails.experimentName || res.subject || `Practical Lab - Class ${res.className}`,
      materialsNeeded: res.experimentDetails.materialsNeeded,
      numberOfGroups: res.experimentDetails.numberOfGroups || 4,
      needsTechSupport: res.experimentDetails.needsTechSupport ?? true,
      safetyItems: res.experimentDetails.safetyItems || ['Safety Goggles', 'Lab Coat'],
      techNotes: res.experimentDetails.techNotes || '',
      needsPrintedWorksheets: res.experimentDetails.needsPrintedWorksheets ?? true,
      worksheetCopies: res.experimentDetails.worksheetCopies || 25,
      fileName: res.experimentDetails.fileName || '',
      fileUrl: res.experimentDetails.fileUrl || ''
    };
  }

  // Derived fallback based on subject or className
  const subj = (res.subject || res.experimentDetails?.experimentName || '').toLowerCase();

  if (subj.includes('acid') || subj.includes('titration') || subj.includes('neutralization')) {
    return {
      experimentName: res.subject || 'Acid-Base Neutralization & Titration',
      materialsNeeded: '1. Hydrochloric Acid Solution (HCl 0.1M, 500mL)\n2. Sodium Hydroxide (NaOH 0.1M, 500mL)\n3. Phenolphthalein indicator bottle (50mL)\n4. Burettes (x10) & Retort Stands (x10)\n5. Erlenmeyer Flasks 250mL (x20)\n6. Volumetric Pipettes 25mL (x10)',
      numberOfGroups: 5,
      needsTechSupport: true,
      safetyItems: ['Safety Goggles', 'Lab Coat', 'Nitrile Gloves'],
      techNotes: 'Prepare fresh 0.1M NaOH solution prior to lesson.',
      needsPrintedWorksheets: true,
      worksheetCopies: 25,
      fileName: res.experimentDetails?.fileName || '',
      fileUrl: res.experimentDetails?.fileUrl || ''
    };
  }

  if (subj.includes('rate') || subj.includes('reaction') || subj.includes('chemistry')) {
    return {
      experimentName: res.subject || 'Factors Affecting Reaction Rates',
      materialsNeeded: '1. Sodium Thiosulfate 0.1M (1L)\n2. Hydrochloric Acid 2M (500mL)\n3. Stopwatches (x8)\n4. Conical Flasks 100mL with marked X paper (x8)\n5. Thermometers & Graduated Cylinders 50mL (x8)',
      numberOfGroups: 4,
      needsTechSupport: true,
      safetyItems: ['Safety Goggles', 'Lab Coat'],
      techNotes: 'Set up water baths at 40°C and 60°C.',
      needsPrintedWorksheets: true,
      worksheetCopies: 22,
      fileName: res.experimentDetails?.fileName || '',
      fileUrl: res.experimentDetails?.fileUrl || ''
    };
  }

  if (subj.includes('microscope') || subj.includes('cell') || subj.includes('epidermis')) {
    return {
      experimentName: res.subject || 'Onion Epidermis & Cheek Cell Microscopy',
      materialsNeeded: '1. Compound Light Microscopes (x12)\n2. Glass Microscope Slides & Coverslips (x50)\n3. Methylene Blue Stain & Iodine Solution\n4. Dissecting Needles & Forceps\n5. Fresh Onion Bulbs & Cotton Swabs',
      numberOfGroups: 6,
      needsTechSupport: true,
      safetyItems: ['Safety Goggles', 'Nitrile Gloves'],
      techNotes: 'Verify microscope light bulbs beforehand.',
      needsPrintedWorksheets: true,
      worksheetCopies: 28,
      fileName: res.experimentDetails?.fileName || '',
      fileUrl: res.experimentDetails?.fileUrl || ''
    };
  }

  if (subj.includes('optic') || subj.includes('prism') || subj.includes('refraction') || subj.includes('light')) {
    return {
      experimentName: res.subject || 'Refraction of Light & Prism Dispersion',
      materialsNeeded: '1. Glass Prisms & Glass Rectangular Blocks (x10)\n2. Ray Boxes with Single/Triple Slits (x10)\n3. Power Supplies 12V (x10)\n4. Protractors & White Drawing Sheets (x30)\n5. Convex & Concave Lenses (f=10cm, 15cm)',
      numberOfGroups: 5,
      needsTechSupport: false,
      safetyItems: ['Safety Glasses'],
      techNotes: 'Darken lab blinds for optimal ray box visibility.',
      needsPrintedWorksheets: true,
      worksheetCopies: 26,
      fileName: res.experimentDetails?.fileName || '',
      fileUrl: res.experimentDetails?.fileUrl || ''
    };
  }

  if (subj.includes('circuit') || subj.includes('electric') || subj.includes('ohm')) {
    return {
      experimentName: res.subject || "Ohm's Law & Series/Parallel Circuits",
      materialsNeeded: '1. DC Variable Power Supplies 0-12V (x8)\n2. Digital Multimeters (Ammeters & Voltmeters) (x16)\n3. Resistors (10Ω, 47Ω, 100Ω) (x24)\n4. Connecting Leads with Crocodile Clips (x50)\n5. Circuit Switches & Rheostats (x8)',
      numberOfGroups: 4,
      needsTechSupport: true,
      safetyItems: ['Safety Glasses'],
      techNotes: 'Check multimeter battery levels and fuses.',
      needsPrintedWorksheets: true,
      worksheetCopies: 24,
      fileName: res.experimentDetails?.fileName || '',
      fileUrl: res.experimentDetails?.fileUrl || ''
    };
  }

  if (subj.includes('density') || subj.includes('measurement')) {
    return {
      experimentName: res.subject || 'Measuring Density of Irregular Solids',
      materialsNeeded: '1. Electronic Digital Balances (±0.01g) (x6)\n2. Graduated Cylinders 100mL & 250mL (x12)\n3. Irregular Metal Samples (Copper, Aluminum, Lead) (x18)\n4. Water Beakers 500mL (x12)\n5. Vernier Calipers & Micrometers (x6)',
      numberOfGroups: 6,
      needsTechSupport: false,
      safetyItems: ['Safety Glasses'],
      techNotes: '',
      needsPrintedWorksheets: true,
      worksheetCopies: 25,
      fileName: res.experimentDetails?.fileName || '',
      fileUrl: res.experimentDetails?.fileUrl || ''
    };
  }

  if (subj.includes('plant') || subj.includes('stomata') || subj.includes('photosynthesis')) {
    return {
      experimentName: res.subject || 'Photosynthesis Rate & Stomata Observation',
      materialsNeeded: '1. Fresh Elodea/Cabomba Pondweed sprigs (x10)\n2. Sodium Bicarbonate Solution 1% (1L)\n3. Boiling Tubes & Test Tube Racks (x10)\n4. Desk Lamps with 60W bulbs (x10)\n5. Meter Rulers & Timers (x10)',
      numberOfGroups: 5,
      needsTechSupport: true,
      safetyItems: ['Safety Goggles', 'Lab Coat'],
      techNotes: 'Prepare fresh pondweed underwater to prevent air bubbles.',
      needsPrintedWorksheets: true,
      worksheetCopies: 24,
      fileName: res.experimentDetails?.fileName || '',
      fileUrl: res.experimentDetails?.fileUrl || ''
    };
  }

  if (subj.includes('state') || subj.includes('matter') || subj.includes('heat') || subj.includes('water')) {
    return {
      experimentName: res.subject || 'Phase Changes & Heating Curve of Water',
      materialsNeeded: '1. Ice Cubes (1kg in Ice Chest)\n2. Electric Heating Plates 500W (x6)\n3. Beakers 250mL (x6)\n4. Digital Temperature Probes / Thermometers (x6)\n5. Stopwatch Timers (x6)',
      numberOfGroups: 6,
      needsTechSupport: true,
      safetyItems: ['Heat Resistant Gloves', 'Safety Goggles'],
      techNotes: 'Fill ice chest prior to lesson.',
      needsPrintedWorksheets: true,
      worksheetCopies: 27,
      fileName: res.experimentDetails?.fileName || '',
      fileUrl: res.experimentDetails?.fileUrl || ''
    };
  }

  return {
    experimentName: res.subject || `Practical Science Experiment - Class ${res.className}`,
    materialsNeeded: `1. Standard Glassware Set (Beakers 250mL x10, Flasks 250mL x10)\n2. Graduated Cylinders 50mL & 100mL (x10)\n3. Digital Electronic Balances (x5)\n4. Test Tubes, Racks & Test Tube Pegs (x20)\n5. Wash Bottles with Distilled Water (x10)\n6. Safety Goggles & Lab Coats`,
    numberOfGroups: 4,
    needsTechSupport: true,
    safetyItems: ['Safety Goggles', 'Lab Coat'],
    techNotes: 'Standard lab setup requested.',
    needsPrintedWorksheets: true,
    worksheetCopies: 25,
    fileName: res.experimentDetails?.fileName || '',
    fileUrl: res.experimentDetails?.fileUrl || ''
  };
}
