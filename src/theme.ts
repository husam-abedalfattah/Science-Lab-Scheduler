import { Section } from './types';

/**
 * Per-school theming.
 *
 * Each school owns one colour from the identity (brand book p.3): the Boys
 * School is Electric Green, the Girls School is Dark Violet. Switching school
 * repaints the whole app -- page, header bar, primary action, grid headers --
 * so it is never ambiguous which schedule you are looking at. That ambiguity
 * mattered: the two schools have separate rosters and separate reservations,
 * and booking into the wrong one is silent and easy.
 *
 * Every value is a complete Tailwind class string on purpose. Tailwind scans
 * source text for literal class names, so anything assembled at runtime
 * (`bg-brand-${colour}-700`) is never emitted into the stylesheet and silently
 * renders unstyled. Do not "simplify" these into template literals.
 *
 * Contrast was checked against the ramps in index.css; the figures in the
 * comments are the measured ratios, so if you change a step, re-measure.
 */
export interface SchoolTheme {
  /**
   * Page background behind all content.
   *
   * Deliberately a real tint rather than a near-white wash. This is the app's
   * main defence against a teacher booking into the wrong school: the two
   * schedules are otherwise identical in layout, and a reservation gives no
   * hint afterwards about which school it landed in.
   */
  page: string;
  /** Diamond-motif texture class, tinted to this school. Pairs with `page`. */
  texture: string;
  /** Sticky header bar. Carries white text. */
  header: string;
  /** Secondary text on the header bar. */
  headerMuted: string;
  /** Primary call-to-action pill on the header bar. */
  pill: string;
  /** Selected school tab on the header bar. */
  tabActive: string;
  /** Accent for headings and icons on white surfaces. */
  accentText: string;
  /** Tinted fill for grid headers and summary strips on white. */
  accentSoft: string;
  /**
   * Ground for the weekly matrix.
   *
   * A soft wash of the school's colour rather than plain white, so the table
   * itself carries the school identity instead of being a neutral sheet that
   * happens to sit inside a coloured page. Kept very pale: booking cards and
   * the free-slot chips sit on top of it and have to stay separable.
   */
  tableGround: string;
  /** Border to match `accentSoft`. */
  accentBorder: string;
  /** Solid accent block (icon tiles) with white text. */
  accentSolid: string;
  /** Focus ring. */
  ring: string;
  /** Text selection highlight. */
  selection: string;
}

const BOYS: SchoolTheme = {
  page: 'bg-brand-green-200',
  texture: 'brand-texture brand-texture-boys',
  header: 'bg-brand-green-900', //           white 6.94:1
  headerMuted: 'text-brand-green-300', //    on header 5.38:1
  pill: 'bg-brand-green-500 hover:bg-brand-green-400 text-brand-kingdom-950', // 8.45:1
  tabActive: 'bg-brand-green-500 text-brand-kingdom-950',
  accentText: 'text-brand-green-900',
  accentSoft: 'bg-brand-green-50',
  tableGround: 'bg-brand-green-50',
  accentBorder: 'border-brand-green-200',
  accentSolid: 'bg-brand-green-800 text-white', // 5.18:1
  ring: 'focus:ring-brand-green-500',
  selection: 'selection:bg-brand-green-800 selection:text-white'
};

const GIRLS: SchoolTheme = {
  page: 'bg-brand-violet-200',
  texture: 'brand-texture brand-texture-girls',
  header: 'bg-brand-violet-800', //          white 9.89:1
  headerMuted: 'text-brand-plum-200', //     on header 6.69:1
  pill: 'bg-brand-plum-300 hover:bg-brand-plum-200 text-brand-violet-950', // 8.98:1
  tabActive: 'bg-brand-plum-300 text-brand-violet-950',
  accentText: 'text-brand-violet-800',
  accentSoft: 'bg-brand-violet-50',
  tableGround: 'bg-brand-violet-50',
  accentBorder: 'border-brand-violet-200',
  accentSolid: 'bg-brand-violet-600 text-white', // 5.54:1
  ring: 'focus:ring-brand-violet-500',
  selection: 'selection:bg-brand-violet-600 selection:text-white'
};

export const SCHOOL_THEME: Record<Section, SchoolTheme> = {
  boys: BOYS,
  girls: GIRLS
};

export const themeFor = (section: Section): SchoolTheme => SCHOOL_THEME[section];
