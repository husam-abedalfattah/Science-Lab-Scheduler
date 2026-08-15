# Science Lab Reservation Scheduler

Weekly science lab booking for a two-section school. Teachers reserve lab slots,
the system prevents double-bookings and technician overload, and the lab
technician gets printable equipment requisition forms.

- 5 days × 7 periods, up to **3 concurrent labs per period** and **5 active
  periods per technician per day** (see `src/constants.ts` — change the rules
  there, not in the components).
- Real-time sync across every open browser via Firestore.
- Conflict detection for teacher clashes, class clashes, room clashes and
  technician overload, including cross-section warnings.
- Period locking with a technician-visible reason, plus a section-wide booking
  lock.
- CSV export and printable PDF requisition forms.

## Visual identity

The app follows *Brief Guide to the Brand Book Use / الدليل المختصر لاستخدام
الهوية البصرية* (PDF in the repo root). Three places hold the rules — change
them there, never inline in a component:

| What | Where |
| --- | --- |
| Colours and the Adelle Sans ARA font stack | `src/index.css` (`@theme`) |
| School name, school labels, slogan | `src/brand.ts` |
| Logo usage rules | `src/components/BrandLogo.tsx` |

Two constraints worth knowing before you touch the UI:

- **Only the seven brand colours exist.** They are exposed as
  `brand-{kingdom,green,coral,violet,yellow,plum,aqua}-{50…950}`. The stock
  Tailwind palette (indigo, emerald, rose, …) is no longer used anywhere except
  `slate`, which is kept as the neutral for text and borders. Electric Green and
  Coral are much lighter than the emerald/rose they replaced, so white text
  needs `-800` and `-700` respectively rather than `-600`.
- **The wording is prescribed.** It is "Riyadh Schools Al Malqa" (no dash, `Al`
  kept, space before `Malqa`, spelled with a q) and "Boys School" / "Girls
  School" — never "Section" or "Branch". `boys` / `girls` remain the internal
  keys; render user-facing text through `SCHOOL_LABEL`.

The chrome (header, and the footer band on the printed form) is Kingdom Green
with white type, mirroring the school's own site at
<https://rsg.edu.sa/RSAlMalqa/>; white surfaces are reserved for content. The
primary action is an Electric Green pill, as their "Apply Now" is.

**Assets:** both logo lockups and Adelle Sans ARA Regular are in
`public/brand/`. The other five font weights are still missing, so headings
currently render as synthesised faux bold — see `public/brand/README.md` for
what to add and where to get it.

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
cp .env.example .env.local   # then set VITE_ADMIN_PASSWORD
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`.

## Before deploying — required security setup

The app ships with a public Firebase web API key (normal for Firebase), so the
database is only as protected as its rules. Two steps, in this order:

**1. Enable anonymous authentication**

Firebase console → Authentication → Sign-in method → **Anonymous** → Enable.

The app signs in anonymously on boot (`src/firebase.ts`). If this is not
enabled, sign-in fails and the app continues unauthenticated, which still works
against permissive rules — so enabling it first cannot take the app down.

**2. Deploy the Firestore rules**

```bash
firebase deploy --only firestore:rules
```

`firestore.rules` requires a signed-in user, validates every reservation's
shape, caps inline attachment size and denies everything outside the two known
collections.

**What this does and does not give you.** Anonymous auth stops drive-by writes
from anyone who reads the API key out of the bundle. It does *not* distinguish a
teacher from an administrator — `VITE_ADMIN_PASSWORD` gates the admin UI in the
browser only, and anyone can read it out of the bundle. For real admin
enforcement, switch to Google sign-in restricted to the school domain, create an
`admins/{uid}` document per administrator, and tighten the `isAdmin()` helper
already stubbed in `firestore.rules`.

## Known limitations

- **Attachments are inlined** into the reservation document as data URIs, so
  they are capped at 600 KB (`MAX_ATTACHMENT_BYTES`) and every client downloads
  every attachment on each sync. Moving them to Firebase Storage removes both
  problems.
- **The booking cutoff is recorded but not enforced.** The admin panel says so.
- **The UI is English-only.** Only the school name is bilingual. RTL/Arabic for
  the rest of the interface is the largest outstanding usability gap for the
  intended users, and the brand book's Arabic wording (`SCHOOL_LABEL_AR` in
  `src/brand.ts`) is already staged for it.
- **No automated tests.** `src/utils/conflictDetector.ts` is pure and is the
  natural place to start.
