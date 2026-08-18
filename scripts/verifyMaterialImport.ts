/**
 * Offline checks for the spreadsheet importer.
 *
 * The importer is the one place where data the app did not create gets turned
 * into records people then rely on to find a chemical, so its edge cases are
 * worth pinning down: a header nobody spelled the way we expected, a quantity
 * typed as "12 bottles", an Excel date that arrives as a Date object, a lab
 * name that does not exist. All of it is pure functions over arrays, so none of
 * this needs a browser or Firestore.
 *
 * Run with `npm run verify:import`.
 */
import {
  guessMapping,
  buildRows,
  pickMaterialsSheet,
  headerRowScore,
  detectHeaderRow,
  MaterialField
} from '../src/utils/materialImport';
import type { Lab } from '../src/types';

const LABS: Lab[] = [
  { id: 'lab-1', name: 'Chemistry Lab', code: 'CHEM-01', capacity: 30, color: 'brand-green' },
  { id: 'lab-2', name: 'Biology Lab', code: 'BIO-01', capacity: 30, color: 'brand-aqua' }
];

let failures = 0;
const check = (label: string, cond: boolean, detail?: unknown) => {
  if (cond) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log('        got:', JSON.stringify(detail));
  }
};

console.log('\n=== header guessing ===');
{
  const m = guessMapping(['Item Name', 'Qty', 'Where', 'Lab', 'Min', 'Expiry Date']);
  check('"Item Name" -> name', m[0] === 'name', m);
  check('"Qty" -> quantity', m[1] === 'quantity', m);
  check('"Where" -> location', m[2] === 'location', m);
  check('"Lab" -> lab', m[3] === 'lab', m);
  check('"Min" -> minQuantity', m[4] === 'minQuantity', m);
  check('"Expiry Date" -> expiryDate', m[5] === 'expiryDate', m);
}
{
  const m = guessMapping(['الاسم', 'المختبر', 'الموقع', 'الكمية']);
  check('Arabic headers are recognised', JSON.stringify(m) === JSON.stringify(['name', 'lab', 'location', 'quantity']), m);
}
{
  const m = guessMapping(['Item Name (English)', 'Unrelated column']);
  check('substring fallback maps "Item Name (English)"', m[0] === 'name', m);
  check('an unrecognised header stays unmapped', m[1] === null, m);
}
{
  // "Name" and "Item name" both alias to `name`; only the first may claim it,
  // otherwise two columns silently fight over one field.
  const m = guessMapping(['Name', 'Item Name']);
  check('a field is claimed at most once', m[0] === 'name' && m[1] === null, m);
}

console.log('\n=== row building ===');
const MAP: (MaterialField | null)[] = [
  'name', 'lab', 'location', 'quantity', 'unit', 'code', 'category', 'expiryDate', 'minQuantity'
];
{
  const { rows, errors } = buildRows(
    [['Sodium hydroxide', 'Chemistry Lab', 'Cabinet B/3', 12, 'bottle', 'CHEM-014', 'Chemicals', '2026-08-01', 3]],
    MAP,
    LABS
  );
  check('a good row parses', rows.length === 1 && errors.length === 0, { rows, errors });
  check('lab name resolves to an id', rows[0]?.labId === 'lab-1', rows[0]);
  check('plural category is tolerated', rows[0]?.category === 'chemical', rows[0]);
  check('quantity and minQuantity parse', rows[0]?.quantity === 12 && rows[0]?.minQuantity === 3, rows[0]);
}
{
  const { rows } = buildRows(
    [['Beaker', 'BIO-01', 'Shelf 1', '12 pieces', '', '', 'glass', '', '']],
    MAP,
    LABS
  );
  check('lab resolves by code too', rows[0]?.labId === 'lab-2', rows[0]);
  check('"12 pieces" -> 12', rows[0]?.quantity === 12, rows[0]);
  check('"glass" -> glassware', rows[0]?.category === 'glassware', rows[0]);
  check('blank optional fields are dropped, not empty strings', rows[0]?.code === undefined, rows[0]);
}
{
  const { rows } = buildRows(
    [['Agar', 'Biology Lab', 'Fridge', '', '', '', '', new Date(Date.UTC(2027, 0, 15)), '']],
    MAP,
    LABS
  );
  check('an Excel Date cell normalises to YYYY-MM-DD', rows[0]?.expiryDate === '2027-01-15', rows[0]);
}
{
  const { rows, errors, unknownLabs } = buildRows(
    [
      ['', 'Chemistry Lab', 'Cabinet A', '', '', '', '', '', ''],
      ['Ethanol', 'Physics Lab', 'Cabinet C', '', '', '', '', '', ''],
      ['Funnel', 'Chemistry Lab', '', '', '', '', '', '', ''],
      ['Good item', 'Chemistry Lab', 'Shelf 2', '', '', '', '', '', '']
    ],
    MAP,
    LABS
  );
  check('rows missing a required field are rejected', errors.some(e => e.row === 2 && /name/.test(e.message)), errors);
  check('an unknown lab is rejected, not guessed', errors.some(e => e.row === 3 && /Physics Lab/.test(e.message)), errors);
  check('unknown labs are collected for the user', unknownLabs.includes('Physics Lab'), unknownLabs);
  check('a missing location is rejected', errors.some(e => e.row === 4 && /location/.test(e.message)), errors);
  check('good rows still import alongside bad ones', rows.length === 1 && rows[0].name === 'Good item', rows);
  check('error rows carry the sheet line number', errors.every(e => e.row >= 2), errors);
}
{
  const { rows, errors } = buildRows(
    [['', '', '', '', '', '', '', '', ''], [null, null, null, null, null, null, null, null, null]],
    MAP,
    LABS
  );
  check('blank trailing rows are skipped silently', rows.length === 0 && errors.length === 0, { rows, errors });
}

console.log('\n=== column claiming order ===');
{
  // Regression: both passes used to run per column, so "Item Location" (which
  // contains "item") claimed `name` before the real name column was reached,
  // and every row was then rejected for a missing name.
  const m = guessMapping(['Item Location', 'Item Name', 'Lab']);
  check(
    'a loose match does not steal a field another column names exactly',
    m[0] === 'location' && m[1] === 'name' && m[2] === 'lab',
    m
  );
}
{
  const m = guessMapping(['Quantity', 'Min Quantity']);
  check(
    '"Min Quantity" is not read as "Quantity"',
    m[0] === 'quantity' && m[1] === 'minQuantity',
    m
  );
}

console.log('\n=== picking the sheet out of a workbook ===');
{
  // The exact shape the app's own template produces. For as long as the
  // importer read whichever sheet came first, a filled-in template imported as
  // zero rows and reported "missing name, location" on every line.
  const sheets = [
    {
      name: 'Lists',
      rows: [
        ['Labs', 'Categories', 'Units', 'Hazards'],
        ['Chemistry Lab', 'Chemical', 'piece', 'Toxic']
      ]
    },
    {
      name: 'Materials',
      rows: [
        ['Item Name', 'Code', 'Category', 'Lab', 'Location'],
        ['Agar', '', '', 'Biology Lab', 'Fridge']
      ]
    },
    { name: 'Labs', rows: [['School', 'Lab name', 'Lab code']] },
    { name: 'How to fill in', rows: [['How to fill this in']] }
  ];
  check('the sheet named Materials wins over sheet 1', pickMaterialsSheet(sheets) === 1, pickMaterialsSheet(sheets));
}
{
  const sheets = [
    { name: 'Sheet1', rows: [['Notes', 'Colour']] },
    { name: 'Sheet2', rows: [['Item', 'Lab', 'Where', 'Qty']] }
  ];
  check('with no Materials sheet, the best header row wins', pickMaterialsSheet(sheets) === 1, pickMaterialsSheet(sheets));
}
{
  const stock = headerRowScore(['Item Name', 'Lab', 'Location']);
  const lookup = headerRowScore(['Labs', 'Categories', 'Units', 'Hazards']);
  check('a stock header row scores above a lookup one', stock > lookup, { stock, lookup });
  check('an empty workbook reports no sheet', pickMaterialsSheet([]) === -1, pickMaterialsSheet([]));
}

console.log('\n=== real inventory sheets ===');
{
  // The shape of the school's actual stock file: a merged title banner on line
  // 1, headings on line 2, one sheet per room (so no lab column at all), an
  // empty location column, and a pre-numbered tail of blank rows.
  const rows: unknown[][] = [
    ['Chemistry Lab Equipment', null, null, null, null, null],
    ['#', 'Equipment / Item', 'Category', 'Quantity', 'Location / Cabinet', 'Notes'],
    [1, 'Pipette Pump (Green) 10ml', 'Glassware & Containers', 2, null, null],
    [2, 'Beakers 2000ml', 'Glassware & Containers', 4, null, 'chipped'],
    [3, null, null, null, null, null],
    [4, null, null, null, null, null]
  ];

  const hi = detectHeaderRow(rows);
  check('the title banner is skipped and line 2 is the heading row', hi === 1, hi);

  const head = rows[hi];
  const mapping = guessMapping(head);
  check('"Equipment / Item" -> name', mapping[1] === 'name', mapping);
  check('"Location / Cabinet" -> location', mapping[4] === 'location', mapping);

  const res = buildRows(rows.slice(hi + 1), mapping, LABS, {
    defaults: { labId: 'lab-1', location: 'Not recorded yet' },
    firstDataRow: hi + 2
  });
  check('rows import using the sheet-wide lab default',
    res.rows.length === 2 && res.rows.every(r => r.labId === 'lab-1'), res.rows);
  check('the blank location falls back to the supplied default',
    res.rows[0]?.location === 'Not recorded yet', res.rows[0]);
  check('pre-numbered blank rows are skipped silently, not reported',
    res.errors.length === 0, res.errors);
  check('line numbers account for the banner above the headings',
    // The first data row is sheet line 3, not line 2.
    buildRows([[9, null, null, null, null, null], [10, null, 'x', null, null, null]], mapping, LABS,
      { firstDataRow: hi + 2 }).errors[0]?.row === 4,
    buildRows([[9, null, null, null, null, null], [10, null, 'x', null, null, null]], mapping, LABS,
      { firstDataRow: hi + 2 }).errors);
}
{
  // "Cabinet Label" contains the letters "lab", and a plain substring match
  // read it as the lab column -- filing a shelf label as the room.
  const m = guessMapping(['Equipment / Item', 'Location / Cabinet', 'Cabinet Label']);
  check('"Cabinet Label" is not mistaken for the lab column',
    m[2] !== 'lab', m);
  check('"Location / Cabinet" still wins location', m[1] === 'location', m);
}
{
  const m = guessMapping(['البند', 'المختبر', 'الموقع']);
  check('Arabic headings still match without word boundaries',
    m[1] === 'lab' && m[2] === 'location', m);
}
{
  // A row that carries its own values must beat the defaults.
  const mapping: (MaterialField | null)[] = ['name', 'lab', 'location'];
  const { rows } = buildRows([['Agar', 'Biology Lab', 'Fridge']], mapping, LABS, {
    defaults: { labId: 'lab-1', location: 'Not recorded yet' }
  });
  check('a row with its own lab and location overrides the defaults',
    rows[0]?.labId === 'lab-2' && rows[0]?.location === 'Fridge', rows[0]);
}

console.log(
  failures === 0
    ? '\nAll material import checks passed.\n'
    : `\n${failures} material import check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);
