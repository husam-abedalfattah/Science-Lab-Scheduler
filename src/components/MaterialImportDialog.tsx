import React, { useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Lab, Material, Section } from '../types';
import {
  MATERIAL_FIELDS,
  MaterialField,
  ParsedRow,
  RowError,
  buildRows,
  guessMapping
} from '../utils/materialImport';
import { MAX_MATERIAL_IMPORT_ROWS } from '../constants';
import { useModalA11y } from '../hooks/useModalA11y';

interface MaterialImportDialogProps {
  isOpen: boolean;
  section: Section;
  labs: Lab[];
  existing: Material[];
  onClose: () => void;
  onImport: (rows: ParsedRow[]) => Promise<{ created: number; updated: number }>;
}

type Stage = 'pick' | 'map' | 'done';

/**
 * Spreadsheet import.
 *
 * Three deliberate properties:
 *
 * 1. **The mapping is shown, not assumed.** Headers are guessed, but the guess
 *    is presented as editable dropdowns before anything is written. A silent
 *    mis-map would file every chemical in the wrong place at once.
 * 2. **Bad rows are named, not dropped quietly.** Each rejection carries its
 *    sheet line number and the reason, so the fix is "look at line 34" rather
 *    than "some of my items are missing".
 * 3. **Nothing is written until the user presses the button** on a screen that
 *    states exactly how many rows will be created and updated.
 *
 * The parser itself lives in utils/materialImport.ts and is covered by
 * `npm run verify:import`.
 */
export const MaterialImportDialog: React.FC<MaterialImportDialogProps> = ({
  isOpen,
  section,
  labs,
  existing,
  onClose,
  onImport
}) => {
  const panelRef = useModalA11y(isOpen, onClose);
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('pick');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<(MaterialField | null)[]>([]);
  const [parseError, setParseError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  const reset = () => {
    setStage('pick');
    setFileName('');
    setHeaders([]);
    setDataRows([]);
    setMapping([]);
    setParseError('');
    setResult(null);
    setIsBusy(false);
  };

  if (!isOpen) return null;

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
      // `readSheet`, not the default export: in v9 the default returns every
      // sheet as `{ sheet, data }` objects, so treating its result as rows
      // fails with "head.map is not a function". `readSheet` returns the rows
      // of one sheet (the first, by default), which is what we want.
      const { readSheet } = await import('read-excel-file/browser');
      const sheet = (await readSheet(file)) as unknown[][];

      if (!sheet.length) {
        setParseError('That sheet is empty.');
        return;
      }
      const [head, ...body] = sheet;
      if (body.length > MAX_MATERIAL_IMPORT_ROWS) {
        setParseError(
          `That file has ${body.length} rows; the limit is ${MAX_MATERIAL_IMPORT_ROWS}. ` +
            'Split it and import in parts.'
        );
        return;
      }

      setFileName(file.name);
      setHeaders(head.map(h => String(h ?? '').trim()));
      setDataRows(body);
      setMapping(guessMapping(head));
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

  const preview = stage === 'map' ? buildRows(dataRows, mapping, labs) : null;
  const missingRequired = MATERIAL_FIELDS.filter(
    f => f.required && !mapping.includes(f.id)
  );

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

        {/* --- 1. pick a file ------------------------------------------- */}
        {stage === 'pick' && (
          <div className="py-6 space-y-4">
            <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-slate-700 mb-4">
                Choose an <strong className="font-bold">.xlsx</strong> workbook. The first sheet is
                read, and the first row is treated as headings.
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
                disabled={isBusy}
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

        {/* --- 2. confirm the mapping ----------------------------------- */}
        {stage === 'map' && preview && (
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-700">
              <strong className="font-bold text-slate-900">{fileName}</strong> — {dataRows.length}{' '}
              row{dataRows.length === 1 ? '' : 's'}. Check each column is pointed at the right
              field.
            </p>

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
                      <td className="p-2.5 font-semibold text-slate-900">{h || <em>(blank)</em>}</td>
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

            {missingRequired.length > 0 && (
              <p
                role="alert"
                className="text-sm font-semibold text-brand-coral-800 flex items-start gap-1.5"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
                <span>
                  Still need a column for: {missingRequired.map(f => f.label).join(', ')}.
                </span>
              </p>
            )}

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

            {preview.errors.length > 0 && (
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

            {parseError && (
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
                disabled={isBusy || preview.rows.length === 0 || missingRequired.length > 0}
                className="px-5 py-2 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white font-bold rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBusy ? 'Importing…' : `Import ${preview.rows.length} item${preview.rows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        )}

        {/* --- 3. done -------------------------------------------------- */}
        {stage === 'done' && result && (
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
              {section === 'boys' ? 'the Boys School' : 'the Girls School'}.
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
