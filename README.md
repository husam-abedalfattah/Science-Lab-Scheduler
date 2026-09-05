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
- A stockroom whose contents anyone can search but only an administrator
  can change, with a **modification history** naming who added, edited,
  deleted, imported or exported what.
- **Administrator accounts managed in the app** — one password per person,
  so the history can name them.

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
cp .env.example .env.local   # then set the admin passwords
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`.

## Who may change things

Reading is open to everyone: the schedule, the stockroom and the modification
history all load without a password. Changing things is not. These need one:

| Action | Gated |
| --- | --- |
| Add, edit or delete a material | yes |
| Import a stock list from Excel | yes |
| Download the Excel stock template | yes |
| Cancel a booking | yes |
| Add, edit or remove an administrator | yes |
| The admin panel (rosters, locks, week rollover) | yes |
| Search the stockroom, read the schedule, read the history | no |

The prompt appears when the button is pressed, naming the specific thing it is
about to do — not once at the door. Every gated control stays pressable, so the
way in is always visible rather than being a greyed-out button with no
explanation.

### One password per person, because the log has to name someone

There is no per-user sign-in — Firebase auth is anonymous and the lab machine is
shared — so **the password is the identity**. Whichever password unlocks a
session is the name stamped on every change made in it.

**Add people in the app:** Admin panel → **Administrators** → *Add
administrator*. Give a name (what the history shows), optionally a school, and a
password. From then on that person signs in with their own password and their
changes are recorded under their own name. You can rename them, change their
password and remove them from the same tab; every one of those is itself
recorded in the history.

The panel refuses two accounts with the same password, and two with the same
name — both would collapse two people into one entry in the log, which is the
one thing the feature exists to prevent. It also refuses to delete the last
account.

**Passwords are never stored.** What goes into Firestore is PBKDF2-SHA256 over a
per-account random salt (`src/utils/adminAuth.ts`, covered by
`npm run verify:admin`). A forgotten password cannot be recovered from the app
or from the database — only replaced.

#### The built-in accounts

`.env.local` still defines up to three accounts that are compiled into the site
and always available:

| Variable | Who | Name in the history |
| --- | --- | --- |
| `VITE_ADMIN_PASSWORD` | the administrator | `VITE_ADMIN_NAME` |
| `VITE_ADMIN_PASSWORD_BOYS` | Boys School lab technician | `VITE_ADMIN_NAME_BOYS` |
| `VITE_ADMIN_PASSWORD_GIRLS` | Girls School lab technician | `VITE_ADMIN_NAME_GIRLS` |

These are the floor, not the roster. They cover the two situations nothing else
can: a brand-new installation with no accounts yet, and a school that has
forgotten the only password it created. Set `VITE_ADMIN_PASSWORD`, use it to
create real accounts in the panel, then keep it somewhere safe. They are listed
in the Administrators tab under *From configuration* so the tab is the whole
truth about who can sign in, and they are matched **after** the stored accounts
so a real account always wins.

Leaving a variable unset means that account does not exist; it never falls back
to a shared or guessable default. If none is set, `VITE_ADMIN_PASSWORD` falls
back to the historical `admin123` and warns in the dev console — change it.

All accounts carry the same rights. The school someone belongs to is recorded on
their changes for context but is **not** enforced — the boys' technician can
edit the girls' stock. To change that, filter on `account.section` inside
`requireAdmin` in `src/App.tsx`; nothing else depends on it staying open.

### The modification history

Open it from the **History** button in the stockroom. It shows, newest first,
who did what and when, with a field-by-field diff for edits
(`Quantity 500 → 700`) and enough of a deleted item to still make sense once
the item is gone.

It covers the stockroom, cancelled bookings, and changes to the administrator
accounts themselves. It lives in the `audits` collection and is **append-only**: `firestore.rules`
allows `create` and denies `update` and `delete`, so an entry cannot be
rewritten or quietly removed from inside the app by the person it names. It
grows without bound on purpose; clients read the newest `MAX_AUDIT_ENTRIES`
(`src/constants.ts`) rather than all of it.

Writing an entry can never fail the change it describes — `recordAudit`
swallows its own errors, because a delete that genuinely worked must not be
reported as failed just because the bookkeeping behind it did not land. The
cost of that choice is that a dropped entry is a silent gap in the record.

## Importing a stock list

An import **never deletes and never overwrites.** Records the sheet does not
mention are left exactly as they are.

A sheet row merges into a record already in the stockroom only when the school,
the lab and *every other field* match — name, code, category, location, unit,
minimum, hazard, expiry, supplier, notes. When it matches, the sheet's quantity
is **added to** what is already there, so importing the same 200-unit delivery
note twice leaves 400 units. When it differs anywhere at all, it becomes a new
record instead: the same reagent in Cabinet B and in Cabinet C is two entries,
because "where is it" is the question the table exists to answer.

The trade is deliberate. A typo in the spreadsheet produces a visible duplicate
that can be merged by hand, rather than silently overwriting the good record —
a duplicate is a problem you can see.

Case and stray whitespace are treated as typing, not identity, and repeated
rows *within* one sheet fold into a single record with their quantities summed.
The preview screen states exactly how many lines will be created and how many
will be topped up before anything is written, computed by the same
`planMaterialImport` the writer uses so the two cannot disagree.
`npm run verify:import` covers the rule.

## Before deploying — required security setup

The app ships with a public Firebase web API key (normal for Firebase), so the
database is only as protected as its rules. Two steps, in this order:

**1. Enable anonymous authentication**

Firebase console → Authentication → Sign-in method → **Anonymous** → Enable.

The app signs in anonymously on boot (`src/firebase.ts`). If this is not
enabled, sign-in fails and the app continues unauthenticated, which still works
against permissive rules — so enabling it first cannot take the app down.

The order matters. Doing step 2 first takes the app down: the rules require a
signed-in user for *reads* too, and without anonymous auth there is no signed-in
user, so the schedule stops loading for everyone.

**2. Deploy the Firestore rules**

The Firebase CLI is not a dependency of this project — install it first:

```bash
npm install -g firebase-tools     # or: npx firebase-tools <command>
firebase login
firebase deploy --only firestore:rules
```

`firebase.json` and `.firebaserc` in the repo root point the CLI at this project
and, critically, at the right database. **This project does not use the
`(default)` Firestore database** — it uses a named one
(`ai-studio-sciencelabreserv-…`, see `firebase-applet-config.json`). A deploy
that omits the `database` key reports success and changes nothing, because it
writes to `(default)`, which the app never reads.

Check the deploy landed: the CLI prints the database name, and the app's
stockroom should populate on reload instead of showing "The stockroom could not
be loaded".

`firestore.rules` requires a signed-in user, validates every reservation's and
every material's shape, caps inline attachment size, makes `audits` append-only,
refuses an administrator record that does not carry a base64-shaped hash and
salt, and denies everything outside the five known collections.

**What this does and does not give you.** Anonymous auth stops drive-by writes
from anyone who reads the API key out of the bundle. It does *not* distinguish a
teacher from an administrator. The password gates described above are real gates
in the browser — they stop the accident, and they produce an honest record of who
did what — but Firestore cannot see them: every client is the same anonymous
user, so no rule can tell the lab technician from a pupil with devtools open.
Treat the history as accountability, not as proof.

Closing this properly is one change, not several. Switch `src/firebase.ts` to
Google sign-in restricted to the school domain, create an `admins/{uid}` document
for each of the three password holders, then replace `isSignedIn()` with
`isAdmin()` on `materials` create/update/delete and on `reservations` delete. The
`isAdmin()` helper in `firestore.rules` already does the lookup.

## Troubleshooting

**"The modification history could not be loaded" / "The administrator list could
not be loaded."**

The `audits` and `adminAccounts` collections are newer than the rules deployed to
this project, so they match no rule and fall through to the deny-all at the
bottom of the file. Redeploy: `firebase deploy --only firestore:rules`.

Until you do, the app still works: changes go through but are not recorded, and
sign-in falls back to the built-in `.env.local` passwords because no stored
accounts can be read. Both are worth fixing promptly — an unrecorded change is a
permanent gap in the history.

**"The stockroom could not be loaded" / the Excel import fails on the last step.**

Firestore is refusing the `materials` collection — reads *and* writes. Both
setup steps above are outstanding on this project, and both are needed:

- Anonymous sign-in is disabled, so the client has no identity at all
  (`auth/admin-restricted-operation` in the console on boot).
- The *deployed* rules predate the materials feature, so `materials` matches no
  rule and falls through to the deny-all at the bottom of the file. The
  `sections` collection still writes fine, which is why only the stockroom
  looks broken.

Enabling anonymous auth alone will not fix it, because the deployed rules do
not know the collection exists. Do step 1, then step 2. Nothing in the app can
work around this — the browser genuinely has no permission, and the stockroom
now says so rather than rendering an empty list.

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
- **The password check happens in the browser.** Accounts created in the panel
  store only a salted hash, so the database leaking does not leak passwords —
  but the gate is still a convenience lock and an accountability record, not a
  security boundary. See the deployment section above for what it would take to
  make it real.
- **No automated tests** for the React components. The pure logic is covered:
  `npm run verify:import` exercises the spreadsheet parser and the re-import
  merge rule. `src/utils/conflictDetector.ts` is the natural place to go next.
