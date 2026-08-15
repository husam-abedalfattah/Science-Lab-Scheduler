/**
 * Riyadh Schools Al Malqa visual identity -- the text half.
 *
 * Source of truth: "Brief Guide to the Brand Book Use / الدليل المختصر
 * لاستخدام الهوية البصرية", kept in the repo root. The colour and typeface
 * half lives in `src/index.css`; the logo rules live in
 * `src/components/BrandLogo.tsx`.
 *
 * This is deliberately a separate module from `constants.ts`: that one reads
 * `import.meta.env`, and these strings are also pulled in by the offline seed
 * check in `scripts/`, which runs under plain node.
 *
 * Nothing here is a free-text label. Every string is prescribed by the brand
 * book -- if one looks wrong, check the guide before changing it.
 */

/**
 * Approved school name. Printed on the equipment requisition form and shown in
 * the app header.
 *
 * The brand book (p.6, "Slogans / العبارات") makes this exact string
 * mandatory, and the previous value -- 'Riyadh Schools - ALMALQA' -- broke
 * three of its rules at once:
 *   - "Do not use the dash" between the school and the campus name;
 *   - "Al" must be kept and separated from "Malqa" by a space, so 'ALMALQA'
 *     (and 'Almalqa', 'Malqa', 'Malga') are all rejected;
 *   - it must be spelled with a q, never a g.
 *
 * Do not uppercase it when rendering: the identity sets the wordmark in title
 * case, and uppercasing hides the Al / Malqa split the rule is about.
 */
export const SCHOOL_NAME = 'Riyadh Schools Al Malqa';

/** Arabic form of the same name, per the bilingual logo lockup (brand book p.2). */
export const SCHOOL_NAME_AR = 'مدارس الرياض الملقا';

/**
 * Approved school slogan (brand book p.6). Never "We Make Leaders", and never
 * "Generations of Success" / "أجيال النجاح" -- that one belongs to Riyadh
 * Schools Group, not to this school.
 */
export const SCHOOL_SLOGAN = 'We Build Leaders';
export const SCHOOL_SLOGAN_AR = 'نبني القادة';

/**
 * Group affiliation line. Every page of the brand book carries it in the
 * footer band ("إحدى الجهات التابعة لمجموعة مدارس الرياض"), and the school's
 * own site closes with the English form.
 *
 * This states that the school *belongs to* the group. It is not licence to use
 * the group's logo or its "Generations of Success" slogan in place of the
 * school's own -- brand book p.2 and p.6 both forbid that.
 */
export const GROUP_AFFILIATION = 'Part of Riyadh Schools Group';
export const GROUP_AFFILIATION_AR = 'إحدى الجهات التابعة لمجموعة مدارس الرياض';

export const DEPARTMENT_NAME = 'Science Department · Laboratory Services';

/**
 * Approved names for the two schools (brand book p.6).
 *
 * It is "Boys School" and "Girls School" -- the brand book explicitly rejects
 * both "Section" (قسم) and "Branch" (فرع), which is what this app used to say
 * everywhere it addressed a user.
 *
 * `boys` / `girls` stay as the internal keys and the `Section` type name: they
 * are never shown to anyone and renaming them would churn the Firestore
 * document ids for no benefit. Render through this map instead of writing the
 * label inline, so the wording only has to be right in one place.
 */
export const SCHOOL_LABEL: Record<'boys' | 'girls', string> = {
  boys: 'Boys School',
  girls: 'Girls School'
};

export const SCHOOL_LABEL_AR: Record<'boys' | 'girls', string> = {
  boys: 'مدرسة البنين',
  girls: 'مدرسة البنات'
};
