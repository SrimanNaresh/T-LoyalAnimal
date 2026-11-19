import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, List, PawPrint, UserCheck } from 'lucide-react';
import { Toast, CardHeader, Modal } from '../../../../components/ui.jsx';
import BulkImport from '../../components/BulkImport.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { patientApi, confirmApi } from '../../api.js';

// Letters, spaces and periods only (e.g. "Dr. A. Kumar") — no digits or other punctuation.
const NAME_PATTERN = /^[A-Za-z][A-Za-z\s.]*$/;
const MOBILE_PATTERN = /^\d{10}$/;
const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Cow', 'Goat', 'Horse', 'Other'];

const EMPTY_FORM = {
  name: '', species: '', breed: '', gender: '', age: '', ageUnit: 'Years', color: '',
  ownerName: '', mobileNo: '', address: '', referralType: '', referredBy: '',
};

export default function Patient() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, show } = useToast();

  const prefill = location.state?.prefill;
  const fromConfirm = location.state?.fromConfirm === true;
  const editPatient = location.state?.editPatient;

  const editId = editPatient?.PatientId || null;
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    name: editPatient?.Name || prefill?.name || '',
    species: editPatient?.Species || '',
    breed: editPatient?.Breed || '',
    gender: editPatient?.Gender || '',
    age: editPatient?.Age ?? '',
    ageUnit: editPatient?.AgeUnit || 'Years',
    color: editPatient?.Color || '',
    ownerName: editPatient?.OwnerName || '',
    mobileNo: editPatient?.MobileNo || prefill?.mobileNo || '',
    address: editPatient?.Address || '',
    referralType: editPatient?.ReferralType || '',
    referredBy: editPatient?.ReferralType === 'Doctor' ? editPatient?.ReferredBy || '' : '',
  });
  const [nextId, setNextId] = useState(null);
  const [saving, setSaving] = useState(false);
  // Holds the just-saved patient when we need to offer confirmation
  const [confirmPrompt, setConfirmPrompt] = useState(null);

  const loadNextId = useCallback(() => {
    patientApi.nextId().then((d) => setNextId(d.nextId)).catch(() => setNextId(null));
  }, []);

  useEffect(() => { if (!editId) loadNextId(); }, [editId, loadNextId]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim() && !NAME_PATTERN.test(form.name.trim())) return show('Pet name must contain letters only (periods allowed)', 'error');
    if (!form.species) return show('Species is required', 'error');
    if (!form.ownerName.trim()) return show('Owner name is required', 'error');
    if (!NAME_PATTERN.test(form.ownerName.trim())) return show('Owner name must contain letters only (periods allowed)', 'error');
    if (!form.mobileNo.trim()) return show('Mobile No is required', 'error');
    if (!MOBILE_PATTERN.test(form.mobileNo.trim())) return show('Mobile No must be exactly 10 digits', 'error');
    setSaving(true);
    try {
      if (editId) {
        await patientApi.update(editId, form);
        show('Pet updated', 'success');
        navigate('/clinic/registration/patient-list');
      } else {
        const created = await patientApi.create(form);
        show(`Pet saved (ID: ${created.PatientId})`, 'success');
        setForm(EMPTY_FORM);
        loadNextId();
        // If we came from the Confirm flow, offer to confirm this new patient.
        if (fromConfirm) setConfirmPrompt(created);
      }
    } catch (err) {
      show(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doConfirm = async () => {
    if (!confirmPrompt) return;
    try {
      await confirmApi.create({ patientId: confirmPrompt.PatientId });
      show(`${confirmPrompt.Name || confirmPrompt.OwnerName || 'Pet'} confirmed`, 'success');
      setConfirmPrompt(null);
      navigate('/clinic/confirm/list');
    } catch (err) {
      show(err.response?.data?.error || 'Confirm failed', 'error');
    }
  };

  return (
    <div>
      <form onSubmit={submit} className="card">
        <CardHeader
          icon={PawPrint}
          title={editId ? 'Edit Pet' : 'Pet Details'}
          subtitle={editId ? `Update details for ${editPatient?.Name || 'this pet'}` : "Enter the pet's and owner's details"}
          actions={
            <>
              <BulkImport
                variant="inline"
                fileName="pet"
                columns={['PatientId', 'Name', 'Species', 'Breed', 'Gender', 'Color', 'OwnerName', 'MobileNo', 'Address']}
                sample={[
                  ['', 'Bruno', 'Dog', 'Labrador', 'Male', 'Golden', 'John Doe', '9999911111', '12 Main St'],
                  ['', 'Kitty', 'Cat', 'Persian', 'Female', 'White', 'Jane Smith', '8888822222', '45 Park Ave'],
                ]}
                note="Leave PatientId blank to insert, or fill it to update. Name is the pet's name (optional). Each row needs a Name or an OwnerName. Gender is Male or Female."
                onImport={(rows) => patientApi.bulk(rows)}
              />
              <button type="button" className="btn-secondary" onClick={() => navigate('/clinic/registration/patient-list')}>
                <List size={16} /> View List
              </button>
            </>
          }
        />

        {fromConfirm && (
          <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
            Adding a new pet from Confirm — after saving you'll be asked to confirm it.
          </div>
        )}

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Pet</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Pet ID</label>
            <input
              className="input bg-ink-50 font-semibold text-ink-500"
              value={editId ? `P-${editId}` : nextId != null ? `P-${nextId}` : 'Auto'}
              readOnly
              tabIndex={-1}
              title="Auto-generated on save"
            />
          </div>
          <div>
            <label className="label">Pet Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.replace(/[^A-Za-z\s.]/g, '') }))}
              placeholder="e.g. Bruno"
            />
          </div>
          <div>
            <label className="label">Species *</label>
            <select className="input" value={form.species} onChange={update('species')}>
              <option value="">Select</option>
              {SPECIES.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Breed</label>
            <input className="input" value={form.breed} onChange={update('breed')} placeholder="e.g. Labrador" maxLength={100} />
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={update('gender')}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label className="label">Age</label>
            <div className="flex gap-2">
              <input type="number" min="0" className="input min-w-0 flex-1" value={form.age} onChange={update('age')} placeholder="Age" />
              <select className="input w-28" value={form.ageUnit} onChange={update('ageUnit')}>
                <option value="Years">Years</option>
                <option value="Months">Months</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Color / Markings</label>
            <input className="input" value={form.color} onChange={update('color')} placeholder="e.g. Brown, white patch" maxLength={50} />
          </div>
        </div>

        <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-400">Owner</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Owner Name *</label>
            <input
              className="input"
              value={form.ownerName}
              onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value.replace(/[^A-Za-z\s.]/g, '') }))}
              placeholder="Owner name"
            />
          </div>
          <div>
            <label className="label">Mobile No *</label>
            <input
              className="input"
              value={form.mobileNo}
              onChange={(e) => setForm((f) => ({ ...f, mobileNo: e.target.value.replace(/\D/g, '') }))}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              maxLength={10}
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={update('address')} placeholder="Address" />
          </div>
          <div>
            <label className="label">Referral</label>
            <select
              className="input"
              value={form.referralType}
              onChange={(e) => setForm((f) => ({ ...f, referralType: e.target.value, referredBy: e.target.value === 'Doctor' ? f.referredBy : '' }))}
            >
              <option value="">Select</option>
              <option value="Doctor">Doctor</option>
              <option value="Patient">Existing Client</option>
            </select>
          </div>
          {form.referralType === 'Doctor' && (
            <div>
              <label className="label">Clinic or Hospital Name</label>
              <input className="input" value={form.referredBy} onChange={update('referredBy')} placeholder="Clinic or hospital name" maxLength={150} />
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end border-t border-ink-100 pt-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : editId ? 'Update Pet' : 'Save Pet'}
          </button>
        </div>
      </form>

      {/* After-save confirmation prompt (only in the Confirm flow) */}
      <Modal open={!!confirmPrompt} onClose={() => setConfirmPrompt(null)} title="Confirm this pet?">
        {confirmPrompt && (
          <div>
            <p className="text-sm text-ink-600">
              <span className="font-semibold text-ink-800">{confirmPrompt.Name || `${confirmPrompt.OwnerName || 'Owner'}'s pet`}</span>
              {confirmPrompt.MobileNo ? ` · ${confirmPrompt.MobileNo}` : ''} (ID #{confirmPrompt.PatientId})
              was saved. Do you want to confirm this pet now? Confirming adds them to today's Confirm List with a token.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirmPrompt(null)}>No</button>
              <button className="btn-primary" onClick={doConfirm}>
                <UserCheck size={16} /> Confirm Pet
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
