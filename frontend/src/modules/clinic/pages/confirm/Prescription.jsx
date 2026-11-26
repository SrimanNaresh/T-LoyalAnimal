import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Save, Plus, Trash2, History, Activity, Pill, ClipboardList, ChevronRight, ArrowLeft, Search, CheckCircle2, Pencil, Printer, MessageCircle, Paperclip, Eye, Download, TestTube } from 'lucide-react';
import { PageHeader, Toast, Spinner, EmptyState, CardHeader } from '../../../../components/ui.jsx';
import PrescriptionReportPrint from '../../components/PrescriptionReportPrint.jsx';
import DocumentPreviewModal from '../../components/DocumentPreviewModal.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import HistoryReportDay from '../../components/HistoryReportDay.jsx';
import PetVitalFields from '../../components/PetVitalFields.jsx';
import { PET_VITAL_FIELDS, petVitalsFromRow, petVitalsPayload } from '../../config/petVitals.js';
import SearchSelect from '../../../../components/SearchSelect.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { prescriptionApi, confirmApi, clinicApi, patientApi, patientDocumentApi, vitalApi } from '../../api.js';
import { linkApi } from '../../../../api/client.js';
import { localDateKey } from '../../../../utils/localDate.js';

// Timing options with short labels (shown) + full names (tooltip / stored).
const TIMINGS = [
  { full: 'Morning', short: 'M' },
  { full: 'Afternoon', short: 'A' },
  { full: 'Evening', short: 'E' },
  { full: 'Night', short: 'N' },
];
const FOOD = ['AF', 'BF']; // AF = After Food, BF = Before Food
const emptyItem = { medicineName: '', timing: [], food: [], days: '' };
// M/A/E/N -> "1-0-0-1" style code for the printed prescription table.
const timingToCode = (timing) => TIMINGS.map((t) => (timing.includes(t.full) ? '1' : '0')).join('-');
const fmt = (d) => (d ? new Date(d).toLocaleString() : '-');
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-');
// Local calendar date (YYYY-MM-DD). toISOString() would use UTC and put early-morning
// records (before 5:30 AM in India) on the previous day.
const dateKey = (d) => (d ? localDateKey(new Date(d)) : 'unknown');
const dateLabel = (key) => (key === 'unknown' ? 'Unknown date' : new Date(`${key}T00:00:00`).toLocaleDateString());
const currentDateKey = () => localDateKey(new Date());
const EXAMINE_TABS = [
  { id: 'vitals', label: 'Observation', icon: Activity },
  { id: 'meds', label: 'Medications / Lab Test', icon: Pill },
  { id: 'history', label: 'Patient History', icon: History },
];

export default function Prescription() {
  const location = useLocation();
  const { toast, show } = useToast();
  const [selected, setSelected] = useState(location.state?.patient || null);
  const [notes, setNotes] = useState('');
  const [caseHistory, setCaseHistory] = useState('');
  const [treatment, setTreatment] = useState('');
  const [observation, setObservation] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [meds, setMeds] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [showLabTests, setShowLabTests] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [letterPadFields, setLetterPadFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);
  const [editingPrescription, setEditingPrescription] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [patientAge, setPatientAge] = useState(null);
  const [petRecord, setPetRecord] = useState(null); // full Patient row, for the Letter Pad print
  const [docs, setDocs] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [sending, setSending] = useState(false);
  // Examine screen tabs; Notes and the Hold / Completed buttons stay visible on every tab.
  const [tab, setTab] = useState('vitals');
  const [vitalEdit, setVitalEdit] = useState(null); // form values while editing today's vitals
  // Left-side tabs inside Medications / Lab Test.
  const [medsTab, setMedsTab] = useState('meds');
  useEffect(() => { setTab('vitals'); setMedsTab('meds'); }, [selected?.PatientId]);

  // Two lists for today: vital-completed (Pre-Examine) and examine-completed (Billing).
  const [readyList, setReadyList] = useState([]);
  const [doneList, setDoneList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [readySearch, setReadySearch] = useState('');
  const [doneSearch, setDoneSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { linkApi.medicines().then(setMeds) /* Pharmacy › Item list */.catch(() => setMeds([])); }, []);
  useEffect(() => { linkApi.labTests().then((rows) => setLabTests(rows.filter((r) => r.IsActive))) /* Lab Test Master */.catch(() => setLabTests([])); }, []);
  useEffect(() => {
    clinicApi.get()
      .then((c) => {
        setClinic(c);
        try { setLetterPadFields(c?.LetterPadFields ? JSON.parse(c.LetterPadFields) : []); } catch { setLetterPadFields([]); }
      })
      .catch(() => setClinic(null));
  }, []);

  const loadReadyList = useCallback(() => {
    setLoadingList(true);
    Promise.all([
      confirmApi.list(undefined, 'Pre-Examine').catch(() => []),
      confirmApi.list(undefined, 'Examine').catch(() => []),
      confirmApi.list(undefined, 'Billing').catch(() => []),
    ])
      .then(([preExamine, examine, done]) => {
        const ready = [...preExamine, ...examine].sort((a, b) => (a.TokenNo || 0) - (b.TokenNo || 0));
        setReadyList(ready);
        setDoneList(done);
      })
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => { loadReadyList(); }, [loadReadyList]);

  const filterRows = (rows, q) => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        (r.PatientName || '').toLowerCase().includes(t) ||
        (r.MobileNo || '').toLowerCase().includes(t) ||
        String(r.TokenNo || '').includes(t)
    );
  };

  // Opening a patient only selects them; status changes when the prescription is saved.
  const pickFromList = (r) => {
    setSelected({ PatientId: r.PatientId, Name: r.PatientName, MobileNo: r.MobileNo, Address: r.Address });
  };

  // autoEditToday: when opening a patient who already has a prescription started today,
  // load it into the form by default instead of leaving it blank.
  const loadHistory = useCallback((patientId, { autoEditToday = false } = {}) => {
    setLoadingHistory(true);
    prescriptionApi.history(patientId)
      .then((data) => {
        setHistory(data);
        if (autoEditToday) {
          const todays = data.prescriptions?.find((p) => dateKey(p.CreatedAt) === currentDateKey());
          if (todays) editPrescription(todays);
          else { setEditingPrescription(null); setNotes(''); setCaseHistory(''); setObservation(''); setTreatment(''); setItems([{ ...emptyItem }]); setNextVisitDate(''); setSelectedTestIds([]); setShowLabTests(false); }
        }
      })
      .catch(() => setHistory(null))
      .finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setVitalEdit(null);
    if (selected) loadHistory(selected.PatientId, { autoEditToday: true });
    else setHistory(null);
  }, [selected, loadHistory]);

  useEffect(() => {
    if (!selected) { setPetRecord(null); return setPatientAge(null); }
    patientApi.get(selected.PatientId)
      .then((p) => { setPatientAge(p.Age); setPetRecord(p); })
      .catch(() => { setPatientAge(null); setPetRecord(null); });
  }, [selected]);

  // Attachments (lab reports/scans from Vital Sign) — shown per-date
  // alongside that same date's vitals/prescriptions in Patient History below.
  useEffect(() => {
    if (!selected) return setDocs([]);
    patientDocumentApi.list(selected.PatientId).then(setDocs).catch(() => setDocs([]));
  }, [selected]);

  const updateItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const toggleInItem = (i, key, value) =>
    setItems((arr) =>
      arr.map((it, idx) => {
        if (idx !== i) return it;
        const list = it[key];
        return { ...it, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
      })
    );
  // AF/BF is either-or per medicine, so picking one clears the other instead of toggling independently.
  const setExclusiveInItem = (i, key, value) =>
    setItems((arr) =>
      arr.map((it, idx) => (idx === i ? { ...it, [key]: it[key].includes(value) ? [] : [value] } : it))
    );
  const addItem = () => setItems((arr) => [...arr, { ...emptyItem }]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  const editPrescription = (prescription) => {
    setEditingPrescription(prescription);
    setNotes(prescription.Notes || '');
    setCaseHistory(prescription.CaseHistory || '');
    setTreatment(prescription.Treatment || '');
    setObservation(prescription.Observation || '');
    setItems(prescription.items?.length ? prescription.items.map((item) => ({
      medicineName: item.MedicineName || '',
      timing: item.Frequency ? item.Frequency.split(',').map((value) => value.trim()).filter(Boolean) : [],
      food: item.Instructions ? item.Instructions.split(',').map((value) => value.trim()).filter((value) => FOOD.includes(value)) : [],
      days: item.Duration?.match(/\d+/)?.[0] || '',
    })) : [{ ...emptyItem }]);
    setNextVisitDate(prescription.NextVisitDate ? prescription.NextVisitDate.slice(0, 10) : '');
    const testIds = prescription.labTests?.map((t) => t.TestId) || [];
    setSelectedTestIds(testIds);
    setShowLabTests(testIds.length > 0);
  };

  const toggleTest = (testId) =>
    setSelectedTestIds((ids) => (ids.includes(testId) ? ids.filter((id) => id !== testId) : [...ids, testId]));
  const selectedTestNames = labTests.filter((t) => selectedTestIds.includes(t.TestId)).map((t) => t.TestName);

  // Letter Pad print uses the same Frequency/Instructions/Duration shape the
  // form saves to the server, built from the in-progress (not-yet-saved) rows
  // so Print always reflects exactly what's on screen.
  const printMeds = items
    .filter((it) => it.medicineName.trim())
    .map((it) => ({
      MedicineName: it.medicineName.trim(),
      Frequency: it.timing.join(', '),
      Instructions: it.food.join(', '),
      Duration: it.days ? `${it.days} day(s)` : '',
    }));
  const todaysVitals = history?.vitals?.find((v) => dateKey(v.RecordedAt) === currentDateKey()) || null;

  // Patient History, one entry per visit date (newest first). Attachment-only
  // dates (e.g. a lab report dropped off with no visit) get their own entry too.
  const historyDates = !history ? [] : [...new Set([
    ...history.vitals.map((v) => dateKey(v.RecordedAt)),
    ...history.prescriptions.map((p) => dateKey(p.CreatedAt)),
    ...docs.map((d) => dateKey(d.DocumentDate)),
  ])]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({
      date,
      vitals: history.vitals.filter((v) => dateKey(v.RecordedAt) === date),
      prescriptions: history.prescriptions.filter((p) => dateKey(p.CreatedAt) === date),
      docs: docs.filter((d) => dateKey(d.DocumentDate) === date),
    }));
  // Which dates are expanded; null = default (only the newest date open).
  const [openDates, setOpenDates] = useState(null);
  useEffect(() => { setOpenDates(null); }, [selected?.PatientId]);

  // Print binds today's details. What's on screen wins while it's being
  // entered or edited; once the form is empty (e.g. after Hold) it falls back
  // to today's saved prescription, so Print never comes out blank.
  const formHasContent = !!editingPrescription || printMeds.length > 0 || !!caseHistory.trim() || !!treatment.trim() || !!observation.trim()
    || !!notes.trim() || !!nextVisitDate || selectedTestIds.length > 0;
  const todaysRx = history?.prescriptions
    ?.filter((p) => dateKey(p.CreatedAt) === currentDateKey())
    .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))[0] || null;
  const printRx = formHasContent
    ? { CaseHistory: caseHistory, Treatment: treatment, Observation: observation, Notes: notes, NextVisitDate: nextVisitDate, labTests: selectedTestNames.map((TestName) => ({ TestName })) }
    : todaysRx;
  const printItems = formHasContent ? printMeds : todaysRx?.items || [];
  // Vitals as typed on the Current Vital Signs tab (saved or not), in VitalSign column shape.
  const printVitals = vitalEdit
    ? { ...todaysVitals, ...Object.fromEntries(PET_VITAL_FIELDS.map((f) => [f.col, vitalEdit[f.key]])), Comments: vitalEdit.comments }
    : todaysVitals;

  // Today's vitals are always open for editing: load the saved values whenever they (re)load.
  useEffect(() => {
    setVitalEdit(todaysVitals ? petVitalsFromRow(todaysVitals) : null);
  }, [todaysVitals]);

  const printPrescription = () => window.print();

  const deletePrescription = async (prescription) => {
    if (!confirm('Delete this prescription and its notes?')) return;
    try {
      await prescriptionApi.remove(prescription.PrescriptionId);
      show('Prescription deleted', 'success');
      loadHistory(selected.PatientId);
    } catch (err) {
      show(err.response?.data?.error || 'Delete failed', 'error');
    }
  };

  const submit = async (e, complete = false) => {
    e.preventDefault();
    if (!selected) return show('Select a patient first', 'error');

    // Every medicine row that has a name filled in must have its timing,
    // AF/BF and Days set too — a medicine can't be half-specified.
    for (const it of items) {
      if (!it.medicineName.trim()) continue;
      if (!it.timing.length) return show(`${it.medicineName}: select at least one timing (M/A/E/N)`, 'error');
      if (!it.food.length) return show(`${it.medicineName}: select AF or BF`, 'error');
      if (!it.days) return show(`${it.medicineName}: enter Days`, 'error');
    }

    setSaving(true);
    try {
      // Today's vitals are edited in place on the Vitals tab; save them with the same button.
      if (todaysVitals && vitalEdit) {
        const norm = (o) => JSON.stringify(Object.entries(o).map(([k, v]) => [k, v == null ? null : String(v)]));
        const payload = petVitalsPayload(vitalEdit);
        if (norm(payload) !== norm(petVitalsPayload(petVitalsFromRow(todaysVitals)))) {
          await vitalApi.update(todaysVitals.VitalId, payload);
        }
      }
      // Map timing checkboxes -> Frequency, food checkboxes -> Instructions.
      const payloadItems = items
        .filter((it) => it.medicineName.trim())
        .map((it) => ({
          medicineName: it.medicineName.trim(),
          frequency: it.timing.join(', '),
          instructions: it.food.join(', '),
          duration: it.days ? `${it.days} day(s)` : '',
        }));
      if (editingPrescription) {
        await prescriptionApi.update(editingPrescription.PrescriptionId, { notes, caseHistory, treatment, observation, items: payloadItems, complete, nextVisitDate: nextVisitDate || null, labTestIds: selectedTestIds });
      } else {
        await prescriptionApi.create({ patientId: selected.PatientId, notes, caseHistory, treatment, observation, items: payloadItems, complete, nextVisitDate: nextVisitDate || null, labTestIds: selectedTestIds });
      }
      show(complete ? 'Prescription completed' : editingPrescription ? 'Prescription updated' : 'Prescription saved', 'success');

      setNotes(''); setCaseHistory(''); setObservation(''); setTreatment(''); setItems([{ ...emptyItem }]); setNextVisitDate(''); setSelectedTestIds([]); setShowLabTests(false);
      setEditingPrescription(null);
      if (complete) setSelected(null);
      loadReadyList();
      if (selected && !complete) loadHistory(selected.PatientId);
    } catch (err) {
      show(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Assumes a 10-digit number is Indian (+91) since no country-code field
  // exists on the patient record.
  const normalizeMobile = (raw) => {
    const digits = (raw || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length === 10 ? `91${digits}` : digits;
  };

  const buildWhatsAppMessage = () => {
    const medLines = items
      .filter((it) => it.medicineName.trim())
      .map((it) => `- ${it.medicineName.trim()} (${timingToCode(it.timing)}, ${it.food[0] || '-'}, ${it.days ? `${it.days} day(s)` : '-'})`)
      .join('\n');

    return [
      `${clinic?.Name || 'Clinic'} - Prescription`,
      clinic?.DoctorName || null,
      `Patient: ${selected.Name}${patientAge ? ` (Age ${patientAge})` : ''}`,
      `Date: ${new Date().toLocaleDateString()}`,
      '',
      medLines || 'No medicines added yet.',
      notes ? `\nNotes: ${notes}` : null,
      clinic?.ContactNo ? `\nClinic Contact: ${clinic.ContactNo}` : null,
    ].filter(Boolean).join('\n');
  };

  // Builds the prescription PDF and hands it to the OS share sheet (WhatsApp
  // included) via the Web Share API — the only browser-native way to actually
  // attach a file to a chat, since WhatsApp's wa.me links only pre-fill text.
  // Falls back to downloading the PDF + opening a pre-filled WhatsApp chat on
  // browsers/devices that can't share files (e.g. most desktop browsers).
  const sendWhatsApp = async () => {
    if (!selected) return show('Select a patient first', 'error');
    const mobile = normalizeMobile(selected.MobileNo);
    if (!mobile) return show('This patient has no mobile number on file', 'error');
    if (!items.some((it) => it.medicineName.trim())) return show('Add at least one medicine first', 'error');

    setSending(true);
    try {
      const { buildPrescriptionPdf } = await import('../../utils/prescriptionPdf.jsx');
      const today = currentDateKey();
      const pdfBlob = await buildPrescriptionPdf({
        clinic, patient: selected, patientAge, items, notes, date: new Date().toLocaleString(), nextVisitDate, labTestNames: selectedTestNames,
      });
      const fileName = `Prescription-${selected.Name}-${today}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const message = buildWhatsAppMessage();

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName, text: message });
        show('Prescription sent', 'success');
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(message)}`, '_blank');
        show('PDF downloaded — attach it in the WhatsApp chat that just opened (this browser can\'t share files directly)', 'success');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') show(err.message || 'Failed to send prescription', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Examine" />

      <div className={selected ? 'space-y-2' : 'space-y-5'}>
        {!selected ? (
          showSearch ? (
            <div className="space-y-3">
              <button className="btn-ghost" onClick={() => setShowSearch(false)}>
                <ArrowLeft size={16} /> Back to lists
              </button>
              <PatientPicker selected={selected} onSelect={setSelected} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {/* LEFT: Vital Completed (ready for the doctor) */}
              <div className="card">
                <CardHeader
                  icon={ClipboardList}
                  title="Vital Completed"
                  subtitle="Today — ready for examination"
                  actions={
                    <button className="btn-secondary" onClick={() => setShowSearch(true)}>Search patient</button>
                  }
                />
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input className="input pl-9" placeholder="Search name, mobile or token..." value={readySearch} onChange={(e) => setReadySearch(e.target.value)} />
                </div>
                {loadingList ? (
                  <Spinner />
                ) : filterRows(readyList, readySearch).length === 0 ? (
                  <EmptyState message="No vital-completed patients." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-13">
                      <thead>
                        <tr className="table-head">
                          <th className="rounded-l-lg px-2.5 py-1.5">Token</th>
                          <th className="px-2.5 py-1.5">Patient</th>
                          <th className="px-2.5 py-1.5">Time</th>
                          <th className="px-2.5 py-1.5">Status</th>
                          <th className="rounded-r-lg px-2.5 py-1.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterRows(readyList, readySearch).map((r) => (
                          <tr key={r.ConfirmId} className="table-row cursor-pointer" onClick={() => pickFromList(r)}>
                            <td className="px-2.5 py-1">
                              <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-brand-gradient px-2 text-sm font-bold text-white">
                                {r.TokenNo ?? '-'}
                              </span>
                            </td>
                            <td className="px-2.5 py-1">
                              <p className="font-medium text-slate-700">{r.PatientName}</p>
                              <p className="text-xs text-slate-400">{r.MobileNo || '-'} · ID #{r.PatientId}</p>
                            </td>
                            <td className="px-2.5 py-1 text-slate-500">{fmtTime(r.ConfirmedAt)}</td>
                            <td className="px-2.5 py-1">
                              <span className="badge bg-amber-100 text-amber-700">Examine</span>
                            </td>
                            <td className="px-2.5 py-1 text-right">
                              <button className="btn-primary py-1.5" onClick={(e) => { e.stopPropagation(); pickFromList(r); }}>
                                Examine <ChevronRight size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* RIGHT: Billing (examination finished, sent to billing) */}
              <div className="card">
                <CardHeader
                  icon={CheckCircle2}
                  title="Billing"
                  subtitle="Today — examination finished, ready for billing"
                />
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input className="input pl-9" placeholder="Search name, mobile or token..." value={doneSearch} onChange={(e) => setDoneSearch(e.target.value)} />
                </div>
                {loadingList ? (
                  <Spinner />
                ) : filterRows(doneList, doneSearch).length === 0 ? (
                  <EmptyState message="No patients sent to billing yet." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-13">
                      <thead>
                        <tr className="table-head">
                          <th className="rounded-l-lg px-2.5 py-1.5">Token</th>
                          <th className="px-2.5 py-1.5">Patient</th>
                          <th className="px-2.5 py-1.5">Time</th>
                          <th className="rounded-r-lg px-2.5 py-1.5 text-right">View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterRows(doneList, doneSearch).map((r) => (
                          <tr key={r.ConfirmId} className="table-row cursor-pointer" onClick={() => pickFromList(r)}>
                            <td className="px-2.5 py-1">
                              <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-emerald-500 px-2 text-sm font-bold text-white">
                                {r.TokenNo ?? '-'}
                              </span>
                            </td>
                            <td className="px-2.5 py-1">
                              <p className="font-medium text-slate-700">{r.PatientName}</p>
                              <p className="text-xs text-slate-400">{r.MobileNo || '-'} · ID #{r.PatientId}</p>
                            </td>
                            <td className="px-2.5 py-1 text-slate-500">{fmtTime(r.ConfirmedAt)}</td>
                            <td className="px-2.5 py-1 text-right">
                              <button className="btn-secondary py-1.5" onClick={(e) => { e.stopPropagation(); pickFromList(r); }}>
                                Open <ChevronRight size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          <>
            <div className="no-print flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5">
              <p className="min-w-0 text-sm">
                <span className="font-semibold text-brand-800">{selected.Name || `${selected.OwnerName || 'Owner'}'s pet`}</span>
                {(selected.Species || selected.Breed) && (
                  <span className="ml-1.5 text-brand-600">({[selected.Species, selected.Breed].filter(Boolean).join(' · ')})</span>
                )}
                <span className="ml-2 text-xs text-brand-600">
                  {selected.OwnerName ? `Owner: ${selected.OwnerName} · ` : ''}{selected.MobileNo || 'No mobile'} · ID #{selected.PatientId}
                </span>
              </p>
              <button type="button" className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => setSelected(null)}>
                <ArrowLeft size={14} /> Change pet
              </button>
            </div>

            <div className="no-print flex gap-1 overflow-x-auto rounded-lg border border-ink-100 bg-white p-0.5" role="tablist">
              {EXAMINE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>

            {tab === 'vitals' && (
              <div className="no-print card !pb-3 sm:!pb-4">
                {todaysVitals ? (
                  <>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                      Current Vital Signs <span className="font-normal normal-case text-slate-400">· recorded {fmtTime(todaysVitals.RecordedAt)}</span>
                    </p>
                    {vitalEdit && (
                      <PetVitalFields
                        idPrefix="pv-rx-edit"
                        withComments
                        singleRow
                        values={vitalEdit}
                        onChange={(k, v) => setVitalEdit((e) => ({ ...e, [k]: v }))}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">No vital signs recorded today for this pet.</p>
                )}
                {/* History and Treatment sit with the vitals; saved with the prescription on Hold / Completed. */}
                <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-ink-100 pt-3 md:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="examine-case-history">History</label>
                    <textarea
                      id="examine-case-history"
                      className="input"
                      rows={3}
                      maxLength={2000}
                      value={caseHistory}
                      onChange={(e) => setCaseHistory(e.target.value)}
                      placeholder="e.g. Inappetence, dull, vomiting"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="examine-treatment">Treatment</label>
                    <textarea
                      id="examine-treatment"
                      className="input"
                      rows={3}
                      maxLength={2000}
                      value={treatment}
                      onChange={(e) => setTreatment(e.target.value)}
                      placeholder="e.g. Fluids, injections given"
                    />
                  </div>
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div className="no-print card !pb-3 sm:!pb-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <History size={16} /> Patient History
                    {historyDates.length > 0 && <span className="text-xs font-normal text-slate-400">{historyDates.length} visit date{historyDates.length === 1 ? '' : 's'}</span>}
                  </h3>
                  {historyDates.length > 1 && (
                    <div className="flex gap-1">
                      <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setOpenDates(historyDates.map((g) => g.date))}>Expand all</button>
                      <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setOpenDates([])}>Collapse all</button>
                    </div>
                  )}
                </div>
                {loadingHistory ? (
                  <Spinner />
                ) : !history ? (
                  <p className="text-sm text-slate-400">No history available.</p>
                ) : (
                  <div className="-mr-2 max-h-[calc(100vh-19rem)] min-h-[12rem] space-y-2 overflow-y-auto overscroll-contain pr-2">
                    {historyDates.map(({ date, vitals, prescriptions, docs: dateDocs }) => {
                        return (
                          <HistoryReportDay
                            key={date}
                            dateLabel={dateLabel(date)}
                            isToday={date === currentDateKey()}
                            open={(openDates ?? [historyDates[0]?.date]).includes(date)}
                            onToggle={() => setOpenDates((cur) => {
                              const list = cur ?? [historyDates[0]?.date];
                              return list.includes(date) ? list.filter((d) => d !== date) : [...list, date];
                            })}
                            vitals={vitals}
                            prescriptions={prescriptions}
                            docs={dateDocs}
                            onEdit={(p) => { editPrescription(p); setTab('meds'); }}
                            onDelete={deletePrescription}
                            onPreview={setPreviewDoc}
                            onDownload={(d) => patientDocumentApi.download(d.DocumentId, d.FileName)}
                          />
                        );
                      })}
                    {history.vitals.length === 0 && history.prescriptions.length === 0 && docs.length === 0 && <p className="text-sm text-slate-400">No records available.</p>}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={(e) => submit(e, false)} className="card !pb-3 sm:!pb-4">
              <div className="hidden print:block">
                {/* Same report pattern as Patient History, under the letter pad header strip. */}
                <PrescriptionReportPrint
                  letterPadImage={clinic?.PrescriptionAttachment}
                  patient={{ ...selected, ...(petRecord?.PatientId === selected.PatientId ? petRecord : {}) }}
                  vitals={printVitals}
                  meds={printItems}
                  age={patientAge}
                  rx={printRx}
                />
              </div>

              <div className={tab === 'meds' ? 'mb-3 flex flex-col gap-4 md:flex-row' : 'hidden print:block'}>
                <nav className="no-print flex shrink-0 gap-1 md:w-48 md:flex-col md:border-r md:border-ink-100 md:pr-3" aria-label="Medications and lab tests">
                  {[
                    { id: 'meds', label: 'Medications', icon: Pill, count: items.filter((it) => it.medicineName).length },
                    { id: 'lab', label: 'Lab Tests', icon: TestTube, count: selectedTestIds.length },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMedsTab(t.id)}
                      aria-current={medsTab === t.id ? 'page' : undefined}
                      className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors md:flex-none ${
                        medsTab === t.id ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <t.icon size={16} />
                      <span className="flex-1">{t.label}</span>
                      {t.count > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{t.count}</span>}
                    </button>
                  ))}
                </nav>

                <div className="min-w-0 flex-1">
                <div className={medsTab === 'meds' ? '' : 'hidden print:block'}>
                <div className="no-print mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Medications {editingPrescription && <span className="text-xs font-normal text-brand-600">(Editing)</span>}</h3>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={printPrescription} title="Print prescription">
                      <Printer size={16} /> Print
                    </button>
                    <button type="button" className="btn-secondary" onClick={sendWhatsApp} disabled={sending} title="Send the prescription PDF to the patient's WhatsApp">
                      <MessageCircle size={16} /> {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>

                {/* Medication rows (editing UI; replaced by a clean read-only table on print) */}
                <div className="no-print space-y-3">
                  {/* Column labels (desktop) */}
                  <div className="hidden gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-ink-400 lg:flex">
                    <div className="flex-1">Medicine</div>
                    <div className="w-[180px] text-brand-600">M / A / E / N *</div>
                    <div className="w-[100px] text-amber-600">AF / BF *</div>
                    <div className="w-[90px]">Days *</div>
                    <div className="w-[68px]" />
                  </div>

                  {items.map((it, i) => (
                    <div key={i} className="flex flex-col gap-3 rounded-lg border border-ink-100 bg-ink-50/40 p-3 lg:flex-row lg:items-center">
                      <div className="flex-1">
                        <SearchSelect
                          value={it.medicineName}
                          onChange={(v) => updateItem(i, 'medicineName', v)}
                          placeholder="Select medicine"
                          options={meds.map((m) => ({
                            value: m.MedicineName,
                            label: `${m.MedicineName}${m.GenericName ? ` (${m.GenericName})` : ''}`,
                          }))}
                        />
                      </div>

                      {/* Row 1: Timing. Row 2: AF/BF + Days + add/remove, scrolling
                          horizontally on narrow screens instead of wrapping.
                          (lg:contents unwraps every level on desktop so it doesn't
                          affect the existing multi-column layout there). */}
                      <div className="flex flex-col gap-3 lg:contents">
                        {/* Timing checkboxes (short labels) */}
                        <div className="flex shrink-0 gap-3 rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2 lg:w-[180px] lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
                          {TIMINGS.map((t) => (
                            <label key={t.full} title={t.full} className="flex cursor-pointer items-center gap-1 text-sm font-medium text-brand-700">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-300"
                                checked={it.timing.includes(t.full)}
                                onChange={() => toggleInItem(i, 'timing', t.full)}
                              />
                              {t.short}
                            </label>
                          ))}
                        </div>

                        <div className="overflow-x-auto lg:contents">
                          <div className="flex min-w-max items-center gap-3 lg:contents">
                            {/* AF / BF checkboxes */}
                            <div className="flex shrink-0 gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 lg:w-[100px] lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
                              {FOOD.map((f) => (
                                <label key={f} className="flex cursor-pointer items-center gap-1.5 text-sm text-amber-700">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-300"
                                    checked={it.food.includes(f)}
                                    onChange={() => setExclusiveInItem(i, 'food', f)}
                                  />
                                  {f}
                                </label>
                              ))}
                            </div>

                            {/* Days */}
                            <div className="w-[90px] shrink-0">
                              <input
                                type="number"
                                min="1"
                                className="input"
                                value={it.days}
                                onChange={(e) => updateItem(i, 'days', e.target.value)}
                                placeholder="Days"
                              />
                            </div>

                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="no-print btn-ghost px-2 py-2 text-brand-600 hover:bg-brand-50"
                                onClick={addItem}
                                title="Add another medicine"
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                type="button"
                                className="no-print btn-ghost px-2 py-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
                                onClick={() => removeItem(i)}
                                disabled={items.length === 1}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>


                </div>

                {medsTab === 'lab' && (
                  <div className="no-print">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <TestTube size={16} /> Lab Tests
                      {selectedTestIds.length > 0 && <span className="text-xs font-normal text-slate-400">{selectedTestIds.length} selected</span>}
                    </h3>
                    {labTests.length === 0 ? (
                      <p className="text-sm text-slate-400">No lab tests set up yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {labTests.map((t) => (
                          <label key={t.TestId} className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-violet-800">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-300"
                              checked={selectedTestIds.includes(t.TestId)}
                              onChange={() => toggleTest(t.TestId)}
                            />
                            {t.TestName}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Common to all tabs: Notes, Next Visit Date and the save buttons on one row */}
              <div className="no-print grid grid-cols-1 items-end gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <label className="label" htmlFor="examine-notes">Notes</label>
                  <textarea
                    id="examine-notes"
                    className="input"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="General notes / advice"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-40">
                    <label className="label" htmlFor="examine-next-visit">Next Visit Date</label>
                    <input
                      id="examine-next-visit"
                      type="date"
                      className="input"
                      value={nextVisitDate}
                      onChange={(e) => setNextVisitDate(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-secondary" disabled={saving}>
                    <Save size={16} /> {saving ? 'Holding...' : 'Hold'}
                  </button>
                  <button type="button" className="btn-primary" disabled={saving} onClick={(e) => submit(e, true)}>
                    <CheckCircle2 size={16} /> Completed
                  </button>
                  {editingPrescription && <button type="button" className="btn-ghost" disabled={saving} onClick={() => { setEditingPrescription(null); setNotes(''); setCaseHistory(''); setObservation(''); setTreatment(''); setItems([{ ...emptyItem }]); setNextVisitDate(''); setSelectedTestIds([]); setShowLabTests(false); }}>Cancel Edit</button>}
                </div>
              </div>
            </form>

          </>
        )}
      </div>

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <Toast toast={toast} />
    </div>
  );
}
