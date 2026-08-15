# Brand assets

Served as-is at `/brand/…`. Source of truth for how these are used:
`src/components/BrandLogo.tsx` (logo) and `src/index.css` (fonts).

## What is here

| File | What it is | Used by |
| --- | --- | --- |
| `logo-horizontal-reversed.png` | Electric Green + white lockup, 1015×192 | app header (Kingdom Green bar) |
| `logo-vertical-dark.png` | Electric Green + Kingdom Green lockup, 662×568 | section picker, printed requisition form |
| `fonts/AdelleSansARA-Regular.woff2` | Adelle Sans ARA, weight 400 | all body copy |

Provenance, so these can be re-derived or replaced with better originals:

- The reversed logo is the file the school's own site serves in its navigation
  (`rsg.edu.sa/RSAlMalqa/wp-content/uploads/sites/4/2025/02/Al-Malqa-logo-2.png`).
  Its two colours measure `#00d47d` and `#ffffff` — exactly the brand book's
  Electric Green and White.
- The dark logo was rendered at 600 dpi from the running header of the brand
  book PDF in the repo root and trimmed, with the white background made
  transparent. Its two colours measure `#00d37c` and `#006066`, i.e. Electric
  Green and Kingdom Green to within PDF colour-conversion rounding. **Nothing
  about the mark itself was altered** — background removal only, since p.2
  forbids recolouring.
- The font is the file the school's site serves
  (`…/2025/01/Adelle-Sans-ARA-Regular.woff2`), renamed to the convention the
  `@font-face` rules expect.

## What is still missing

**Five of the six font weights.** The brand book (p.4) calls for Light,
Regular, SemiBold, Bold, ExtraBold and Heavy, mapped as: Light/Regular for body
copy, SemiBold/Bold for emphasis, ExtraBold/Heavy for titles. Only Regular is
present, so **every bold and heading in the app is currently a browser-
synthesised faux bold** rather than the real cut. That is the one remaining
typography deviation. Fix it by adding, into `fonts/`:

```
AdelleSansARA-Light.woff2       (300)
AdelleSansARA-SemiBold.woff2    (600)
AdelleSansARA-Bold.woff2        (700)
AdelleSansARA-ExtraBold.woff2   (800)
AdelleSansARA-Heavy.woff2       (900)
```

They are on the OneDrive linked from **page 7** of the brand book, section 7
"Download Files / تنزيل الملفات". No code change is needed — the `@font-face`
rules already reference these exact names, and each will start resolving the
moment the file appears.

**Vector logos.** Both files here are raster. If the OneDrive has SVG or EPS
versions, prefer them (sharper in print, much smaller) and update the paths in
`src/components/BrandLogo.tsx`.

**A horizontal dark lockup and a vertical reversed one.** We have one tone per
orientation, which happens to cover every surface the app currently has. A new
dark-background surface needing the vertical lockup, or a light-background one
needing the horizontal, would need the matching file — do not recolour an
existing one to fill the gap.

## Checking it worked

```bash
npm run dev
```

- Section picker shows the dark vertical lockup above "Science Lab Scheduler".
- Header (≥640px) shows the reversed horizontal lockup on the green bar.
- The printed requisition form shows the dark lockup above the bilingual name.
- In devtools console, `document.fonts.check('700 16px "Adelle Sans ARA"')`
  returns `true` once the Bold file is in place (it returns `false` today).
