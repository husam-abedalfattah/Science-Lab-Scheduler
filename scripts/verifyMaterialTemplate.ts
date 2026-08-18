/**
 * Offline checks for the Excel template.
 *
 * Two things are easy to break here and impossible to notice without opening
 * Excel: the dropdowns silently not being written into the file, and the column
 * headings drifting away from the aliases the importer recognises. The second
 * is the nastier one -- the template would still look right, but a filled-in
 * copy would come back needing every column mapped by hand.
 *
 * So this builds the real workbook, writes it to a buffer, reads it back, and
 * asserts both. Run with `npm run verify:template`.
 */
import ExcelJS from 'exceljs';
import { buildMaterialTemplate } from '../src/utils/materialTemplate';
import { guessMapping, buildRows, pickMaterialsSheet } from '../src/utils/materialImport';
import { MATERIAL_CATEGORIES, MATERIAL_HAZARDS, MATERIAL_UNITS } from '../src/constants';
import type { Lab } from '../src/types';

const LABS: Lab[] = [
  { id: 'lab-1', name: 'Chemistry Lab', code: 'CHEM-01', capacity: 30, color: 'brand-green' },
  { id: 'lab-2', name: 'Biology Lab', code: 'BIO-01', capacity: 30, color: 'brand-aqua' }
];

let failures = 0;
const check = (label: string, cond: boolean, detail?: unknown) => {
  if (cond) console.log(`  ok    ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log('        got:', JSON.stringify(detail));
  }
};

async function main() {
  const built = await buildMaterialTemplate('boys', { boys: LABS, girls: [] });
  const buffer = await built.xlsx.writeBuffer();

  // Read it back the way Excel would, rather than trusting the in-memory model.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.getWorksheet('Materials')!;

  console.log('\n=== structure ===');
  check('workbook has the four sheets',
    ['Lists', 'Materials', 'Labs', 'How to fill in'].every(n => wb.getWorksheet(n)),
    wb.worksheets.map(w => w.name));
  // The regression this file exists to stop happening twice: `Lists` was
  // created first, so the importer -- which reads position 1 -- saw the
  // dropdown source data and rejected every row of a filled-in template.
  check('Materials is the FIRST sheet in the workbook',
    wb.worksheets[0]?.name === 'Materials',
    wb.worksheets.map(w => w.name));
  check('the importer picks Materials out of the workbook',
    pickMaterialsSheet(
      wb.worksheets.map(w => ({
        name: w.name,
        rows: [((w.getRow(1).values as unknown[]) || []).slice(1)]
      }))
    ) === 0,
    wb.worksheets.map(w => w.name));
  check('header row is frozen', ws.views?.[0]?.state === 'frozen', ws.views);
  check('two example rows are present', ws.rowCount >= 3, ws.rowCount);

  console.log('\n=== headings round-trip through the importer ===');
  const headers = (ws.getRow(1).values as unknown[]).slice(1);
  const mapping = guessMapping(headers);
  const required: Record<string, string> = {
    name: 'Item Name', lab: 'Lab', location: 'Location', code: 'Code',
    category: 'Category', quantity: 'Quantity', unit: 'Unit',
    minQuantity: 'Minimum', hazard: 'Hazard', expiryDate: 'Expiry Date',
    supplier: 'Supplier', notes: 'Notes'
  };
  Object.entries(required).forEach(([field, heading]) => {
    const i = headers.indexOf(heading);
    check(`"${heading}" -> ${field}`, i !== -1 && mapping[i] === field, { i, got: mapping[i] });
  });
  check('every column is recognised (no manual mapping needed)',
    mapping.every(m => m !== null), mapping);

  console.log('\n=== dropdowns ===');
  const dv = (addr: string) => ws.getCell(addr).dataValidation as
    | { type?: string; formulae?: unknown[]; allowBlank?: boolean }
    | undefined;

  const listCols: [string, string, number][] = [
    ['D', 'Lab', LABS.length],
    ['C', 'Category', MATERIAL_CATEGORIES.length],
    ['G', 'Unit', MATERIAL_UNITS.length],
    ['I', 'Hazard', MATERIAL_HAZARDS.length]
  ];
  listCols.forEach(([col, label, count]) => {
    const v = dv(`${col}2`);
    check(`${label} column is a dropdown`, v?.type === 'list', v);
    check(`${label} points at the Lists sheet`,
      String(v?.formulae?.[0] || '').includes('Lists!'), v?.formulae);
    check(`${label} range covers all ${count} option(s)`,
      String(v?.formulae?.[0] || '').includes(`$${count + 1}`), v?.formulae);
  });

  check('dropdowns extend to the last prepared row (500)', dv('D500')?.type === 'list', dv('D500'));
  check('dropdowns are not applied to the header', dv('D1') === undefined, dv('D1'));

  console.log('\n=== number and date columns ===');
  ['F', 'H'].forEach(col => {
    const v = dv(`${col}2`);
    check(`column ${col} accepts whole numbers only`, v?.type === 'whole', v);
    check(`column ${col} still allows blanks`, v?.allowBlank === true, v);
  });
  check('expiry column is date-formatted', ws.getCell('J2').numFmt === 'yyyy-mm-dd',
    ws.getCell('J2').numFmt);

  console.log('\n=== dropdown sources match the app ===');
  const lists = wb.getWorksheet('Lists')!;
  const colValues = (n: number) =>
    (lists.getColumn(n).values as unknown[]).slice(2).filter(Boolean).map(String);
  check('lab list matches this school',
    JSON.stringify(colValues(1)) === JSON.stringify(LABS.map(l => l.name)), colValues(1));
  check('category list matches constants.ts',
    JSON.stringify(colValues(2)) === JSON.stringify(MATERIAL_CATEGORIES.map(c => c.label)), colValues(2));
  check('unit list matches constants.ts',
    JSON.stringify(colValues(3)) === JSON.stringify([...MATERIAL_UNITS]), colValues(3));
  check('hazard list matches constants.ts',
    JSON.stringify(colValues(4)) === JSON.stringify([...MATERIAL_HAZARDS]), colValues(4));

  console.log('\n=== the template round-trips back through the importer ===');
  {
    // End to end: build it, read it back the way the browser importer does, and
    // assert the example rows actually land as materials. This is what silently
    // returned zero rows before Materials was moved to position 1.
    const dataRows = [2, 3].map(
      r => ((ws.getRow(r).values as unknown[]) || []).slice(1)
    );
    const parsed = buildRows(dataRows, mapping, LABS);
    check('both example rows import cleanly',
      parsed.rows.length === 2 && parsed.errors.length === 0, parsed.errors);
    check('the first example lands in the right lab',
      parsed.rows[0]?.labId === LABS[0].id, parsed.rows[0]);
    check('its quantity and minimum survive as numbers',
      parsed.rows[0]?.quantity === 12 && parsed.rows[0]?.minQuantity === 3, parsed.rows[0]);
    check('its expiry normalises to YYYY-MM-DD',
      parsed.rows[0]?.expiryDate === '2026-08-01', parsed.rows[0]?.expiryDate);
  }

  console.log(
    failures === 0
      ? '\nAll material template checks passed.\n'
      : `\n${failures} material template check(s) FAILED.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
