import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Table2,
  School
} from 'lucide-react';
import { Lab, Section } from '../types';
import { SCHOOL_LABEL } from '../brand';
import {
  MATERIAL_FIELDS,
  MaterialField,
  ParsedRow,
  RowError,
  SheetCandidate,
  buildRows,
  detectHeaderRow,
  guessMapping,
  pickMaterialsSheet
} from '../utils/materialImport';
import { MAX_MATERIAL_IMPORT_ROWS } from '../constants';
import { useModalA11y } from '../hooks/useModalA11y';

interface MaterialImportDialogProps {
  isOpen: boolean;
  /**
   * The school the rows will be filed under, or `null` when the stockroom was
   * opened from the picker screen and no school has been chosen yet. In that
   * case the dialog asks, rather than the button sitting disabled with a
   * tooltip telling you to go somewhere else and come back.
   */
  section: Section | null;
  onSelectSection: (section: Section) => void;
  labsBySection: Record<Section, Lab[]>;
  /** Whether the admin password has already been entered this session. */
  isAdminLoggedIn: boolean;
  /** Returns true when the password is right; the app then flips the flag above. */
  onLogin: (password: string) => boolean;
  /**
   * Why the stockroom could not be read, if it could not be. An import into a
   * collection the browser cannot even read will fail at the last step, so it
   * is refused up front with the real reason rather than after the upload.
   */
  loadError?: string | null;
  onClose: () => void;
  onImport: (rows: ParsedRow[]) => Promise<{ created: number; updated: number }>;
}

type Stage = 'locked' | 'school' | 'pick' | 'map' | 'done';

/**
 * Spreadsheet import.
 *
 * Four deliberate properties:
 *
 * 0. **It is administrator-only.** Everything else in the stockroom edits one
 *    row at a time; this replaces hundreds in a single press, and a wrong file
 *    silently restocks the whole school. Reading stock stays open to everyone.
 * 1. **The sheet is chosen, not assumed.** A workbook has tabs, and the app's
 *    own template has four. Reading position 1 rather than the one called
 *    "Materials" is exactly what made a filled-in template import as zero rows.
 * 2. **The mapping is shown, not assumed.** Headers are guessed, but the guess
 *    is presented as editable dropdowns before anything is written. A silent
 *    mis-map would file every chemical in the wrong place at once.
 * 3. **Bad rows are named, not dropped quietly.** Each rejection carries its
 *    sheet line number and the reason, so the fix is "look at line 34" rather
 *    than "some of my items are missing".
 *
 * Nothing is written until the user presses the button on a screen that states
 * exactly how many rows will be created and updated.
 *
 * The parser itself lives in utils/materialImport.ts and is covered by
 * `npm run verify:import`.
 */
export const MaterialImportDialog: React.FC<MaterialImportDialogProps> = ({
  isOpen,
  section,
  onSelectSection,
  labsBySection,
  isAdminLoggedIn,
  onLogin,
  loadError,
  onClose,
  onImport
}) => {
  const panelRef = useModalA11y(isOpen, onClose);
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('pick');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetCandidate[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<(MaterialField | null)[]>([]);
  /** Sheet line number of the heading row, so errors point at real lines. */
  const [headerLine, setHeaderLine] = useState(1);
  /** Sheet-wide fallbacks for rows that carry no lab / no location. */
  const [defaultLabId, setDefaultLabId] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');
  const [parseError, setParseError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  const reset = () => {
    setStage('pick');
    setFileName('');
    setSheets([]);
    setSheetIndex(0);
    setHeaders([]);
    setDataRows([]);
    setMapping([]);
    setHeaderLine(1);
    setDefaultLabId('');
    setDefaultLocation('');
    setParseError('');
    setResult(null);
    setIsBusy(false);
  };

  /**
   * Reopening starts over.
   *
   * The dialog is mounted the whole time and only renders null while closed, so
   * its stage survived a close -- reopening came back on whatever screen it was
   * left on, most visibly last time's "Import finished" summary, with a stale
   * file still named above it.
   */
  useEffect(() => {
    if (!isOpen) return;
    setStage('pick');
    setFileName('');
    setSheets([]);
    setSheetIndex(0);
    setHeaders([]);
    setDataRows([]);
    setMapping([]);
    setHeaderLine(1);
    setDefaultLabId('');
    setDefaultLocation('');
    setParseError('');
    setPassword('');
    setShowPassword(false);
    setAuthError('');
    setResult(null);
    setIsBusy(false);
  }, [isOpen]);

  if (!isOpen) return null;

  /** Loads one worksheet of an already-parsed workbook into the mapping stage. */
  const useSheet = (all: SheetCandidate[], index: number) => {
    const rows = all[index]?.rows || [];
    if (!rows.length) {
      setHeaders([]);
      setDataRows([]);
      setMapping([]);
      setParseError(`“${all[index]?.name}” is empty. Pick another sheet.`);
      return;
    }

    // Not row 1. Inventory sheets open with a merged title banner and put the
    // headings underneath it.
    const headerIndex = detectHeaderRow(rows);
    const head = rows[headerIndex] || [];
    const body = rows.slice(headerIndex + 1);

    if (body.length > MAX_MATERIAL_IMPORT_ROWS) {
      setParseError(
        `“${all[index].name}” has ${body.length} rows; the limit is ` +
          `${MAX_MATERIAL_IMPORT_ROWS}. Split it and import in parts.`
      );
      return;
    }
    setParseError('');
    setSheetIndex(index);
    setHeaderLine(headerIndex + 1);
    setHeaders(head.map(h => String(h ?? '').trim()));
    setDataRows(body);
    setMapping(guessMapping(head));
    setDefaultLabId('');
    setDefaultLocation('');
  };

  const handleFile = async (file: File) => {
    setParseError('');
    setIsBusy(true);
    try {
      // Loaded only when someone actually imports -- same deferral the PDF
      // export uses, so the parser never lands in the initial bundle.
      //
      // The `/browser` subpath is required: the package publishes no root
      // export, and the `/node` build reaches for `fs`.
      //
      // The default export, not `readSheet`: it returns every sheet as
      // `{ sheet, data }`, which is what lets the workbook's tabs be listed and
      // the right one picked. `readSheet` reads position 1 only, and position 1
      // of our own template is the dropdown source data, not the stock list.
      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const parsed = (await readXlsxFile(file)) as unknown as {
        sheet: string;
        data: unknown[][];
      }[];

      const all: SheetCandidate[] = parsed.map(s => ({
        name: s.sheet,
        rows: s.data || []
      }));

      if (all.length === 0 || all.every(s => s.rows.length === 0)) {
        setParseError('That workbook is empty.');
        return;
      }

      setFileName(file.name);
      setSheets(all);
      useSheet(all, Math.max(0, pickMaterialsSheet(all)));
      setStage('map');
    } catch (err) {
      console.error('Spreadsheet parse error:', err);
      setParseError(
        'Could not read that file. It needs to be a .xlsx workbook — if it is an ' +
          'older .xls, open it in Excel and save it as .xlsx first.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  /** Labs of the school being imported into; empty until one is chosen. */
  const labs = section ? labsBySection[section] || [] : [];

  const preview =
    stage === 'map' && headers.length
      ? buildRows(dataRows, mapping, labs, {
          defaults: { labId: defaultLabId || undefined, location: defaultLocation },
          firstDataRow: headerLine + 1
        })
      : null;

  // A required field is only actually missing if nothing supplies it -- the
  // sheet-wide defaults count.
  const missingRequired = MATERIAL_FIELDS.filter(f => {
    if (!f.required || mapping.includes(f.id)) return false;
    if (f.id === 'lab') return !defaultLabId;
    if (f.id === 'location') return !defaultLocation.trim();
    return true;
  });

  const runImport = async () => {
    if (!preview || preview.rows.length === 0 || isBusy) return;
    setIsBusy(true);
    try {
      const res = await onImport(preview.rows);
      setResult(res);
      setStage('done');
    } catch (err) {
      console.error('Material import error:', err);
      setParseError('The import failed part way through. Check the connection and try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const labNames = labs.map(l => l.name).join(', ');

  // Both gates are derived rather than stored, so they re-assert themselves if
  // the underlying condition changes while the dialog is open: signing out of
  // the admin panel takes the import away, and an import cannot reach the file
  // picker until it knows which school's stock it is writing into.
  const effectiveStage: Stage = !isAdminLoggedIn ? 'locked' : !section ? 'school' : stage;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl w-full p-6 text-slate-900 my-8"
      >
        <div className="flex justify-between items-start pb-4 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-kingdom-700 text-white rounded-xl shrink-0">
              <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="import-title" className="text-lg font-bold text-slate-900">
                Import materials from Excel
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Items already here are updated; new ones are added. Nothing is deleted.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import"
            className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- 0. administrator sign-in --------------------------------- */}
        {effectiveStage === 'locked' && (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (onLogin(password)) {
                setAuthError('');
                setPassword('');
                setStage('pick');
              } else {
                setAuthError('Incorrect password.');
              }
            }}
            className="py-8 space-y-4 max-w-sm mx-auto text-center"
          >
            <div className="w-14 h-14 bg-brand-kingdom-700 text-white rounded-2xl mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Administrator only</h3>
              <p className="text-sm text-slate-600 mt-1">
                An import rewrites the whole stock list in one press, so it needs the admin
                password. Browsing and editing single items does not.
              </p>
            </div>

            <div className="text-left relative">
              <label htmlFor="import-password" className="sr-only">
                Admin password
              </label>
              <input
                id="import-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (authError) setAuthError('');
                }}
                placeholder="Admin password"
                required
                autoComplete="current-password"
                aria-invalid={authError ? true : undefined}
                aria-describedby={authError ? 'import-password-error' : undefined}
                className={`w-full bg-white border rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 text-center placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 transition ${
                  authError ? 'border-brand-coral-600' : 'border-slate-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-900 rounded transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {authError && (
              <p
                id="import-password-error"
                role="alert"
                className="text-sm font-semibold text-brand-coral-800"
              >
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white font-bold text-sm rounded-xl transition"
            >
              Unlock import
            </button>
          </form>
        )}

        {/* The database is refusing the collection; an import would parse
            fine and then fail on the write. Say so before the file is chosen. */}
        {effectiveStage !== 'locked' && loadError && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-brand-coral-50 border border-brand-coral-300 p-3.5"
          >
            <p className="text-sm font-bold text-brand-coral-900 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
              <span>The stockroom cannot be reached, so an import would fail.</span>
            </p>
            <p className="text-xs text-slate-700 mt-1">{loadError}</p>
          </div>
        )}

        {/* --- 0b. which school ----------------------------------------- */}
        {effectiveStage === 'school' && (
          <div className="py-8 space-y-4 max-w-md mx-auto text-center">
            <div className="w-14 h-14 bg-brand-kingdom-700 text-white rounded-2xl mx-auto flex items-center justify-center">
              <School className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Which school is this stock list for?
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                The two schools keep separate stockrooms, so every imported item is filed under
                one of them. You opened the stockroom showing both.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {(['boys', 'girls'] as Section[]).map(sec => {
                const count = (labsBySection[sec] || []).length;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      onSelectSection(sec);
                      setStage('pick');
                    }}
                    className="p-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 hover:border-brand-kingdom-600 transition text-center"
                  >
                    <span className="block text-sm font-bold text-slate-900">
                      {SCHOOL_LABEL[sec]}
                    </span>
                    <span className="block text-xs text-slate-600 mt-0.5">
                      {count} lab{count === 1 ? '' : 's'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 1. pick a file ------------------------------------------- */}
        {effectiveStage === 'pick' && (
          <div className="py-6 space-y-4">
            <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-slate-700 mb-4">
                Choose an <strong className="font-bold">.xlsx</strong> workbook. The sheet called{' '}
                <strong className="font-bold">Materials</strong> is used when there is one — you can
                change that on the next screen.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isBusy || Boolean(loadError)}
                className="px-5 py-2.5 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
              >
                {isBusy ? 'Reading…' : 'Choose file'}
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-300 p-3.5 text-xs text-slate-700 space-y-1.5">
              <p className="font-bold text-slate-900">What the sheet needs</p>
              <p>
                A column for the item <strong>name</strong>, its <strong>lab</strong> and its{' '}
                <strong>location</strong>. Everything else is optional. Headings are matched
                automatically — “Item”, “Qty”, “Where”, “Min” and the Arabic equivalents are all
                understood — and you can correct the mapping on the next screen.
              </p>
              <p>
                The lab column must name a lab that exists in this school:{' '}
                <strong className="text-slate-900">{labNames || 'no labs defined yet'}</strong>.
              </p>
            </div>

            {parseError && (
              <p role="alert" className="text-sm font-semibold text-brand-coral-800">
                {parseError}
              </p>
            )}
          </div>
        )}

        {/* --- 2. confirm the sheet and the mapping --------------------- */}
        {effectiveStage === 'map' && (
          <div className="py-4 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm text-slate-700">
                <strong className="font-bold text-slate-900">{fileName}</strong> — {dataRows.length}{' '}
                row{dataRows.length === 1 ? '' : 's'} on this sheet, headings read from line{' '}
                {headerLine}. Check each column is pointed at the right field.
              </p>

              {sheets.length > 1 && (
                <div className="shrink-0">
                  <label
                    htmlFor="sheet-select"
                    className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1"
                  >
                    <Table2 className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" aria-hidden="true" />
                    Sheet
                  </label>
                  <select
                    id="sheet-select"
                    value={sheetIndex}
                    onChange={e => useSheet(sheets, Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500"
                  >
                    {sheets.map((s, i) => (
                      <option key={`${s.name}-${i}`} value={i}>
                        {s.name} ({Math.max(0, s.rows.length - 1)} rows)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {headers.length === 0 ? (
              <p role="alert" className="text-sm font-semibold text-brand-coral-800">
                {parseError || 'That sheet has no heading row.'}
              </p>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-300">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th scope="col" className="p-2.5 font-bold text-slate-800">
                          Column in your sheet
                        </th>
                        <th scope="col" className="p-2.5 font-bold text-slate-800">
                          Imports as
                        </th>
                        <th scope="col" className="p-2.5 font-bold text-slate-800">
                          First value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {headers.map((h, i) => (
                        <tr key={`${h}-${i}`}>
                          <td className="p-2.5 font-semibold text-slate-900">
                            {h || <em>(blank)</em>}
                          </td>
                          <td className="p-2.5">
                            <label className="sr-only" htmlFor={`map-${i}`}>
                              Field for column {h || i + 1}
                            </label>
                            <select
                              id={`map-${i}`}
                              value={mapping[i] ?? ''}
                              onChange={e => {
                                const v = (e.target.value || null) as MaterialField | null;
                                setMapping(prev => {
                                  const next = [...prev];
                                  // A field can only come from one column.
                                  if (v) next.forEach((m, j) => { if (m === v && j !== i) next[j] = null; });
                                  next[i] = v;
                                  return next;
                                });
                              }}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500"
                            >
                              <option value="">— ignore —</option>
                              {MATERIAL_FIELDS.map(f => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                  {f.required ? ' *' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2.5 text-slate-700 truncate max-w-[12rem]">
                            {String(dataRows[0]?.[i] ?? '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sheet-wide fallbacks.
                    An inventory workbook keeps one sheet per room, so the lab
                    is the tab name and no column names it; and a school that
                    has not recorded where things live has a blank location
                    column. Both are supplied once here rather than refusing
                    the whole file. A row that carries its own value wins. */}
                <div className="rounded-xl bg-slate-50 border border-slate-300 p-3.5 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Fill in what this sheet doesn't say
                    </p>
                    <p className="text-xs text-slate-700 mt-0.5">
                      Applied only where a row leaves the field blank. Rows that name their own
                      lab or location keep it.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="default-lab"
                        className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1"
                      >
                        Lab for these items
                        {!mapping.includes('lab') && (
                          <span className="text-brand-coral-800"> *</span>
                        )}
                      </label>
                      <select
                        id="default-lab"
                        value={defaultLabId}
                        onChange={e => setDefaultLabId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500"
                      >
                        <option value="">
                          {mapping.includes('lab')
                            ? '— use the Lab column only —'
                            : '— pick a lab —'}
                        </option>
                        {labs.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      {!mapping.includes('lab') && (
                        <p className="text-[11px] text-slate-600 mt-1">
                          This sheet has no lab column — “{sheets[sheetIndex]?.name}” is probably
                          the room.
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="default-location"
                        className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1"
                      >
                        Location when blank
                        {!mapping.includes('location') && (
                          <span className="text-brand-coral-800"> *</span>
                        )}
                      </label>
                      <input
                        id="default-location"
                        type="text"
                        value={defaultLocation}
                        onChange={e => setDefaultLocation(e.target.value)}
                        placeholder="e.g. Not recorded yet"
                        maxLength={200}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500"
                      />
                      <p className="text-[11px] text-slate-600 mt-1">
                        Every item needs one so it can be found later. Fill the real ones in
                        afterwards.
                      </p>
                    </div>
                  </div>
                </div>

                {missingRequired.length > 0 && (
                  <p
                    role="alert"
                    className="text-sm font-semibold text-brand-coral-800 flex items-start gap-1.5"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
                    <span>
                      Still need: {missingRequired.map(f => f.label).join(', ')} — either a column
                      above, or a value in “Fill in what this sheet doesn't say”.
                      {sheets.length > 1 && ' If this is the wrong tab, change the sheet above.'}
                    </span>
                  </p>
                )}
              </>
            )}

            {preview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-brand-green-50 border border-brand-green-300 p-3">
                  <p className="text-sm font-bold text-brand-green-900">
                    {preview.rows.length} row{preview.rows.length === 1 ? '' : 's'} ready
                  </p>
                  <p className="text-xs text-slate-700 mt-0.5">
                    Matched by item code where present, otherwise by name and lab.
                  </p>
                </div>
                <div
                  className={`rounded-xl border p-3 ${
                    preview.errors.length > 0
                      ? 'bg-brand-coral-50 border-brand-coral-300'
                      : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <p
                    className={`text-sm font-bold ${
                      preview.errors.length > 0 ? 'text-brand-coral-900' : 'text-slate-800'
                    }`}
                  >
                    {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} skipped
                  </p>
                  <p className="text-xs text-slate-700 mt-0.5">
                    {preview.errors.length === 0
                      ? 'Every row can be imported.'
                      : 'These are listed below; fix the sheet and import again.'}
                  </p>
                </div>
              </div>
            )}

            {preview && preview.unknownLabs.length > 0 && (
              <p className="text-xs text-slate-700 bg-brand-yellow-50 border border-brand-yellow-300 rounded-xl p-2.5">
                <strong className="font-bold text-slate-900">Unrecognised labs:</strong>{' '}
                {preview.unknownLabs.join(', ')}. This school has: {labNames || 'no labs yet'}.
              </p>
            )}

            {preview && preview.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-xl border border-brand-coral-300 bg-white p-2.5">
                <ul className="space-y-1">
                  {preview.errors.slice(0, 50).map((e: RowError) => (
                    <li key={e.row} className="text-xs text-slate-800">
                      <strong className="font-bold text-brand-coral-800">Row {e.row}</strong> —{' '}
                      {e.message}
                    </li>
                  ))}
                  {preview.errors.length > 50 && (
                    <li className="text-xs text-slate-600 italic">
                      …and {preview.errors.length - 50} more.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {parseError && headers.length > 0 && (
              <p role="alert" className="text-sm font-semibold text-brand-coral-800">
                {parseError}
              </p>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
              >
                Choose a different file
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={
                  isBusy ||
                  Boolean(loadError) ||
                  !preview ||
                  preview.rows.length === 0 ||
                  missingRequired.length > 0
                }
                className="px-5 py-2 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white font-bold rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBusy
                  ? 'Importing…'
                  : `Import ${preview?.rows.length ?? 0} item${
                      preview?.rows.length === 1 ? '' : 's'
                    }`}
              </button>
            </div>
          </div>
        )}

        {/* --- 3. done -------------------------------------------------- */}
        {effectiveStage === 'done' && result && (
          <div className="py-10 text-center space-y-3">
            <CheckCircle2
              className="w-12 h-12 text-brand-green-700 mx-auto"
              aria-hidden="true"
            />
            <h3 className="text-base font-bold text-slate-900">Import finished</h3>
            <p className="text-sm text-slate-700">
              <strong className="font-bold text-slate-900">{result.created}</strong> item
              {result.created === 1 ? '' : 's'} added and{' '}
              <strong className="font-bold text-slate-900">{result.updated}</strong> updated for{' '}
              {section ? SCHOOL_LABEL[section] : 'this school'}.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
              >
                Import another file
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
