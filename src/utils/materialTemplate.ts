import { Lab, Section } from '../types';
import { MATERIAL_CATEGORIES, MATERIAL_HAZARDS, MATERIAL_UNITS } from '../constants';
import { SCHOOL_LABEL } from '../brand';

/**
 * The blank stock sheet a technician fills in.
 *
 * Two things make this worth generating rather than shipping a static file:
 *
 * 1. **The column headings are exactly the ones the importer recognises**, so a
 *    template that goes out and comes back needs no column mapping at all.
 * 2. **The lab list is the real one for this school.** "No lab called X" is the
 *    one import error a technician cannot fix without being told the valid
 *    spellings, so the template supplies them as a dropdown instead.
 *
 * The picking columns -- Lab, Category, Unit, Hazard -- are Excel data
 * validation lists pointed at a `Lists` sheet. Typing is what produces
 * "Chemicals" vs "chemical" vs "Chem", which then cannot be filtered on.
 *
 * ## On the `uuid` advisory under exceljs
 *
 * `npm audit` flags uuid@8.3.2 (GHSA-w5hq-g745-h8pq) via exceljs. That
 * advisory is a missing bounds check in uuid v3/v5/v6 *when a `buf` argument is
 * supplied*. ExcelJS calls only `v4()`, with no buffer, and only in
 * conditional-formatting code we never reach. Forcing uuid >= 11 is not a fix
 * here: v11 is ESM-only and would break exceljs's CommonJS `require`.
 */

/** Rows of the sheet that get dropdowns. Excel needs a bounded range. */
const VALIDATED_ROWS = 500;

/**
 * Builds the workbook. No DOM, so it can be exercised offline -- see
 * `npm run verify:template`, which asserts the dropdowns are actually written
 * into the file and that the headings still round-trip through the importer.
 */
export async function buildMaterialTemplate(
  section: Section | null,
  labsBySection: Record<Section, Lab[]>
) {
  // ~1 MB, loaded only when someone asks for a template.
  const ExcelJS = (await import('exceljs')).default;

  const scope: Section[] = section ? [section] : ['boys', 'girls'];
  const labRows = scope.flatMap(sec =>
    (labsBySection[sec] || []).map(l => ({ school: SCHOOL_LABEL[sec], lab: l }))
  );
  const labNames = labRows.map(r => r.lab.name);
  const categoryLabels = MATERIAL_CATEGORIES.map(c => c.label);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Science Lab Scheduler';
  wb.created = new Date();

  /* --- Lists: the source ranges the dropdowns point at ------------------ */
  const lists = wb.addWorksheet('Lists');
  lists.columns = [
    { header: 'Labs', key: 'lab', width: 30 },
    { header: 'Categories', key: 'cat', width: 20 },
    { header: 'Units', key: 'unit', width: 16 },
    { header: 'Hazards', key: 'haz', width: 26 }
  ];
  const listLength = Math.max(
    labNames.length,
    categoryLabels.length,
    MATERIAL_UNITS.length,
    MATERIAL_HAZARDS.length
  );
  for (let i = 0; i < listLength; i += 1) {
    lists.addRow({
      lab: labNames[i] || null,
      cat: categoryLabels[i] || null,
      unit: MATERIAL_UNITS[i] || null,
      haz: MATERIAL_HAZARDS[i] || null
    });
  }
  lists.getRow(1).font = { bold: true };
  // Present but out of the way -- Excel will not validate against a hidden
  // sheet's range in every version, so it stays visible rather than risk the
  // dropdowns silently failing.
  lists.state = 'visible';

  /* --- Materials: the sheet they actually fill in ----------------------- */
  const ws = wb.addWorksheet('Materials', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  ws.columns = [
    { header: 'Item Name', key: 'name', width: 34 },
    { header: 'Code', key: 'code', width: 14 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Lab', key: 'lab', width: 24 },
    { header: 'Location', key: 'location', width: 28 },
    { header: 'Quantity', key: 'quantity', width: 11 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Minimum', key: 'minQuantity', width: 11 },
    { header: 'Hazard', key: 'hazard', width: 22 },
    { header: 'Expiry Date', key: 'expiryDate', width: 14 },
    { header: 'Supplier', key: 'supplier', width: 22 },
    { header: 'Notes', key: 'notes', width: 34 }
  ];

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006166' } }; // Kingdom Green
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  const exampleLab = labNames[0] || 'Chemistry Lab';
  ws.addRow({
    name: 'Sodium hydroxide',
    code: 'CHEM-014',
    category: 'Chemical',
    lab: exampleLab,
    location: 'Cabinet B, Shelf 3',
    quantity: 12,
    unit: 'bottle',
    minQuantity: 3,
    hazard: 'Corrosive',
    expiryDate: '2026-08-01',
    supplier: 'Al Kimia',
    notes: 'Keep sealed'
  });
  ws.addRow({
    name: 'Beaker 250ml',
    category: 'Glassware',
    lab: exampleLab,
    location: 'Shelf 1',
    quantity: 40,
    unit: 'piece'
  });

  // The two examples are marked so it is obvious they are meant to be deleted.
  [2, 3].forEach(r => {
    ws.getRow(r).font = { italic: true, color: { argb: 'FF7A7A7A' } };
  });

  /* --- The dropdowns ---------------------------------------------------- */
  const listRange = (col: string, count: number) =>
    count > 0 ? [`=Lists!$${col}$2:$${col}$${count + 1}`] : undefined;

  const validations: { col: string; formulae?: string[]; prompt: string }[] = [
    { col: 'D', formulae: listRange('A', labNames.length), prompt: 'Pick the lab this item is stored in.' },
    { col: 'C', formulae: listRange('B', categoryLabels.length), prompt: 'Pick a category.' },
    { col: 'G', formulae: listRange('C', MATERIAL_UNITS.length), prompt: 'Pick a unit, or type your own.' },
    { col: 'I', formulae: listRange('D', MATERIAL_HAZARDS.length), prompt: 'Pick a hazard class if this is a chemical.' }
  ];

  validations.forEach(({ col, formulae, prompt }) => {
    if (!formulae) return;
    for (let row = 2; row <= VALIDATED_ROWS; row += 1) {
      ws.getCell(`${col}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae,
        // Unit and Hazard stay open so a lab can use a unit we did not think
        // of; Lab and Category are closed because the importer has to match
        // them and a typo there means the row is skipped.
        showErrorMessage: col === 'D' || col === 'C',
        errorStyle: 'stop',
        errorTitle: 'Pick from the list',
        error:
          col === 'D'
            ? 'That lab does not exist in this school. Use one from the dropdown, or the import will skip the row.'
            : 'Use one of the listed categories.',
        showInputMessage: true,
        promptTitle: 'Choose',
        prompt
      };
    }
  });

  // Quantity / Minimum: whole numbers, so "12 bottles" never lands in a number
  // column. The importer copes with it, but the sheet should not invite it.
  ['F', 'H'].forEach(col => {
    for (let row = 2; row <= VALIDATED_ROWS; row += 1) {
      ws.getCell(`${col}${row}`).dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        formulae: [0],
        allowBlank: true,
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Numbers only',
        error: 'Enter a number here. Put the unit in the Unit column.'
      };
    }
  });

  // Expiry: a real date column, so Excel offers its date picker and the
  // importer gets a Date rather than someone's local text format.
  for (let row = 2; row <= VALIDATED_ROWS; row += 1) {
    ws.getCell(`J${row}`).numFmt = 'yyyy-mm-dd';
  }

  /* --- Labs: reference copy, including codes ---------------------------- */
  const labSheet = wb.addWorksheet('Labs');
  labSheet.columns = [
    { header: 'School', key: 'school', width: 24 },
    { header: 'Lab name (use this in the Lab column)', key: 'name', width: 42 },
    { header: 'Lab code (also accepted)', key: 'code', width: 26 }
  ];
  labSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  labSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF006166' }
  };
  labRows.forEach(({ school, lab }) =>
    labSheet.addRow({ school, name: lab.name, code: lab.code || '' })
  );

  /* --- Instructions ------------------------------------------------------ */
  const how = wb.addWorksheet('How to fill in');
  how.columns = [{ header: 'How to fill this in', key: 'line', width: 110 }];
  how.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  how.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006166' } };
  [
    'Item Name, Lab and Location are required. Every other column may be left blank.',
    'Lab, Category, Unit and Hazard are dropdowns — click the cell and pick from the arrow.',
    'Lab must be one from the list. A row with an unknown lab is skipped on import and reported by row number.',
    'Quantity and Minimum accept numbers only. Put "bottle", "kg" and so on in the Unit column.',
    'Minimum is the level at which the item is flagged as low stock in the app.',
    'Expiry Date is formatted as a date — type it however you like and Excel will store it correctly.',
    'Code is optional, but if you fill it in, re-importing updates that item instead of creating a duplicate.',
    'Add as many rows as you need. The dropdowns are set up for the first 500 rows.',
    'Delete the two grey example rows on the Materials sheet before importing.',
    'The Lists sheet feeds the dropdowns — leave it alone.'
  ].forEach(line => how.addRow({ line }));
  how.getColumn(1).alignment = { wrapText: true, vertical: 'top' };

  return wb;
}

/** Builds the template and hands it to the browser as a download. */
export async function downloadMaterialTemplate(
  section: Section | null,
  labsBySection: Record<Section, Lab[]>
): Promise<void> {
  const wb = await buildMaterialTemplate(section, labsBySection);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = section
    ? `Lab materials template - ${SCHOOL_LABEL[section]}.xlsx`
    : 'Lab materials template.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
