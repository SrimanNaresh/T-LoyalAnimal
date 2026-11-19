import { PET_VITAL_FIELDS } from '../config/petVitals.js';

// Field label without the unit in brackets, e.g. "Temperature (°C)" -> "Temperature".
const plainLabel = (f) => f.label.replace(/\s*\(.*\)$/, '');
const hasValue = (v) => v != null && String(v).trim() !== '';

// Same grouping as the Vital Sign form: readings, findings, examinations.
const READINGS = PET_VITAL_FIELDS.filter((f) => f.kind === 'number' || (f.kind === 'text' && !f.options));
const FINDINGS = PET_VITAL_FIELDS.filter((f) => f.kind === 'text' && f.options);
const EXAMS = PET_VITAL_FIELDS.filter((f) => f.kind === 'textarea');
const COMMENTS = { key: 'comments', col: 'Comments', label: 'Comments' };

const Tile = ({ f, vital }) => {
  const v = vital?.[f.col];
  const filled = hasValue(v);
  return (
    <span className="rounded-md border border-slate-100 bg-white px-2 py-1.5 text-sm text-slate-700">
      <small className="block text-[10px] uppercase text-slate-400">{plainLabel(f)}</small>
      <strong className={filled ? 'font-semibold' : 'font-normal text-slate-300'}>
        {filled ? v : '-'}
        {filled && f.unit && <small className="ml-0.5 font-normal text-slate-500">{f.unit}</small>}
      </strong>
    </span>
  );
};

const Note = ({ f, vital }) => {
  const v = vital?.[f.col];
  const filled = hasValue(v);
  return (
    <div className="rounded-md border border-slate-100 bg-white px-2 py-1.5 text-sm text-slate-700">
      <small className="block text-[10px] uppercase text-slate-400">{f.label}</small>
      <p className={`whitespace-pre-wrap ${filled ? '' : 'text-slate-300'}`}>{filled ? v : '-'}</p>
    </div>
  );
};

/**
 * Read-only view of one VitalSign row using the pet examination fields.
 * showAll: list every field (blank ones as "-"), laid out like the form.
 * Otherwise only the fields that were filled in are shown.
 */
export default function PetVitalSummary({ vital, showAll = false }) {
  const keep = (list) => (showAll ? list : list.filter((f) => hasValue(vital?.[f.col])));
  const readings = keep(READINGS);
  const findings = keep(FINDINGS);
  const notes = keep([...EXAMS, COMMENTS]);

  if (!readings.length && !findings.length && !notes.length) {
    return <p className="text-sm text-slate-400">No examination details entered.</p>;
  }

  return (
    <div className="space-y-2">
      {readings.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {readings.map((f) => <Tile key={f.key} f={f} vital={vital} />)}
        </div>
      )}
      {findings.length > 0 && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {findings.map((f) => <Tile key={f.key} f={f} vital={vital} />)}
        </div>
      )}
      {notes.length > 0 && (
        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${showAll ? 'lg:grid-cols-3' : ''}`}>
          {notes.map((f) => <Note key={f.key} f={f} vital={vital} />)}
        </div>
      )}
    </div>
  );
}
