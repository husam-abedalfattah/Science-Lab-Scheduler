import { Lab, Material, MaterialCategory } from '../types';
import { MATERIAL_CATEGORIES } from '../constants';

/**
 * Turning a spreadsheet into inventory rows.
 *
 * Kept out of the component and free of any Firestore or React import so the
 * mapping and validation can be reasoned about -- and tested -- on plain
 * arrays. The component owns the file picking and the writes; this owns the
 * "what does this cell actually mean" problem, which is where imports go wrong.
 */

export type MaterialField =
  | 'name'
  | 'code'
  | 'category'
  | 'lab'
  | 'location'
  | 'quantity'
  | 'unit'
  | 'minQuantity'
  | 'hazard'
  | 'expiryDate'
  | 'supplier'
  | 'notes';

export const MATERIAL_FIELDS: {
  id: MaterialField;
  label: string;
  required: boolean;
  hint?: string;
}[] = [
  { id: 'name', label: 'Name', required: true },
  { id: 'lab', label: 'Lab', required: true, hint: 'Matched to a lab by name or code' },
  { id: 'location', label: 'Location', required: true, hint: 'e.g. Cabinet B, Shelf 3' },
  { id: 'code', label: 'Item code', required: false, hint: 'Used to match on re-import' },
  { id: 'category', label: 'Category', required: false },
  { id: 'quantity', label: 'Quantity', required: false },
  { id: 'unit', label: 'Unit', required: false },
  { id: 'minQuantity', label: 'Minimum quantity', required: false, hint: 'Low-stock threshold' },
  { id: 'hazard', label: 'Hazard', required: false },
  { id: 'expiryDate', label: 'Expiry date', required: false },
  { id: 'supplier', label: 'Supplier', required: false },
  { id: 'notes', label: 'Notes', required: false }
];

/**
 * Header spellings we recognise without being asked.
 *
 * A real school spreadsheet says "Item", "Qty", "Where", "Min", or the Arabic
 * equivalent -- not the field names above. Guessing these right is the
 * difference between an import that works first time and twelve dropdowns the
 * user has to set by hand. Anything not matched here just stays unmapped for
 * them to point at.
 */
const ALIASES: Record<MaterialField, string[]> = {
  name: ['name', 'item', 'item name', 'material', 'material name', 'description', 'الاسم', 'المادة'],
  code: ['code', 'item code', 'ref', 'reference', 'sku', 'id', 'رمز', 'الرمز'],
  category: ['category', 'type', 'kind', 'النوع', 'التصنيف'],
  lab: ['lab', 'laboratory', 'room', 'lab name', 'المختبر', 'المعمل'],
  location: ['location', 'where', 'place', 'position', 'shelf', 'cabinet', 'storage', 'الموقع', 'المكان'],
  quantity: ['quantity', 'qty', 'count', 'stock', 'amount', 'الكمية'],
  unit: ['unit', 'uom', 'measure', 'الوحدة'],
  minQuantity: ['min', 'minimum', 'min quantity', 'min qty', 'reorder', 'reorder level', 'الحد الأدنى'],
  hazard: ['hazard', 'hazards', 'risk', 'safety', 'ghs', 'الخطورة'],
  expiryDate: ['expiry', 'expiry date', 'expires', 'expiration', 'best before', 'تاريخ الانتهاء'],
  supplier: ['supplier', 'vendor', 'brand', 'manufacturer', 'المورد'],
  notes: ['notes', 'note', 'comment', 'comments', 'remarks', 'ملاحظات']
};

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

const FIELD_ORDER = Object.keys(ALIASES) as MaterialField[];

/**
 * Best-guess header → field mapping. Returns one entry per spreadsheet column.
 *
 * Two full passes, not one pass per column. Exact matches are claimed across
 * every column *first*, and only then are the leftovers matched on substring.
 * Doing both per column let an earlier column's loose match steal a field an
 * later column named exactly: a sheet headed "Item Location | Item Name" gave
 * `name` to the location column (it contains "item"), leaving the real name
 * column unmapped and every row rejected for a missing name.
 */
export function guessMapping(headers: unknown[]): (MaterialField | null)[] {
  const out: (MaterialField | null)[] = headers.map(() => null);
  const taken = new Set<MaterialField>();
  const keys = headers.map(norm);

  // Pass 1 — exact alias hits.
  keys.forEach((key, i) => {
    if (!key) return;
    for (const field of FIELD_ORDER) {
      if (taken.has(field)) continue;
      if (ALIASES[field].includes(key)) {
        taken.add(field);
        out[i] = field;
        return;
      }
    }
  });

  // Pass 2 — whole-word, so "Item Name (English)" still lands on `name`. The
  // longest alias wins, so "min quantity" is not read as "quantity".
  keys.forEach((key, i) => {
    if (!key || out[i]) return;
    let best: { field: MaterialField; len: number } | null = null;
    for (const field of FIELD_ORDER) {
      if (taken.has(field)) continue;
      for (const alias of ALIASES[field]) {
        if (aliasAppearsIn(key, alias) && (!best || alias.length > best.len)) {
          best = { field, len: alias.length };
        }
      }
    }
    if (best) {
      taken.add(best.field);
      out[i] = best.field;
    }
  });

  return out;
}

/**
 * Does `alias` appear in `key` as a word, rather than as any old substring?
 *
 * A plain `includes` read "Cabinet Label" as the *lab* column, because "label"
 * contains "lab" -- so an inventory sheet's shelf label was taken for the room
 * the item lives in. Word boundaries stop that while still matching the cases
 * substring search exists for, like "Item Name (English)".
 *
 * `\b` is ASCII-only, so the Arabic aliases fall back to a plain containment
 * test; Arabic has no casing and these headings are short, so the boundary
 * problem does not arise there.
 */
function aliasAppearsIn(key: string, alias: string): boolean {
  if (!/^[\x20-\x7e]+$/.test(alias)) return key.includes(alias);
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(key);
}

/**
 * How well a header row looks like a materials sheet, 0–1.
 *
 * Used to pick the right worksheet out of a workbook when none is named
 * "Materials". A stock list has a name, a lab and a location column; the
 * template's own `Lists` / `Labs` / `How to fill in` tabs do not.
 */
export function headerRowScore(headers: unknown[]): number {
  const mapping = guessMapping(headers);
  const required = MATERIAL_FIELDS.filter(f => f.required).map(f => f.id);
  const hits = required.filter(f => mapping.includes(f)).length;
  const extras = mapping.filter(m => m !== null && !required.includes(m)).length;
  // Required columns dominate; the optional ones only break ties.
  return hits / required.length + Math.min(extras, 9) / 100;
}

/** Sheet names taken as the materials sheet without looking at the headings. */
export const PREFERRED_SHEET_NAMES = ['materials', 'material', 'stock', 'inventory', 'المواد'];

/** How far down a sheet to look for the heading row. */
const MAX_HEADER_SCAN = 10;

export interface SheetCandidate {
  name: string;
  rows: unknown[][];
}

/**
 * Which row holds the column headings.
 *
 * Real inventory sheets open with a merged title banner -- "Chemistry Lab
 * Equipment" across A1 with the rest of the row empty -- and put the actual
 * headings on row 2 or 3. Assuming row 1 made every such file import as zero
 * rows: the title became the only "column", nothing mapped, and every data row
 * was rejected for a missing name.
 *
 * Scored rather than pattern-matched, so it works on a sheet that genuinely
 * does start at row 1 (the score peaks there and nothing is skipped).
 */
export function detectHeaderRow(rows: unknown[][]): number {
  let bestIndex = 0;
  let bestScore = -1;

  const limit = Math.min(rows.length, MAX_HEADER_SCAN);
  for (let i = 0; i < limit; i += 1) {
    const row = rows[i] || [];
    const filled = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
    // A one-cell row is a banner, not a heading row.
    if (filled < 2) continue;

    const score = headerRowScore(row);
    // Strictly greater, so the first row that achieves the best score wins and
    // a repeated heading further down does not steal it.
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Picks the worksheet to import out of a workbook.
 *
 * Never blindly "the first sheet". The app's own template carries four tabs,
 * and reading position 1 rather than the sheet called "Materials" is what made
 * a filled-in template import as zero valid rows.
 */
export function pickMaterialsSheet(sheets: SheetCandidate[]): number {
  if (sheets.length === 0) return -1;

  const byName = sheets.findIndex(s =>
    PREFERRED_SHEET_NAMES.includes(norm(s.name))
  );
  if (byName !== -1) return byName;

  let bestIndex = 0;
  let bestScore = -1;
  sheets.forEach((s, i) => {
    if (!s.rows.length) return;
    // Scored on its own heading row, not on row 1 -- otherwise every sheet in a
    // workbook with title banners scores identically at zero.
    const score = headerRowScore(s.rows[detectHeaderRow(s.rows)] || []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });
  return bestIndex;
}

/**
 * Values to fall back on when a row does not carry its own.
 *
 * Two real gaps this closes, both from the same sheet:
 *
 * - **No lab column at all.** An inventory workbook usually keeps one sheet per
 *   room -- "Chemistry", "Physics" -- so the lab is the tab name, and no cell
 *   in the sheet names it.
 * - **An empty location column.** A school that has not yet recorded where
 *   things live still has a list worth importing; refusing all of it because a
 *   column is blank helps nobody.
 *
 * Supplied by the user in the import dialog, never guessed. A default only
 * fills a blank -- a row that names its own lab or location always wins.
 */
export interface RowDefaults {
  labId?: string;
  location?: string;
}

const CATEGORY_IDS = MATERIAL_CATEGORIES.map(c => c.id) as readonly string[];

function parseCategory(raw: string): MaterialCategory | undefined {
  const v = norm(raw);
  if (!v) return undefined;
  if (CATEGORY_IDS.includes(v)) return v as MaterialCategory;
  // Tolerate the plural and the label casing people actually type.
  const singular = v.replace(/s$/, '');
  if (CATEGORY_IDS.includes(singular)) return singular as MaterialCategory;
  if (v.includes('chem')) return 'chemical';
  if (v.includes('glass')) return 'glassware';
  if (v.includes('consum') || v.includes('disposable')) return 'consumable';
  if (v.includes('equip') || v.includes('apparat') || v.includes('device')) return 'equipment';
  return undefined;
}

function parseNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  // Strip a trailing unit someone typed into the quantity cell ("12 bottles").
  const m = String(raw).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Excel dates arrive as a Date when the cell is date-formatted and as text when
 * it is not. Normalised to `YYYY-MM-DD` either way; anything unparseable is
 * dropped rather than stored as a string that will never sort or compare.
 */
function parseDate(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export type ParsedRow = Omit<Material, 'id' | 'section' | 'updatedAt'>;

export interface RowError {
  /** 1-based row number in the sheet, counting the header. */
  row: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[];
  /** Distinct lab names in the sheet that matched no lab in this school. */
  unknownLabs: string[];
}

/**
 * Applies a confirmed mapping to the data rows.
 *
 * A row is rejected -- never guessed at -- when a required field is missing or
 * its lab cannot be resolved. Filing a chemical into the wrong room, or into no
 * room, is worse than telling the user to fix line 34 of their spreadsheet.
 */
export function buildRows(
  dataRows: unknown[][],
  mapping: (MaterialField | null)[],
  labs: Lab[],
  options: {
    defaults?: RowDefaults;
    /**
     * Sheet line number of the first data row, so a rejection points at the
     * line the user can actually see. Defaults to 2 (header on line 1).
     */
    firstDataRow?: number;
  } = {}
): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const unknownLabs = new Set<string>();

  const defaults = options.defaults || {};
  const firstDataRow = options.firstDataRow ?? 2;
  const defaultLocation = (defaults.location || '').trim();
  const defaultLab = defaults.labId ? labs.find(l => l.id === defaults.labId) : undefined;

  const labByName = new Map<string, Lab>();
  labs.forEach(l => {
    labByName.set(norm(l.name), l);
    if (l.code) labByName.set(norm(l.code), l);
  });

  const col = (r: unknown[], field: MaterialField): string => {
    const i = mapping.indexOf(field);
    return i === -1 ? '' : String(r[i] ?? '').trim();
  };
  const rawCol = (r: unknown[], field: MaterialField): unknown => {
    const i = mapping.indexOf(field);
    return i === -1 ? undefined : r[i];
  };

  /**
   * A row is filler when every column that maps to a field is empty.
   *
   * Judged on the mapped columns only, not the whole row. Inventory sheets are
   * pre-numbered hundreds of lines deep, so the tail carries a running "#" and
   * nothing else. Testing the whole row made each of those a rejection, and one
   * import reported 73 errors that were all just blank numbered lines --
   * burying the handful of rows with a real problem.
   */
  const mappedIndexes = mapping
    .map((m, i) => (m ? i : -1))
    .filter(i => i !== -1);

  dataRows.forEach((r, idx) => {
    const sheetRow = idx + firstDataRow;
    const isBlank = mappedIndexes.length
      ? mappedIndexes.every(i => r[i] === null || r[i] === undefined || String(r[i]).trim() === '')
      : r.every(c => c === null || c === undefined || String(c).trim() === '');
    if (isBlank) return;

    const name = col(r, 'name');
    const location = col(r, 'location') || defaultLocation;
    const labRaw = col(r, 'lab');

    // Only the name is truly per-row. Lab and location can come from the
    // sheet-wide defaults the user set, so they are checked after the fallback
    // has been applied rather than before it.
    const lab = labRaw ? labByName.get(norm(labRaw)) : defaultLab;

    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!labRaw && !defaultLab) missing.push('lab');
    if (!location) missing.push('location');
    if (missing.length) {
      errors.push({ row: sheetRow, message: `missing ${missing.join(', ')}` });
      return;
    }

    if (!lab) {
      unknownLabs.add(labRaw);
      errors.push({ row: sheetRow, message: `no lab called “${labRaw}” in this school` });
      return;
    }

    rows.push({
      name,
      labId: lab.id,
      location,
      code: col(r, 'code') || undefined,
      category: parseCategory(col(r, 'category')),
      quantity: parseNumber(rawCol(r, 'quantity')),
      minQuantity: parseNumber(rawCol(r, 'minQuantity')),
      unit: col(r, 'unit') || undefined,
      hazard: col(r, 'hazard') || undefined,
      expiryDate: parseDate(rawCol(r, 'expiryDate')),
      supplier: col(r, 'supplier') || undefined,
      notes: col(r, 'notes') || undefined
    });
  });

  return { rows, errors, unknownLabs: [...unknownLabs] };
}

/* --- Deciding what a re-import means ----------------------------------- */

/**
 * The fields that make one stock line the same stock line as another.
 *
 * Everything a material carries except `quantity` -- which is the thing being
 * accumulated -- and `updatedAt`, which is bookkeeping. Two rows agreeing on
 * all of these are the same shelf holding the same thing, so a re-import adds
 * to what is there. Disagree on any one of them and they are separate stock:
 * the same reagent in Cabinet B and Cabinet C is two entries, because "where
 * is it" is the question this table exists to answer and averaging two answers
 * helps nobody.
 *
 * The trade this makes is explicit: a typo in the spreadsheet produces a
 * second row rather than silently overwriting the good one. That is the safe
 * direction -- a duplicate is visible in the list and can be merged by hand;
 * an overwrite is not visible at all.
 */
export const MATERIAL_IDENTITY_FIELDS = [
  'name',
  'code',
  'category',
  'labId',
  'location',
  'unit',
  'minQuantity',
  'hazard',
  'expiryDate',
  'supplier',
  'notes'
] as const;

/**
 * Comparison form of one identity field.
 *
 * Case- and whitespace-insensitive, because a spreadsheet that says "Sodium
 * Hydroxide " and a record that says "sodium hydroxide" are not two chemicals.
 * Absent, empty and undefined all collapse to the same empty string, so a
 * blank cell matches a field the record never had -- otherwise an item
 * imported once without a supplier would never merge with itself.
 */
function identityValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The key two rows must agree on to be treated as the same stock line. */
export function materialIdentityKey(
  material: Omit<Partial<Material>, 'section'> & { section?: string }
): string {
  return [
    identityValue(material.section),
    ...MATERIAL_IDENTITY_FIELDS.map(f => identityValue(material[f]))
  ].join('\u241f');
}

/** What an import will do to one existing record or one new one. */
export interface MaterialImportPlanEntry {
  /** Existing document to write into, or undefined when this is a new line. */
  existing?: Material;
  /** The row as parsed, minus the quantity resolution below. */
  row: ParsedRow;
  /**
   * Quantity to store: the existing quantity plus every matching sheet row's,
   * or just the sheet's for a new line. `undefined` when neither side named
   * one -- an item with no count recorded should not acquire a spurious 0.
   */
  quantity?: number;
  /** How many sheet rows folded into this entry. */
  rowCount: number;
}

export interface MaterialImportPlan {
  entries: MaterialImportPlanEntry[];
  /** Entries that will create a document. */
  created: number;
  /** Entries that add to a document already in the stockroom. */
  merged: number;
}

/**
 * Works out, without touching Firestore, what a sheet does to the stockroom.
 *
 * Three properties worth stating, because the previous behaviour had none of
 * them and this is the part people get burnt by:
 *
 * 1. **Nothing in the database is ignored or replaced.** Existing records that
 *    the sheet does not mention are left exactly as they are. An import adds;
 *    it is not a restore-from-backup.
 * 2. **A repeat import accumulates rather than overwrites.** Re-importing the
 *    same 200-unit delivery note twice leaves 400 units, because that is what
 *    two deliveries mean. The old behaviour set the quantity to the sheet's
 *    value, so a delivery note that only listed what arrived silently wrote
 *    off everything already on the shelf.
 * 3. **Duplicate rows *within* one sheet fold together too**, into one record
 *    with the summed quantity -- not two records, and not one that only keeps
 *    the last row's count.
 *
 * `existing` may hold both schools; only the section being imported into is
 * considered, so a boys'-school beaker never merges into the girls' stockroom.
 */
export function planMaterialImport(
  section: string,
  rows: ParsedRow[],
  existing: Material[]
): MaterialImportPlan {
  const entries: MaterialImportPlanEntry[] = [];
  /** Identity -> index into `entries`, so repeat rows land on one entry. */
  const byIdentity = new Map<string, number>();

  existing
    .filter(m => m.section === section)
    .forEach(m => {
      const key = materialIdentityKey(m);
      // First writer wins. A stockroom that already holds two byte-identical
      // records (possible before this rule existed) gets its rows added to the
      // first; the second is left untouched rather than being merged away
      // behind the user's back.
      if (byIdentity.has(key)) return;
      byIdentity.set(key, entries.length);
      entries.push({
        existing: m,
        row: { ...m },
        quantity: m.quantity,
        rowCount: 0
      });
    });

  rows.forEach(row => {
    const key = materialIdentityKey({ ...row, section });
    const at = byIdentity.get(key);

    if (at === undefined) {
      byIdentity.set(key, entries.length);
      entries.push({ row, quantity: row.quantity, rowCount: 1 });
      return;
    }

    const entry = entries[at];
    entry.rowCount += 1;
    if (typeof row.quantity === 'number') {
      entry.quantity = (entry.quantity ?? 0) + row.quantity;
    }
  });

  // Untouched existing records are carried no further: the writer only needs
  // the ones a row actually landed on.
  const touched = entries.filter(e => e.rowCount > 0);

  return {
    entries: touched,
    created: touched.filter(e => !e.existing).length,
    merged: touched.filter(e => e.existing).length
  };
}
