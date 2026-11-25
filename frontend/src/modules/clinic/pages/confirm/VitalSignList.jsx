import { useEffect, useState, useCallback } from 'react';
import { Search, Pencil, Save, Activity } from 'lucide-react';
import { Spinner, EmptyState, Modal, Toast, CardHeader } from '../../../../components/ui.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { vitalApi } from '../../api.js';
import PetVitalFields from '../../components/PetVitalFields.jsx';
import { PET_VITAL_FIELDS, petVitalsFromRow, petVitalsPayload } from '../../config/petVitals.js';
import { localDateKey } from '../../../../utils/localDate.js';

const TABLE_FIELDS = PET_VITAL_FIELDS.filter((f) => f.short);

const fmt = (d) => (d ? new Date(d).toLocaleString() : '-');
const today = () => localDateKey();

export default function VitalSignList() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  // Only show today's vital records.
  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      setRows(await vitalApi.list({ search: q, date: today() }));
    } catch {
      show('Failed to load vital signs', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  const saveEdit = async () => {
    try {
      await vitalApi.update(editing.VitalId, petVitalsPayload(editing.values));
      show('Updated', 'success');
      setEditing(null);
      load(search);
    } catch {
      show('Update failed', 'error');
    }
  };

  return (
    <div>
      <div className="card">
        <CardHeader
          icon={Activity}
          title="Vital Sign List"
          subtitle="Today's recorded vital signs"
          actions={
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Search pet, owner or mobile..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          }
        />

        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState message="No vital signs found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-13">
              <thead>
                <tr className="table-head">
                  <th className="rounded-l-lg px-2.5 py-1.5">Pet</th>
                  {TABLE_FIELDS.map((f) => <th key={f.key} className="px-2.5 py-1.5">{f.short}</th>)}
                  <th className="px-2.5 py-1.5">Recorded</th>
                  <th className="rounded-r-lg px-2.5 py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.VitalId} className="table-row">
                    <td className="px-2.5 py-1">
                      <p className="font-medium text-slate-700">
                        {r.PatientName || `${r.OwnerName || 'Owner'}'s pet`}
                        {r.Species && <span className="ml-1 font-normal text-slate-400">({r.Species})</span>}
                      </p>
                      <p className="text-xs text-slate-400">{[r.OwnerName, r.MobileNo].filter(Boolean).join(' · ') || '-'}</p>
                    </td>
                    {TABLE_FIELDS.map((f) => <td key={f.key} className="px-2.5 py-1 text-slate-500">{r[f.col] ?? '-'}</td>)}
                    <td className="px-2.5 py-1 text-xs text-slate-400">{fmt(r.RecordedAt)}</td>
                    <td className="px-2.5 py-1">
                      <div className="flex justify-end">
                        <button className="btn-ghost !p-1" onClick={() => setEditing({ ...r, values: petVitalsFromRow(r) })}><Pencil size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Vital Sign" size="lg">
        {editing && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-600">{editing.PatientName || `${editing.OwnerName || 'Owner'}'s pet`}</p>
            <PetVitalFields
              idPrefix="pv-edit"
              compact
              values={editing.values}
              onChange={(k, v) => setEditing((e) => ({ ...e, values: { ...e.values, [k]: v } }))}
            />
            <div><label className="label">Comments</label><textarea className="input" rows={3} value={editing.values.comments ?? ''} onChange={(e) => { const v = e.target.value; setEditing((ed) => ({ ...ed, values: { ...ed.values, comments: v } })); }} /></div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit}><Save size={16} /> Save Changes</button>
            </div>
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
