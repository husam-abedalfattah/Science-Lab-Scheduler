import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  Package,
  Plus,
  Pencil,
  Trash2,
  FileSpreadsheet,
  AlertTriangle,
  MapPin,
  SearchX,
  Download
} from 'lucide-react';
import { Lab, Material, MaterialCategory, Section } from '../types';
import {
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  MATERIAL_HAZARDS,
  MAX_MATERIAL_NAME_LENGTH,
  MAX_MATERIAL_LOCATION_LENGTH,
  MAX_MATERIAL_CODE_LENGTH,
  MAX_MATERIAL_TEXT_LENGTH
} from '../constants';
import { useModalA11y } from '../hooks/useModalA11y';
import { downloadMaterialTemplate } from '../utils/materialTemplate';
import { SCHOOL_LABEL } from '../brand';

interface MaterialsModalProps {
  isOpen: boolean;
  /**
   * The school being browsed, or `null` when opened from the picker screen
   * before a school has been chosen. "Where is the sodium hydroxide" is a
   * question people arrive with before they care which timetable they are in,
   * so the stockroom is reachable without picking a school first -- it just
   * shows both, with the school named on every row.
   */
  section: Section | null;
  labsBySection: Record<Section, Lab[]>;
  materials: Material[];
  onClose: () => void;
  onSave: (
    material: Omit<Material, 'id' | 'updatedAt'> & { id?: string }
  ) => void;
  onDelete: (material: Material) => void;
  onOpenImport: () => void;
}

const inputClass =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-kingdom-500 focus:border-brand-kingdom-500 transition';
const labelClass = 'block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1';

type Draft = Omit<Material, 'id' | 'updatedAt'> & { id?: string };

const emptyDraft = (section: Section, labId: string): Draft => ({
  section,
  name: '',
  labId,
  location: '',
  code: '',
  category: undefined,
  quantity: undefined,
  unit: '',
  minQuantity: undefined,
  hazard: '',
  expiryDate: '',
  supplier: '',
  notes: ''
});

/** Low stock, expired, or expiring within a month. */
function flagsFor(m: Material): { low: boolean; expired: boolean; soon: boolean } {
  const low =
    typeof m.quantity === 'number' &&
    typeof m.minQuantity === 'number' &&
    m.quantity <= m.minQuantity;

  let expired = false;
  let soon = false;
  if (m.expiryDate) {
    const d = new Date(m.expiryDate);
    if (!isNaN(d.getTime())) {
      const days = (d.getTime() - Date.now()) / 86_400_000;
      expired = days < 0;
      soon = days >= 0 && days <= 30;
    }
  }
  return { low, expired, soon };
}

/**
 * The stockroom.
 *
 * Open to everyone, not gated behind the admin password, for the same reason
 * period blocking is not: the lab technician owns this data and does not hold
 * that password, and there is no per-user identity to gate on anyway. Search is
 * the common case, so it is the thing the modal opens on.
 *
 * Filtering is client-side over the whole collection. Firestore cannot do
 * substring search, and a school lab runs to hundreds of items — small enough
 * that holding them in memory is simpler and faster than paging.
 */
export const MaterialsModal: React.FC<MaterialsModalProps> = ({
  isOpen,
  section,
  labsBySection,
  materials,
  onClose,
  onSave,
  onDelete,
  onOpenImport
}) => {
  const panelRef = useModalA11y(isOpen, onClose);

  const [query, setQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<'ALL' | Section>('ALL');
  const [labFilter, setLabFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | MaterialCategory>('ALL');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [isBuildingTemplate, setIsBuildingTemplate] = useState(false);

  /** Which school(s) this view covers. */
  const scope: Section[] = section ? [section] : ['boys', 'girls'];

  /** Labs to offer in the form and the filter, for the schools in scope. */
  const labs = useMemo(
    () => scope.flatMap(sec => labsBySection[sec] || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labsBySection, section]
  );

  const mine = useMemo(
    () =>
      materials.filter(
        m =>
          scope.includes(m.section) &&
          (schoolFilter === 'ALL' || m.section === schoolFilter)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materials, section, schoolFilter]
  );

  // Resolved across both schools so a row always names its lab, even when the
  // modal is showing the two side by side.
  const labName = useMemo(() => {
    const map = new Map(
      (['boys', 'girls'] as Section[]).flatMap(sec =>
        (labsBySection[sec] || []).map(l => [l.id, l.name] as const)
      )
    );
    return (id: string) => map.get(id) || id;
  }, [labsBySection]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine
      .filter(m => {
        if (labFilter !== 'ALL' && m.labId !== labFilter) return false;
        if (categoryFilter !== 'ALL' && m.category !== categoryFilter) return false;
        if (!q) return true;
        return [m.name, m.code, m.location, m.supplier, m.notes, m.hazard, labName(m.labId)]
          .some(f => f?.toLowerCase().includes(q));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mine, query, labFilter, categoryFilter, labName]);

  if (!isOpen) return null;

  const startAdd = () => {
    setFormError('');
    const sec: Section = section || (schoolFilter === 'ALL' ? 'boys' : schoolFilter);
    setDraft(emptyDraft(sec, labsBySection[sec]?.[0]?.id || ''));
  };

  const startEdit = (m: Material) => {
    setFormError('');
    setDraft({ ...m });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.name.trim() || !draft.labId || !draft.location.trim()) {
      setFormError('Name, lab and location are all required.');
      return;
    }
    onSave({ ...draft, name: draft.name.trim(), location: draft.location.trim() });
    setDraft(null);
  };

  const lowCount = mine.filter(m => flagsFor(m).low).length;
  const expiredCount = mine.filter(m => flagsFor(m).expired).length;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="materials-title"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-5xl w-full p-6 max-h-[92vh] flex flex-col text-slate-900"
      >
        <div className="flex justify-between items-start pb-4 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-kingdom-700 text-white rounded-xl shrink-0">
              <Package className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="materials-title" className="text-lg font-bold text-slate-900">
                Lab materials
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {mine.length} item{mine.length === 1 ? '' : 's'}{' '}
                {section ? `in ${SCHOOL_LABEL[section]}` : 'across both schools'}
                {lowCount > 0 && (
                  <span className="text-brand-coral-800 font-semibold"> · {lowCount} low</span>
                )}
                {expiredCount > 0 && (
                  <span className="text-brand-coral-800 font-semibold">
                    {' '}
                    · {expiredCount} expired
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close materials"
            className="text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg p-1.5 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- search + filters + actions ------------------------------- */}
        <div className="flex flex-wrap items-center gap-2 py-3 border-b border-slate-200">
          <div className="relative flex-grow min-w-[12rem]">
            <label htmlFor="material-search" className="sr-only">
              Search materials
            </label>
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="material-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, code, location, supplier…"
              className={`${inputClass} pl-9`}
            />
          </div>

          {!section && (
            <>
              <label htmlFor="material-school" className="sr-only">
                Filter by school
              </label>
              <select
                id="material-school"
                value={schoolFilter}
                onChange={e => setSchoolFilter(e.target.value as 'ALL' | Section)}
                className={`${inputClass} w-auto min-w-[9rem] cursor-pointer`}
              >
                <option value="ALL">Both schools</option>
                <option value="boys">{SCHOOL_LABEL.boys}</option>
                <option value="girls">{SCHOOL_LABEL.girls}</option>
              </select>
            </>
          )}

          <label htmlFor="material-lab" className="sr-only">
            Filter by lab
          </label>
          <select
            id="material-lab"
            value={labFilter}
            onChange={e => setLabFilter(e.target.value)}
            className={`${inputClass} w-auto min-w-[9rem] cursor-pointer`}
          >
            <option value="ALL">All labs</option>
            {labs.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <label htmlFor="material-category" className="sr-only">
            Filter by category
          </label>
          <select
            id="material-category"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as 'ALL' | MaterialCategory)}
            className={`${inputClass} w-auto min-w-[9rem] cursor-pointer`}
          >
            <option value="ALL">All categories</option>
            {MATERIAL_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {/* The blank sheet to fill in. Its headings are exactly the ones the
              importer recognises, so a filled-in template comes straight back
              with no column mapping to do. */}
          <button
            type="button"
            onClick={() => {
              setIsBuildingTemplate(true);
              void downloadMaterialTemplate(section, labsBySection)
                .catch(err => console.error('Template download failed:', err))
                .finally(() => setIsBuildingTemplate(false));
            }}
            disabled={isBuildingTemplate}
            title="Download a blank Excel sheet to fill in"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {isBuildingTemplate ? 'Preparing…' : 'Excel template'}
            </span>
          </button>

          {/* An import writes into one school's stock, so it needs a school
              chosen -- from the picker screen there isn't one yet. */}
          <button
            type="button"
            onClick={onOpenImport}
            disabled={!section}
            title={
              section
                ? 'Import a stock list from Excel'
                : 'Open a school first — an import loads into one school'
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Import Excel</span>
          </button>

          <button
            type="button"
            onClick={startAdd}
            disabled={labs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={labs.length === 0 ? 'Add a lab first' : 'Add a material'}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add item</span>
          </button>
        </div>

        {/* --- list ----------------------------------------------------- */}
        <div className="flex-grow overflow-y-auto pt-3 pr-1">
          {mine.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 rounded-xl border border-slate-200 p-6">
              <Package className="w-10 h-10 text-slate-400 mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">No materials yet</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Add items one at a time, or import an existing stock list from Excel.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 rounded-xl border border-slate-200 p-6">
              <SearchX className="w-10 h-10 text-slate-400 mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">Nothing matches</h3>
              <p className="text-sm text-slate-600 mt-1">
                Try a different search, or clear the lab and category filters.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <caption className="sr-only">
                Materials in {section ? SCHOOL_LABEL[section] : 'both schools'}, {visible.length} shown
              </caption>
              <thead className="bg-slate-100 text-slate-800 text-xs uppercase tracking-wide">
                <tr>
                  <th scope="col" className="p-2.5 font-bold">Item</th>
                  <th scope="col" className="p-2.5 font-bold">Where</th>
                  <th scope="col" className="p-2.5 font-bold">Stock</th>
                  <th scope="col" className="p-2.5 font-bold text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visible.map(m => {
                  const f = flagsFor(m);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 align-top">
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                          {m.code && <span className="font-mono">{m.code}</span>}
                          {m.category && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300">
                              {MATERIAL_CATEGORIES.find(c => c.id === m.category)?.label}
                            </span>
                          )}
                          {m.hazard && (
                            <span className="px-1.5 py-0.5 rounded bg-brand-yellow-100 border border-brand-yellow-400 text-brand-yellow-950 font-semibold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                              {m.hazard}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-800">
                        <div className="flex items-start gap-1">
                          <MapPin
                            className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>
                            <span className="font-semibold">{m.location}</span>
                            <span className="block text-xs text-slate-600">
                              {labName(m.labId)}
                              {!section && ` · ${SCHOOL_LABEL[m.section]}`}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        {typeof m.quantity === 'number' ? (
                          <span
                            className={`font-bold ${
                              f.low ? 'text-brand-coral-800' : 'text-slate-900'
                            }`}
                          >
                            {m.quantity}
                            {m.unit ? ` ${m.unit}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {f.low && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-brand-coral-100 text-brand-coral-900 border border-brand-coral-400">
                              Low stock
                            </span>
                          )}
                          {f.expired && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-brand-coral-100 text-brand-coral-900 border border-brand-coral-400">
                              Expired
                            </span>
                          )}
                          {f.soon && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-brand-yellow-100 text-brand-yellow-950 border border-brand-yellow-400">
                              Expires soon
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            aria-label={`Edit ${m.name}`}
                            className="min-h-6 min-w-6 inline-flex items-center justify-center text-slate-700 hover:text-brand-kingdom-800 hover:bg-brand-kingdom-50 rounded transition"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(m)}
                            aria-label={`Delete ${m.name}`}
                            className="min-h-6 min-w-6 inline-flex items-center justify-center text-slate-700 hover:text-brand-coral-800 hover:bg-brand-coral-50 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* --- add / edit form ------------------------------------------ */}
        {draft && (
          <form
            onSubmit={submit}
            className="mt-3 pt-3 border-t-2 border-brand-kingdom-700 space-y-3"
          >
            <h3 className="text-sm font-bold text-brand-kingdom-800">
              {draft.id ? `Edit ${draft.name || 'item'}` : 'New item'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="m-name">Name *</label>
                <input
                  id="m-name"
                  className={inputClass}
                  maxLength={MAX_MATERIAL_NAME_LENGTH}
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="m-code">Item code</label>
                <input
                  id="m-code"
                  className={inputClass}
                  maxLength={MAX_MATERIAL_CODE_LENGTH}
                  value={draft.code || ''}
                  onChange={e => setDraft({ ...draft, code: e.target.value })}
                />
              </div>

              {!section && (
                <div>
                  <label className={labelClass} htmlFor="m-school">School *</label>
                  <select
                    id="m-school"
                    className={inputClass}
                    value={draft.section}
                    onChange={e => {
                      const sec = e.target.value as Section;
                      // The lab list belongs to the school, so reset it.
                      setDraft({ ...draft, section: sec, labId: labsBySection[sec]?.[0]?.id || '' });
                    }}
                  >
                    <option value="boys">{SCHOOL_LABEL.boys}</option>
                    <option value="girls">{SCHOOL_LABEL.girls}</option>
                  </select>
                </div>
              )}

              <div>
                <label className={labelClass} htmlFor="m-lab">Lab *</label>
                <select
                  id="m-lab"
                  className={inputClass}
                  value={draft.labId}
                  onChange={e => setDraft({ ...draft, labId: e.target.value })}
                >
                  {(labsBySection[draft.section] || []).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="m-location">Location in the lab *</label>
                <input
                  id="m-location"
                  className={inputClass}
                  maxLength={MAX_MATERIAL_LOCATION_LENGTH}
                  placeholder="e.g. Cabinet B, Shelf 3"
                  value={draft.location}
                  onChange={e => setDraft({ ...draft, location: e.target.value })}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="m-category">Category</label>
                <select
                  id="m-category"
                  className={inputClass}
                  value={draft.category || ''}
                  onChange={e =>
                    setDraft({
                      ...draft,
                      category: (e.target.value || undefined) as MaterialCategory | undefined
                    })
                  }
                >
                  <option value="">—</option>
                  {MATERIAL_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="m-qty">Quantity</label>
                <input
                  id="m-qty"
                  type="number"
                  min={0}
                  className={inputClass}
                  value={draft.quantity ?? ''}
                  onChange={e =>
                    setDraft({
                      ...draft,
                      quantity: e.target.value === '' ? undefined : Number(e.target.value)
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="m-unit">Unit</label>
                <input
                  id="m-unit"
                  list="material-units"
                  className={inputClass}
                  value={draft.unit || ''}
                  onChange={e => setDraft({ ...draft, unit: e.target.value })}
                />
                <datalist id="material-units">
                  {MATERIAL_UNITS.map(u => <option key={u} value={u} />)}
                </datalist>
              </div>

              <div>
                <label className={labelClass} htmlFor="m-min">
                  Minimum quantity
                </label>
                <input
                  id="m-min"
                  type="number"
                  min={0}
                  className={inputClass}
                  placeholder="Flags low stock"
                  value={draft.minQuantity ?? ''}
                  onChange={e =>
                    setDraft({
                      ...draft,
                      minQuantity: e.target.value === '' ? undefined : Number(e.target.value)
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="m-hazard">Hazard</label>
                <input
                  id="m-hazard"
                  list="material-hazards"
                  className={inputClass}
                  value={draft.hazard || ''}
                  onChange={e => setDraft({ ...draft, hazard: e.target.value })}
                />
                <datalist id="material-hazards">
                  {MATERIAL_HAZARDS.map(h => <option key={h} value={h} />)}
                </datalist>
              </div>
              <div>
                <label className={labelClass} htmlFor="m-expiry">Expiry date</label>
                <input
                  id="m-expiry"
                  type="date"
                  className={inputClass}
                  value={draft.expiryDate || ''}
                  onChange={e => setDraft({ ...draft, expiryDate: e.target.value })}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="m-supplier">Supplier</label>
                <input
                  id="m-supplier"
                  className={inputClass}
                  maxLength={MAX_MATERIAL_TEXT_LENGTH}
                  value={draft.supplier || ''}
                  onChange={e => setDraft({ ...draft, supplier: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="m-notes">Notes</label>
                <input
                  id="m-notes"
                  className={inputClass}
                  maxLength={MAX_MATERIAL_TEXT_LENGTH}
                  value={draft.notes || ''}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-semibold text-brand-coral-800">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-kingdom-700 hover:bg-brand-kingdom-800 text-white font-bold rounded-lg text-sm transition"
              >
                {draft.id ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
