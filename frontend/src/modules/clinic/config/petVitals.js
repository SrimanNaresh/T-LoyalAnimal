// Pet clinical examination fields for the Vital Sign screen and its list.
// key = API body key, col = VitalSign column, kind = how it is entered.
export const PET_VITAL_FIELDS = [
  { key: 'temperature', col: 'Temperature', label: 'Temperature (°C)', kind: 'number', step: '0.1', placeholder: 'e.g. 38.5', short: 'Temp', unit: '°C' },
  { key: 'pulseRate', col: 'PulseRate', label: 'Pulse (/min)', kind: 'number', short: 'Pulse', unit: '/min' },
  { key: 'heartRate', col: 'HeartRate', label: 'Heart Rate (bpm)', kind: 'number', short: 'HR', unit: 'bpm' },
  { key: 'respiratoryRate', col: 'RespiratoryRate', label: 'Respiratory Rate (/min)', kind: 'number', short: 'RR', unit: '/min' },
  { key: 'crp', col: 'CRP', label: 'CRP', kind: 'text', maxLength: 50, short: 'CRP' },
  { key: 'stt', col: 'STT', label: 'STT', kind: 'text', maxLength: 50, short: 'STT' },
  { key: 'skinCoat', col: 'SkinCoat', label: 'Skin Coat', kind: 'text', maxLength: 200, options: ['Normal', 'Rough', 'Dull', 'Alopecia', 'Ectoparasites'] },
  { key: 'cmm', col: 'CMM', label: 'CMM', kind: 'text', maxLength: 100, options: ['Pink', 'Pale', 'Congested', 'Cyanotic', 'Icteric'], short: 'CMM' },
  { key: 'vmm', col: 'VMM', label: 'VMM', kind: 'text', maxLength: 100, options: ['Pink', 'Pale', 'Congested', 'Cyanotic', 'Icteric'] },
  { key: 'oralCavity', col: 'OralCavity', label: 'Oral Cavity', kind: 'text', maxLength: 500, options: ['Normal', 'Pale', 'Ulcers', 'Tartar'] },
  { key: 'abdominalExam', col: 'AbdominalExam', label: 'Abdominal Examination', kind: 'textarea', maxLength: 1000 },
  { key: 'rectalExam', col: 'RectalExam', label: 'Rectal Examination', kind: 'textarea', maxLength: 1000 },
];

export const emptyPetVitals = () =>
  Object.fromEntries([...PET_VITAL_FIELDS.map((f) => [f.key, '']), ['comments', '']]);

// A saved VitalSign row -> form values.
export const petVitalsFromRow = (row) => ({
  ...Object.fromEntries(PET_VITAL_FIELDS.map((f) => [f.key, row?.[f.col] ?? ''])),
  comments: row?.Comments ?? '',
});

// Form values -> API body (blank -> null).
export const petVitalsPayload = (form) =>
  Object.fromEntries(
    [...PET_VITAL_FIELDS.map((f) => f.key), 'comments'].map((k) => {
      const v = form[k];
      return [k, v === '' || v == null ? null : typeof v === 'string' ? v.trim() || null : v];
    }),
  );
