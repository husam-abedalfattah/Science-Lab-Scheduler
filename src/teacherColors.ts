/**
 * A stable colour per teacher, so a teacher can pick their own sessions out of
 * the grid at a glance.
 *
 * ## Why there are only four
 *
 * The identity has seven colours, but seven does not survive contact with
 * colour-vision deficiency. Running the full set through a CVD validator, the
 * pairs collapse: Electric Green against Coral separates at ΔE 4.7 under
 * deuteranopia, Aqua against Plum at 4.1, Yellow against Coral at 5.7 — all far
 * below the ΔE 8 floor, and the last pair is below the *normal vision* floor
 * too. Four slots (Aqua, Coral, Dark Violet, Electric Green) is the largest
 * subset that passes, and even that sits in the 6–8 band which is only legal
 * with a secondary encoding.
 *
 * We have that secondary encoding: **the teacher's name is printed on every
 * card**. Colour here is a scanning aid, never the thing that identifies the
 * booking — which is also why cycling past the fourth teacher is acceptable
 * rather than dishonest. Two teachers sharing a hue is a mild inconvenience;
 * two teachers sharing a hue with no name would be a defect.
 *
 * If you need to tell teachers apart with certainty, use the teacher filter in
 * the toolbar — that is what it is for, and it is exact.
 *
 * ## Stability
 *
 * The colour follows the teacher, not their rank in any filtered list. It is
 * keyed off the roster position, and falls back to a hash of the name for a
 * teacher who has since been removed from the roster but still owns bookings.
 * Filtering the grid must never repaint the survivors.
 */

export interface TeacherColor {
  /** Solid mark carrying the identity. Validated categorical step. */
  bar: string;
  /** Card fill -- a tint of the same hue, so the card reads as "booked". */
  bg: string;
  border: string;
  /** Heading ink on `bg`. */
  ink: string;
  /** Small-print ink on `bg`. */
  inkSoft: string;
  /** Swatch + label used in legends and the filter. */
  swatch: string;
  name: string;
}

const PALETTE: TeacherColor[] = [
  {
    name: 'Aqua',
    bar: 'bg-brand-aqua-700',
    bg: 'bg-brand-aqua-50',
    border: 'border-brand-aqua-300',
    ink: 'text-brand-aqua-900',
    inkSoft: 'text-brand-aqua-800',
    swatch: 'bg-brand-aqua-700'
  },
  {
    name: 'Coral',
    bar: 'bg-brand-coral-600',
    bg: 'bg-brand-coral-50',
    border: 'border-brand-coral-300',
    ink: 'text-brand-coral-900',
    inkSoft: 'text-brand-coral-800',
    swatch: 'bg-brand-coral-600'
  },
  {
    name: 'Violet',
    bar: 'bg-brand-violet-600',
    bg: 'bg-brand-violet-50',
    border: 'border-brand-violet-300',
    ink: 'text-brand-violet-900',
    inkSoft: 'text-brand-violet-800',
    swatch: 'bg-brand-violet-600'
  },
  {
    name: 'Green',
    bar: 'bg-brand-green-700',
    bg: 'bg-brand-green-50',
    border: 'border-brand-green-300',
    ink: 'text-brand-green-900',
    inkSoft: 'text-brand-green-800',
    swatch: 'bg-brand-green-700'
  }
];

/** Deterministic, order-independent fallback for an off-roster teacher. */
const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const TEACHER_PALETTE_SIZE = PALETTE.length;

export function colorForTeacher(teacher: string, roster: string[]): TeacherColor {
  const idx = roster.indexOf(teacher);
  const seat = idx >= 0 ? idx : hash(teacher);
  return PALETTE[seat % PALETTE.length];
}
