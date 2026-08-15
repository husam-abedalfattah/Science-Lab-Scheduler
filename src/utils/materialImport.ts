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

/** Best-guess header → field mapping. Returns one entry per spreadsheet column. */
export function guessMapping(headers: unknown[]): (MaterialField | null)[] {
  const taken = new Set<MaterialField>();
  return headers.map(h => {
    const key = norm(h);
    if (!key) return null;
    for (const [field, names] of Object.entries(ALIASES) as [MaterialField, string[]][]) {
      if (taken.has(field)) continue;
      if (names.includes(key)) {
        taken.add(field);
        return field;
      }
    }
    // Second pass: substring, so "Item Name (English)" still lands on `name`.
    for (const [field, names] of Object.entries(ALIASES) as [MaterialField, string[]][]) {
      if (taken.has(field)) continue;
      if (names.some(n => key.includes(n))) {
        taken.add(field);
        return field;
      }
    }
    return null;
  });
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
  labs: Lab[]
): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const unknownLabs = new Set<string>();

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

  dataRows.forEach((r, idx) => {
    const sheetRow = idx + 2; // +1 for zero-index, +1 for the header row
    if (r.every(c => c === null || c === undefined || String(c).trim() === '')) return;

    const name = col(r, 'name');
    const location = col(r, 'location');
    const labRaw = col(r, 'lab');

    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!labRaw) missing.push('lab');
    if (!location) missing.push('location');
    if (missing.length) {
      errors.push({ row: sheetRow, message: `missing ${missing.join(', ')}` });
      return;
    }

    const lab = labByName.get(norm(labRaw));
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
