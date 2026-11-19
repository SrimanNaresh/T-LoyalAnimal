import { PET_VITAL_FIELDS } from '../config/petVitals.js';

const byKind = (kind) => PET_VITAL_FIELDS.filter((f) => f.kind === kind);

/**
 * Pet clinical examination inputs: readings in one row, short findings in a
 * second row (with suggestions), long examinations as two text areas.
 * `values` is keyed by field key; `onChange(key, value)` updates one field.
 */
export default function PetVitalFields({ values, onChange, idPrefix = 'pv', compact = false }) {
  const set = (key) => (e) => onChange(key, e.target.value);

  const renderInput = (f) => (
    <div key={f.key}>
      <label className="label" htmlFor={`${idPrefix}-${f.key}`}>{f.label}</label>
      <input
        id={`${idPrefix}-${f.key}`}
        type={f.kind === 'number' ? 'number' : 'text'}
        step={f.step}
        min={f.kind === 'number' ? '0' : undefined}
        maxLength={f.maxLength}
        className="input"
        value={values[f.key] ?? ''}
        onChange={set(f.key)}
        placeholder={f.placeholder || (f.options ? `e.g. ${f.options[0]}` : '')}
        list={f.options ? `${idPrefix}-${f.key}-list` : undefined}
      />
      {f.options && (
        <datalist id={`${idPrefix}-${f.key}-list`}>
          {f.options.map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
    </div>
  );

  const readings = PET_VITAL_FIELDS.filter((f) => ['number'].includes(f.kind) || (f.kind === 'text' && !f.options));
  const findings = byKind('text').filter((f) => f.options);

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${compact ? 'lg:grid-cols-3' : 'lg:grid-cols-6'}`}>
        {readings.map(renderInput)}
      </div>
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${compact ? '' : 'lg:grid-cols-4'}`}>
        {findings.map(renderInput)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {byKind('textarea').map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={`${idPrefix}-${f.key}`}>{f.label}</label>
            <textarea
              id={`${idPrefix}-${f.key}`}
              className="input"
              rows={2}
              maxLength={f.maxLength}
              value={values[f.key] ?? ''}
              onChange={set(f.key)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
