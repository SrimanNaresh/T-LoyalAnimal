import { Pencil, Trash2, Eye, Download, ChevronDown, Activity, Pill, Paperclip, ClipboardList } from 'lucide-react';
import { PET_VITAL_FIELDS } from '../config/petVitals.js';

// One date of a pet's Patient History, laid out as a printed-style report:
// bordered "label | value" tables for vitals and examination, a numbered
// medicine table and an attachment table. Blank values read as "-".

const fmt = (d) => (d ? new Date(d).toLocaleString() : '-');
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const blank = (v) => v == null || String(v).trim() === '';
const plainLabel = (label) => label.replace(/\s*\(.*\)$/, '');

const VITAL_ROWS = [
  ...PET_VITAL_FIELDS.map((f) => ({ label: plainLabel(f.label), col: f.col, unit: f.unit, long: f.kind === 'textarea' })),
  { label: 'Comments', col: 'Comments', long: true },
];

const th = 'border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs font-semibold text-slate-600';
const td = 'border border-slate-200 px-2.5 py-1.5 align-top text-sm text-slate-700';
const labelTd = 'w-40 border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 align-top text-xs font-semibold text-slate-500';

const Value = ({ v, unit }) =>
  blank(v) ? <span className="text-slate-300">-</span> : <span className="whitespace-pre-wrap">{v}{unit ? ` ${unit}` : ''}</span>;

const SectionTitle = ({ children, right }) => (
  <div className="mb-1.5 mt-4 flex items-center justify-between gap-2 border-b border-slate-300 pb-1 first:mt-0">
    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">{children}</h5>
    {right}
  </div>
);

function VitalTable({ vital }) {
  const short = VITAL_ROWS.filter((r) => !r.long);
  const long = VITAL_ROWS.filter((r) => r.long);
  // Short readings two pairs per row (Label | Value | Label | Value).
  const pairs = [];
  for (let i = 0; i < short.length; i += 2) pairs.push(short.slice(i, i + 2));
  return (
    <table className="w-full border-collapse">
      <tbody>
        {pairs.map((pair) => (
          <tr key={pair[0].col}>
            {pair.map((r) => (
              <Cells key={r.col} r={r} vital={vital} />
            ))}
            {pair.length === 1 && <td className={td} colSpan={2} />}
          </tr>
        ))}
        {long.map((r) => (
          <tr key={r.col}>
            <td className={labelTd}>{r.label}</td>
            <td className={td} colSpan={3}><Value v={vital?.[r.col]} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Cells = ({ r, vital }) => (
  <>
    <td className={labelTd}>{r.label}</td>
    <td className={td}><Value v={vital?.[r.col]} unit={r.unit} /></td>
  </>
);

// Summary chip for the collapsed date row.
const Chip = ({ icon: Icon, children, on }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${on ? 'bg-white text-slate-600 ring-1 ring-slate-200' : 'text-slate-300'}`}>
    <Icon size={11} /> {children}
  </span>
);

export default function HistoryReportDay({ dateLabel, isToday, open, onToggle, vitals, prescriptions, docs, onEdit, onDelete, onPreview, onDownload }) {
  const medCount = prescriptions.reduce((n, p) => n + (p.items?.length || 0), 0);
  return (
    <section className="rounded-lg border border-slate-300 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full flex-wrap items-center gap-2 px-4 py-2 text-left ${open ? 'border-b border-slate-300' : 'rounded-lg'} ${isToday ? 'bg-brand-50' : 'bg-slate-100 hover:bg-slate-200/70'}`}
      >
        <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} />
        <h4 className="text-sm font-bold text-slate-800">Visit Date: {dateLabel}</h4>
        {isToday && <span className="badge bg-brand-100 text-brand-700">Current Date</span>}
        <span className="ml-auto flex flex-wrap gap-1.5">
          <Chip icon={Activity} on={vitals.length > 0}>Vitals</Chip>
          <Chip icon={ClipboardList} on={prescriptions.length > 0}>Examination</Chip>
          <Chip icon={Pill} on={medCount > 0}>{medCount} Medicine{medCount === 1 ? '' : 's'}</Chip>
          <Chip icon={Paperclip} on={docs.length > 0}>{docs.length} Attachment{docs.length === 1 ? '' : 's'}</Chip>
        </span>
      </button>

      {open && (
      <div className="px-4 py-3">
        <SectionTitle>Vital Signs</SectionTitle>
        {vitals.length === 0 ? (
          <p className="text-sm text-slate-400">No vital signs recorded.</p>
        ) : (
          vitals.map((v) => (
            <div key={v.VitalId} className="mb-2 last:mb-0">
              {vitals.length > 1 && <p className="mb-1 text-xs text-slate-400">Recorded at {fmtTime(v.RecordedAt)}</p>}
              <VitalTable vital={v} />
            </div>
          ))
        )}

        {prescriptions.length === 0 ? (
          <>
            <SectionTitle>Examination</SectionTitle>
            <p className="text-sm text-slate-400">No examination recorded.</p>
          </>
        ) : (
          prescriptions.map((p, i) => (
            <div key={p.PrescriptionId}>
              <SectionTitle
                right={
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-normal text-slate-400">{fmt(p.CreatedAt)}</span>
                    {isToday && (
                      <>
                        <button type="button" className="btn-ghost px-1.5 py-0.5" title="Edit prescription" onClick={() => onEdit(p)}><Pencil size={13} /></button>
                        <button type="button" className="btn-ghost px-1.5 py-0.5 text-red-500 hover:bg-red-50" title="Delete prescription" onClick={() => onDelete(p)}><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                }
              >
                Examination{prescriptions.length > 1 ? ` ${i + 1}` : ''}
              </SectionTitle>
              <table className="w-full border-collapse">
                <tbody>
                  <tr><td className={labelTd}>History</td><td className={td}><Value v={p.CaseHistory} /></td></tr>
                  <tr><td className={labelTd}>Observation</td><td className={td}><Value v={p.Observation} /></td></tr>
                  <tr><td className={labelTd}>Notes / Advice</td><td className={td}><Value v={p.Notes} /></td></tr>
                  <tr><td className={labelTd}>Lab Tests</td><td className={td}><Value v={p.labTests?.map((t) => t.TestName).join(', ')} /></td></tr>
                  <tr><td className={labelTd}>Next Visit Date</td><td className={td}><Value v={p.NextVisitDate ? new Date(p.NextVisitDate).toLocaleDateString() : ''} /></td></tr>
                </tbody>
              </table>

              <SectionTitle>Medicines</SectionTitle>
              {p.items?.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={`${th} w-12`}>S.No</th>
                      <th className={th}>Medicine</th>
                      <th className={th}>M / A / E / N</th>
                      <th className={th}>AF / BF</th>
                      <th className={th}>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.items.map((it, n) => (
                      <tr key={it.ItemId}>
                        <td className={td}>{n + 1}</td>
                        <td className={`${td} font-medium`}>{it.MedicineName}</td>
                        <td className={td}><Value v={it.Frequency} /></td>
                        <td className={td}><Value v={it.Instructions} /></td>
                        <td className={td}><Value v={it.Duration} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-400">No medicines prescribed.</p>
              )}
            </div>
          ))
        )}

        <SectionTitle>Attachments</SectionTitle>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-400">No attachments.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-12`}>S.No</th>
                <th className={th}>File</th>
                <th className={th}>Category</th>
                <th className={`${th} w-24 text-center`}>View</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d, n) => (
                <tr key={d.DocumentId}>
                  <td className={td}>{n + 1}</td>
                  <td className={`${td} break-all`}>{d.FileName}</td>
                  <td className={td}>{d.Category || 'Document'}</td>
                  <td className={`${td} text-center`}>
                    <button type="button" className="btn-ghost px-1.5 py-0.5" title="Preview" onClick={() => onPreview(d)}><Eye size={14} /></button>
                    <button type="button" className="btn-ghost px-1.5 py-0.5" title="Download" onClick={() => onDownload(d)}><Download size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
    </section>
  );
}
