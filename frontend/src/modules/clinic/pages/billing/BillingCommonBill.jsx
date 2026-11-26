import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Receipt, Save, X, Plus, Trash2, List, Printer } from 'lucide-react';
import { PageHeader, CardHeader, Toast, Modal } from '../../../../components/ui.jsx';
import SearchSelect from '../../../../components/SearchSelect.jsx';
import FeeTypeSelect from '../../components/FeeTypeSelect.jsx';
import CommonBillPrint, { useLetterPadHeader } from '../../components/CommonBillPrint.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { commonBillApi, patientApi, clinicApi } from '../../api.js';
import { localDateKey } from '../../../../utils/localDate.js';

const fmtMoney = (n) => `₹${Number(n || 0).toFixed(2)}`;
const petLabel = (p) => {
  const name = p.Name || `${p.OwnerName || 'Owner'}'s pet`;
  const extra = [p.OwnerName && p.Name ? p.OwnerName : null, p.MobileNo].filter(Boolean).join(' · ');
  return extra ? `${name} (${extra})` : name;
};
let lineSeq = 0;
const newLine = (feeTypeId = '', amount = '') => ({ key: ++lineSeq, feeTypeId: String(feeTypeId), amount: String(amount) });
const emptyForm = () => ({ id: null, patientId: '', lines: [newLine()] });

export default function BillingCommonBill() {
  const { toast, show } = useToast();
  const navigate = useNavigate();
  // Opened from Common Bill List's Edit: ?edit=<bill id>&date=<YYYY-MM-DD>
  const [params] = useSearchParams();
  const editId = Number(params.get('edit')) || null;
  const [date, setDate] = useState(params.get('date') || localDateKey());
  const [patients, setPatients] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  // Fee Type Add / Edit modal: { mode: 'add' | 'edit', lineKey, feeTypeId?, name }
  const [feeModal, setFeeModal] = useState(null);
  // Quick "Add New" patient from the Patient Name search: { name, mobile }
  const [newPatient, setNewPatient] = useState(null);
  const [savingPatient, setSavingPatient] = useState(false);
  // Print: header strip from the saved letter pad image, and the bill to print.
  const [letterPad, setLetterPad] = useState('');
  const headerImage = useLetterPadHeader(letterPad);
  const [printBill, setPrintBill] = useState(null);

  const errMsg = (err, fallback) => err.response?.data?.error || fallback;

  const loadFeeTypes = () => commonBillApi.feeTypes().then(setFeeTypes).catch(() => setFeeTypes([]));

  useEffect(() => {
    patientApi.list({}).then(setPatients).catch(() => setPatients([]));
    loadFeeTypes();
    clinicApi.get().then((c) => setLetterPad(c?.PrescriptionAttachment || '')).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Lines ----
  const setLine = (key, field, value) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)) }));
  // Row "+" adds a line below and puts the cursor on its Fee Type.
  const [focusLine, setFocusLine] = useState(null);
  const insertLineAfter = (key) => {
    const line = newLine();
    setForm((f) => {
      const i = f.lines.findIndex((l) => l.key === key);
      const lines = [...f.lines];
      lines.splice(i + 1, 0, line);
      return { ...f, lines };
    });
    setFocusLine(line.key);
  };
  useEffect(() => {
    if (focusLine == null) return;
    document.querySelector(`[data-fee-line="${focusLine}"] button`)?.focus();
    setFocusLine(null);
  }, [focusLine]);
  const removeLine = (key) =>
    setForm((f) => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((l) => l.key !== key) : [newLine()] }));
  const lineTotal = form.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const cancel = () => (form.id ? navigate('/clinic/billing/common-bill-list') : setForm(emptyForm()));

  const save = async (e) => {
    e.preventDefault();
    if (!form.patientId) return show('Select a patient', 'error');
    // Fully blank lines are ignored; half-filled ones must be completed.
    const lines = form.lines.filter((l) => l.feeTypeId || l.amount);
    if (!lines.length) return show('Add at least one fee type and amount', 'error');
    if (lines.some((l) => !l.feeTypeId)) return show('Select a fee type on every line', 'error');
    if (new Set(lines.map((l) => l.feeTypeId)).size !== lines.length) return show('Each fee type can be used only once per bill', 'error');
    if (lines.some((l) => !(Number(l.amount) > 0))) return show('Enter an amount on every line', 'error');
    setSaving(true);
    try {
      const data = {
        patientId: form.patientId,
        date,
        items: lines.map((l) => ({ feeTypeId: Number(l.feeTypeId), amount: Number(l.amount) })),
      };
      if (form.id) await commonBillApi.update(form.id, data);
      else await commonBillApi.create(data);
      if (form.id) {
        // An edit came from the list: go back to it.
        navigate('/clinic/billing/common-bill-list');
        return;
      }
      show('Bill saved', 'success');
      setForm(emptyForm());
    } catch (err) {
      show(errMsg(err, 'Save failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!printBill) return undefined;
    const t = setTimeout(() => window.print(), 100);
    const done = () => setPrintBill(null);
    window.addEventListener('afterprint', done);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printBill]);

  // Print what is on the form now (saved or not).
  const printForm = () => {
    const p = patients.find((x) => x.PatientId === form.patientId);
    if (!p) return show('Select a patient', 'error');
    const lines = form.lines.filter((l) => l.feeTypeId && Number(l.amount) > 0);
    if (!lines.length) return show('Add at least one fee type and amount', 'error');
    return setPrintBill({
      billNo: form.id,
      date,
      patientName: p.Name,
      ownerName: p.OwnerName,
      mobileNo: p.MobileNo,
      items: lines.map((l) => ({ name: feeTypes.find((f) => String(f.FeeTypeId) === l.feeTypeId)?.Name, amount: l.amount })),
    });
  };

  useEffect(() => {
    if (!editId) return;
    commonBillApi.list(date).then((list) => {
      const b = list.find((x) => x.CommonBillId === editId);
      if (!b) { show('Bill not found', 'error'); return; }
      setForm({
        id: b.CommonBillId,
        patientId: b.PatientId,
        lines: b.items.length ? b.items.map((it) => newLine(it.FeeTypeId, Number(it.Amount))) : [newLine()],
      });
    }).catch((err) => show(errMsg(err, 'Failed to load bill'), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const savePatient = async (e) => {
    e.preventDefault();
    const name = newPatient.name.trim();
    if (!name) return show('Enter the patient name', 'error');
    if (newPatient.mobile.length !== 10) return show('Enter a 10-digit mobile number', 'error');
    setSavingPatient(true);
    try {
      const p = await patientApi.create({ name, mobileNo: newPatient.mobile });
      setPatients((list) => [p, ...list]);
      setForm((f) => ({ ...f, patientId: p.PatientId }));
      setNewPatient(null);
      show('Patient added', 'success');
    } catch (err) {
      show(errMsg(err, 'Could not add patient'), 'error');
    } finally {
      setSavingPatient(false);
    }
  };

  // ---- Fee Type Add / Edit / Delete (from inside each line's dropdown) ----
  const saveFeeType = async (e) => {
    e.preventDefault();
    const name = feeModal.name.trim();
    if (!name) return show('Enter a fee type name', 'error');
    try {
      const saved = feeModal.mode === 'edit'
        ? await commonBillApi.editFeeType(feeModal.feeTypeId, name)
        : await commonBillApi.addFeeType(name);
      await loadFeeTypes();
      setLine(feeModal.lineKey, 'feeTypeId', String(saved.FeeTypeId));
      show(feeModal.mode === 'edit' ? 'Fee type updated' : 'Fee type added', 'success');
      setFeeModal(null);
    } catch (err) {
      show(errMsg(err, 'Could not save fee type'), 'error');
    }
  };
  const deleteFeeType = async (fee) => {
    if (!window.confirm(`Delete fee type "${fee.Name}"?`)) return;
    const id = String(fee.FeeTypeId);
    try {
      await commonBillApi.deleteFeeType(fee.FeeTypeId);
      setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.feeTypeId === id ? { ...l, feeTypeId: '' } : l)) }));
      await loadFeeTypes();
      show('Fee type deleted', 'success');
    } catch (err) {
      show(errMsg(err, 'Could not delete fee type'), 'error');
    }
  };

  return (
    <div>
      <div className={printBill ? 'print:hidden' : ''}>
      <PageHeader
        title="Billing - Common Bill"
        actions={(
          <button type="button" className="btn-secondary" onClick={() => navigate('/clinic/billing/common-bill-list')}>
            <List size={16} /> Bill List
          </button>
        )}
      />

      <form className="card" onSubmit={save}>
        <CardHeader
          icon={Receipt}
          title={form.id ? 'Edit Common Bill' : 'Common Bill'}
          subtitle={form.id ? 'Change the details and press Update' : 'Patient, then one line per fee'}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label">Date</label>
            <input
              type="date" className="input" value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Patient Name</label>
            <SearchSelect
              options={patients.map((p) => ({ value: p.PatientId, label: petLabel(p) }))}
              value={form.patientId}
              onChange={(v) => setForm((f) => ({ ...f, patientId: v }))}
              placeholder="Select patient"
              searchPlaceholder="Search pet / owner / mobile..."
              onAddNew={(q) => {
                const digits = q.replace(/\D/g, '');
                setNewPatient(digits && digits.length === q.replace(/\s/g, '').length
                  ? { name: '', mobile: digits.slice(0, 10) }
                  : { name: q.replace(/[^A-Za-z\s]/g, '').replace(/\s{2,}/g, ' '), mobile: '' });
              }}
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-13">
            <thead>
              <tr className="table-head">
                <th className="w-10 rounded-l-lg px-2.5 py-1.5">#</th>
                <th className="px-2.5 py-1.5">Fee Type</th>
                <th className="w-40 px-2.5 py-1.5 text-right">Amount</th>
                <th className="w-24 rounded-r-lg px-2.5 py-1.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={l.key} className="table-row">
                  <td className="px-2.5 py-1 text-slate-500">{i + 1}</td>
                  <td className="px-2.5 py-1" data-fee-line={l.key}>
                    <FeeTypeSelect
                      // A fee type picked on another line is left out, so a bill never lists it twice.
                      options={feeTypes.filter((f) => String(f.FeeTypeId) === l.feeTypeId
                        || !form.lines.some((o) => o.key !== l.key && o.feeTypeId === String(f.FeeTypeId)))}
                      value={l.feeTypeId}
                      onChange={(v) => setLine(l.key, 'feeTypeId', v)}
                      onAdd={() => setFeeModal({ mode: 'add', lineKey: l.key, name: '' })}
                      onEdit={(f) => setFeeModal({ mode: 'edit', lineKey: l.key, feeTypeId: f.FeeTypeId, name: f.Name })}
                      onDelete={(f) => deleteFeeType(f)}
                    />
                  </td>
                  <td className="px-2.5 py-1 text-right">
                    <input
                      type="number" min="0" step="0.01" className="input w-36 py-1.5 text-right" placeholder="0.00"
                      value={l.amount} onChange={(e) => setLine(l.key, 'amount', e.target.value)}
                    />
                  </td>
                  <td className="px-2.5 py-1">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn-ghost !p-1.5 text-brand-600 hover:bg-brand-50" title="Add a line below"
                        onClick={() => insertLineAfter(l.key)}>
                        <Plus size={15} />
                      </button>
                      <button type="button" className="btn-ghost !p-1.5 text-red-600 hover:bg-red-50" title="Delete this line"
                        onClick={() => removeLine(l.key)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200 text-sm font-semibold text-slate-800">
                <td className="px-2.5 py-1.5" colSpan={2} />
                <td className="px-2.5 py-1.5 text-right">Total {fmtMoney(lineTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={cancel}>
            <X size={16} /> Cancel
          </button>
          <button type="button" className="btn-secondary" onClick={printForm}>
            <Printer size={16} /> Print
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : form.id ? 'Update' : 'Save'}
          </button>
        </div>
      </form>

      <Modal open={!!feeModal} onClose={() => setFeeModal(null)} title={feeModal?.mode === 'edit' ? 'Edit Fee Type' : 'Add Fee Type'}>
        {feeModal && (
          <form onSubmit={saveFeeType}>
            <label className="label">Fee Type Name</label>
            <input
              autoFocus className="input" maxLength={100} value={feeModal.name}
              onChange={(e) => setFeeModal((m) => ({ ...m, name: e.target.value }))}
              placeholder="e.g. Grooming, Vaccination"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setFeeModal(null)}><X size={16} /> Cancel</button>
              <button type="submit" className="btn-primary"><Save size={16} /> Save</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!newPatient} onClose={() => setNewPatient(null)} title="Add New Patient">
        {newPatient && (
          <form onSubmit={savePatient}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Patient Name</label>
                <input
                  autoFocus className="input" maxLength={100} value={newPatient.name}
                  onChange={(e) => setNewPatient((p) => ({ ...p, name: e.target.value.replace(/[^A-Za-z\s]/g, '').replace(/\s{2,}/g, ' ') }))}
                  placeholder="Patient name"
                />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input
                  className="input" inputMode="numeric" value={newPatient.mobile}
                  onChange={(e) => setNewPatient((p) => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="10-digit mobile"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setNewPatient(null)}><X size={16} /> Cancel</button>
              <button type="submit" className="btn-primary" disabled={savingPatient}>
                <Save size={16} /> {savingPatient ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      </div>

      {printBill && <CommonBillPrint headerImage={headerImage} bill={printBill} />}

      <Toast toast={toast} />
    </div>
  );
}
