import React, { useState } from 'react';
import { SCHOOL_NAME, SCHOOL_NAME_AR } from '../brand';

/**
 * The Riyadh Schools Al Malqa logo.
 *
 * Brand book p.2 ("Logo / الشعار") governs this component:
 *
 *   - It must be the **Riyadh Schools Al Malqa** logo, never the Riyadh
 *     Schools Group ("RSG") one. The two are different marks and the group
 *     mark is explicitly wrong for a single school.
 *   - Two approved lockups exist: horizontal and vertical. Nothing else.
 *   - The listed prohibitions are: do not recolour it, do not outline it, do
 *     not add a shadow or any other effect, do not distort or stretch it, do
 *     not rotate it, do not add elements to it, and do not reverse the
 *     positions of the icon and the wordmark.
 *
 * Those rules are why this renders a plain <img> of an untouched source file
 * and only ever accepts a *height* from the caller. Width stays `auto`, so a
 * caller cannot stretch the mark by handing it a bad box, and no filter,
 * shadow or transform is applied. If you need it bigger, give it a taller
 * height -- do not wrap it in something that scales it non-uniformly.
 *
 * ## Tone, not just orientation
 *
 * The identity ships the mark in two tones and picking the wrong one is the
 * easiest way to make it illegible:
 *
 *   - `reversed` -- Electric Green + white. For dark grounds (our Kingdom
 *     Green header). This is the file the school's own site serves in its nav.
 *   - `dark` -- Electric Green + Kingdom Green. For white and light grounds
 *     (the section picker, the printed requisition form).
 *
 * Recolouring one to stand in for the other is exactly what p.2 forbids, so
 * the two are separate files and `tone` selects between them.
 *
 * If a file is missing, this falls back to the school name set as plain text
 * rather than showing a broken image. That fallback is *not* a substitute
 * wordmark -- it is only the name, typed. Do not add a swoosh, a box or any
 * other device to it in an attempt to approximate the real mark.
 */
export type BrandLogoTone = 'dark' | 'reversed';

const SOURCES: Record<BrandLogoTone, string> = {
  reversed: '/brand/logo-horizontal-reversed.png',
  dark: '/brand/logo-vertical-dark.png'
};

interface BrandLogoProps {
  /** `dark` for light backgrounds, `reversed` for dark ones. */
  tone?: BrandLogoTone;
  /** Height only -- e.g. `h-9`. Width is always auto; see the note above. */
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ tone = 'dark', className = 'h-9' }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={
          tone === 'reversed'
            ? 'flex flex-col justify-center leading-tight text-white'
            : 'flex flex-col justify-center leading-tight text-brand-kingdom-700'
        }
      >
        <span className="font-extrabold whitespace-nowrap">{SCHOOL_NAME}</span>
        <span className="font-bold whitespace-nowrap" lang="ar" dir="rtl">
          {SCHOOL_NAME_AR}
        </span>
      </span>
    );
  }

  return (
    <img
      src={SOURCES[tone]}
      alt="Riyadh Schools Al Malqa"
      onError={() => setFailed(true)}
      className={`w-auto max-w-full object-contain ${className}`}
    />
  );
};
