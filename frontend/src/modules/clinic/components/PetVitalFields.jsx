import { PET_VITAL_FIELDS } from '../config/petVitals.js';

const byKind = (kind) => PET_VITAL_FIELDS.filter((f) => f.kind === kind);

/**
 * Pet clinical examination inputs: readings in one row, short findings in a
 * second row (with suggestions), long examinations as two text areas.
 * `values` is keyed by field key; `onChange(key, value)` updates one field.
 * `singleRow` puts readings and findings together on one row on wide
 * screens, with short labels (the full label shows on hover).
 */
export default function PetVitalFields({ values, onChange, idPrefix = 'pv', compact = false, withComments = false, singleRow = false }) {
  const set = (key) => (e) => onChange(key, e.target.value);

  const shortLabel = (f) => (f.short && f.unit ? `${f.short} (${f.unit})` : f.short && f.kind === 'number' ? f.short : f.label);

  const renderInput = (f) => (
    <div key={f.key} className="min-w-0">
      <label className={`label ${singleRow ? 'truncate' : ''}`} htmlFor={`${idPrefix}-${f.key}`} title={f.label}>
        {singleRow ? shortLabel(f) : f.label}
      </label>
      <input
        id={`${idPrefix}-${f.key}`}
        type={f.kind === 'number' ? 'number' : 'text'}
        step={f.step}
        min={f.kind === 'number' ? '0' : undefined}
        maxLength={f.maxLength}
        className={`input ${singleRow ? 'px-2' : ''}`}
        value={values[f.key] ?? ''}
        onChange={set(f.key)}
        placeholder={singleRow ? '' : f.placeholder || (f.options ? `e.g. ${f.options[0]}` : '')}
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
    <div className="space-y-2">
      {singleRow ? (
        <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-11">
          {[...readings, ...findings].map(renderInput)}
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 ${compact ? 'lg:grid-cols-3' : 'lg:grid-cols-7'}`}>
            {readings.map(renderInput)}
          </div>
          <div className={`grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 ${compact ? '' : 'lg:grid-cols-4'}`}>
            {findings.map(renderInput)}
          </div>
        </>
      )}
      <div className={`grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 ${withComments && !compact ? 'lg:grid-cols-3' : ''}`}>
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
        {withComments && (
          <div>
            <label className="label" htmlFor={`${idPrefix}-comments`}>Comments</label>
            <textarea
              id={`${idPrefix}-comments`}
              className="input"
              rows={2}
              maxLength={1000}
              value={values.comments ?? ''}
              onChange={set('comments')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
