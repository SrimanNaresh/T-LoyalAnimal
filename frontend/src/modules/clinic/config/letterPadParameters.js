import {
  Activity, Pill, Weight as WeightIcon, HeartPulse, Thermometer, MessageSquare, Clock, Utensils, CalendarDays, Hash, User, Cake, Phone,
  Wind, Timer, Eye, Scan, Droplet, Smile, Stethoscope, ClipboardList, StickyNote, CalendarClock, TestTube,
  PawPrint, Dog, Users, Palette, UserRound, MapPin, Share2, Building2, Type,
} from 'lucide-react';
import { PET_VITAL_FIELDS } from './petVitals.js';

export const DEFAULT_FONT_SIZE = 12;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 28;

// The letterhead is printed as one full sheet, A4 unless the template says
// otherwise. Height / Width are in cm.
export const A4 = { width: 21, height: 29.7 };
export const sheetSize = (height, width) => ({
  height: Number(height) > 0 ? Number(height) : A4.height,
  width: Number(width) > 0 ? Number(width) : A4.width,
});
// A field's font size is in px *on the printed sheet*. Expressed as a share of
// the sheet's width (cqw), it looks the same size in the editor at any screen
// width as it does on paper.
const PX_PER_CM = 96 / 2.54;
export const sheetFontSize = (px, widthCm) => `${(px / (widthCm * PX_PER_CM)) * 100}cqw`;

// Tailwind's build-time scanner only picks up class names that appear as
// literal strings in the source — never interpolated (e.g. `border-${x}-200`),
// which would silently compile to no styling at all. So each variant here is
// spelled out in full rather than built from a shared "accent" color name.
//
// Each Vital Sign field from the Vital Sign screen (vitalKey matches the
// property VitalSign records return) is its own draggable parameter, so it
// can be positioned independently on the letterhead — plus Medication as
// one combined block. All six vital fields share the rose color family so
// they still read as "vitals" at a glance, distinct from Medication's blue.
const ROSE_PALETTE_CLASS = 'border-rose-200 bg-rose-50 text-rose-700';
const ROSE_ICON_CLASS = 'text-rose-600';
const ROSE_EDIT_BADGE_CLASS = 'cursor-grab border-rose-300 bg-rose-100 font-semibold text-rose-800 active:cursor-grabbing';

// Shared by the Letter Pad Prescription builder (Coming Up's) and anywhere
// else a prescription needs to print on the same letterhead template (e.g.
// Billing -> Patient Bill), so both stay in sync with one source of truth.
// Pet vitals come straight from the Vital Sign screen's own field list, so
// every input there is a parameter here. type = the VitalSign column, which
// keeps templates saved earlier (Weight, PulseRate, Temperature, Comments)
// working; old human-only fields (Height, Blood Pressure) are dropped.
const VITAL_ICONS = {
  Weight: WeightIcon, Temperature: Thermometer, PulseRate: Activity, HeartRate: HeartPulse,
  RespiratoryRate: Wind, CRP: Timer, STT: Eye, SkinCoat: Scan, CMM: Droplet, VMM: Droplet,
  OralCavity: Smile, AbdominalExam: Stethoscope, RectalExam: Stethoscope,
};
const VITAL_PARAMS = [
  ...PET_VITAL_FIELDS.map((f) => ({
    type: f.col, label: f.label.replace(/\s*\(.*\)$/, ''), vitalKey: f.col, unit: f.unit || '', icon: VITAL_ICONS[f.col] || Activity,
  })),
  { type: 'Comments', label: 'Comments', vitalKey: 'Comments', unit: '', icon: MessageSquare },
].map((p) => ({ ...p, group: 'Vital Sign', paletteClass: ROSE_PALETTE_CLASS, iconClass: ROSE_ICON_CLASS, editBadgeClass: ROSE_EDIT_BADGE_CLASS }));

// Examine screen inputs outside medicines and vitals (violet).
const EXAM_STYLE = {
  group: 'Examination', paletteClass: 'border-violet-200 bg-violet-50 text-violet-700', iconClass: 'text-violet-600',
  editBadgeClass: 'cursor-grab border-violet-300 bg-violet-100 font-semibold text-violet-800 active:cursor-grabbing',
};
const EXAM_PARAMS = [
  { type: 'CaseHistory', label: 'History', icon: ClipboardList },
  { type: 'Observation', label: 'Observation', icon: Eye },
  { type: 'Notes', label: 'Notes / Advice', icon: StickyNote },
  { type: 'NextVisitDate', label: 'Next Visit Date', icon: CalendarClock },
  { type: 'LabTests', label: 'Lab Tests', icon: TestTube },
].map((p) => ({ ...p, ...EXAM_STYLE }));

// Free text you type yourself (e.g. "Diagnosis:", "Signature"), printed as is.
// Each placed label keeps its own text in the field's `text`.
export const LABEL_TYPE = 'Label';
const LABEL_PARAMS = [
  { type: LABEL_TYPE, label: 'Text Label', group: 'Label', icon: Type,
    paletteClass: 'border-sky-200 bg-sky-50 text-sky-700', iconClass: 'text-sky-600',
    editBadgeClass: 'cursor-grab border-sky-300 bg-sky-100 font-semibold text-sky-800 active:cursor-grabbing' },
];

export const PARAMETER_TYPES = [
  ...LABEL_PARAMS,
  ...VITAL_PARAMS,
  ...EXAM_PARAMS,

  // Medicine columns — same split-per-field approach as Vital Sign, and the
  // same color coding as the Medications table itself: Medicine Name and
  // M/A/E/N in blue, AF/BF in amber, Days in neutral gray.
  { type: 'MedicineName', label: 'Medicine Name', group: 'Medicine', icon: Pill,
    paletteClass: 'border-brand-200 bg-brand-50 text-brand-700', iconClass: 'text-brand-600',
    editBadgeClass: 'cursor-grab border-brand-300 bg-brand-100 font-semibold text-brand-800 active:cursor-grabbing' },
  { type: 'Timing', label: 'M / A / E / N', group: 'Medicine', icon: Clock,
    paletteClass: 'border-brand-200 bg-brand-50 text-brand-700', iconClass: 'text-brand-600',
    editBadgeClass: 'cursor-grab border-brand-300 bg-brand-100 font-semibold text-brand-800 active:cursor-grabbing' },
  { type: 'FoodTiming', label: 'AF / BF', group: 'Medicine', icon: Utensils,
    paletteClass: 'border-amber-200 bg-amber-50 text-amber-700', iconClass: 'text-amber-600',
    editBadgeClass: 'cursor-grab border-amber-300 bg-amber-100 font-semibold text-amber-800 active:cursor-grabbing' },
  { type: 'Days', label: 'Days', group: 'Medicine', icon: CalendarDays,
    paletteClass: 'border-slate-200 bg-slate-50 text-slate-700', iconClass: 'text-slate-500',
    editBadgeClass: 'cursor-grab border-slate-300 bg-slate-100 font-semibold text-slate-800 active:cursor-grabbing' },

  // Patient Details — sourced from the patient record itself (teal, distinct
  // from vitals/medicine), each its own draggable parameter.
  // Every input on the Pet Registration screen, in the same order.
  ...[
    { type: 'PatientId', label: 'Pet ID', icon: Hash },
    { type: 'PatientName', label: 'Pet Name', icon: User },
    { type: 'Species', label: 'Species', icon: PawPrint },
    { type: 'Breed', label: 'Breed', icon: Dog },
    { type: 'Gender', label: 'Gender', icon: Users },
    { type: 'Age', label: 'Age', icon: Cake },
    { type: 'Color', label: 'Color / Markings', icon: Palette },
    { type: 'OwnerName', label: 'Owner Name', icon: UserRound },
    { type: 'MobileNo', label: 'Mobile No', icon: Phone },
    { type: 'Address', label: 'Address', icon: MapPin },
    { type: 'ReferralType', label: 'Referral', icon: Share2 },
    { type: 'ReferredBy', label: 'Clinic or Hospital Name', icon: Building2 },
  ].map((p) => ({
    ...p, group: 'Patient',
    paletteClass: 'border-teal-200 bg-teal-50 text-teal-700', iconClass: 'text-teal-600',
    editBadgeClass: 'cursor-grab border-teal-300 bg-teal-100 font-semibold text-teal-800 active:cursor-grabbing',
  })),
];

const TIMING_ORDER = ['Morning', 'Afternoon', 'Evening', 'Night'];
export const frequencyToCode = (frequency) => {
  const chosen = (frequency || '').split(',').map((v) => v.trim()).filter(Boolean);
  return TIMING_ORDER.map((t) => (chosen.includes(t) ? '1' : '0')).join('-');
};

// Printed values only — the letterhead's own position for each field says
// what it is, so the parameter name ("Weight:", "Patient Name:") is not printed.
export const fmtVitalValue = (def, vitals) => {
  const v = vitals?.[def.vitalKey];
  if (!v) return '-';
  return `${v}${def.unit ? ` ${def.unit}` : ''}`;
};

// Pet fields read from the Patient record (GET /patients/:id), so callers pass
// the full row; PatientName is also accepted for the pet's name.
const val = (v) => (v == null || String(v).trim() === '' ? '-' : String(v));
export const fmtPetAge = (patient) =>
  patient?.Age == null ? '-' : `${patient.Age} ${patient.AgeUnit === 'Months' ? 'Months' : 'Years'}`;
export const PATIENT_FIELD_GETTERS = {
  PatientId: (p) => (p?.PatientId != null ? `P-${p.PatientId}` : '-'),
  PatientName: (p) => val(p?.Name ?? p?.PatientName),
  Species: (p) => val(p?.Species),
  Breed: (p) => val(p?.Breed),
  Gender: (p) => val(p?.Gender),
  Age: (p) => fmtPetAge(p),
  Color: (p) => val(p?.Color),
  OwnerName: (p) => val(p?.OwnerName),
  MobileNo: (p) => val(p?.MobileNo),
  Address: (p) => val(p?.Address),
  ReferralType: (p) => (p?.ReferralType === 'Patient' ? 'Existing Client' : val(p?.ReferralType)),
  ReferredBy: (p) => val(p?.ReferredBy),
};

// Examination fields read from the prescription:
// { CaseHistory, Observation, Notes, NextVisitDate, labTests: [{ TestName }] }.
export const EXAM_FIELD_GETTERS = {
  CaseHistory: (rx) => rx?.CaseHistory || '-',
  Observation: (rx) => rx?.Observation || '-',
  Notes: (rx) => rx?.Notes || '-',
  NextVisitDate: (rx) => {
    const v = rx?.NextVisitDate;
    if (!v) return '-';
    // "2026-11-27", an ISO timestamp or a Date — read the calendar day, no timezone shift.
    const day = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    const d = new Date(`${day}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
  },
  LabTests: (rx) => rx?.labTests?.map((t) => t.TestName).filter(Boolean).join(', ') || '-',
};

export const MED_FIELD_GETTERS = {
  MedicineName: (it) => it.MedicineName || '-',
  Timing: (it) => frequencyToCode(it.Frequency),
  FoodTiming: (it) => it.Instructions || '-',
  Days: (it) => it.Duration || '-',
};
