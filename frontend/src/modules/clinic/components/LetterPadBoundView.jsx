import { PARAMETER_TYPES, DEFAULT_FONT_SIZE, MED_FIELD_GETTERS, PATIENT_FIELD_GETTERS, EXAM_FIELD_GETTERS, fmtVitalValue, sheetSize, sheetFontSize, LABEL_TYPE } from '../config/letterPadParameters.js';

// One line per medicine, in the same order across every medicine column —
// so lining Medicine Name / M-A-E-N / AF-BF / Days up as separate columns
// on the letterhead still reads as one table, row for row.
function MedicineFieldLines({ type, items }) {
  if (!items?.length) return <p className="text-ink-400">No medicines recorded today</p>;
  const getter = MED_FIELD_GETTERS[type];
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => <p key={i}>{getter(it)}</p>)}
    </div>
  );
}

// Prints the letterhead as exactly one sheet (A4 unless the template sets
// another size): no page margins, the image stretched to the full sheet, and
// the sheet pinned to the page's top-left so card padding around it on the
// screen doesn't shift it on paper.
export function LetterPadSheetStyle({ height, width }) {
  const s = sheetSize(height, width);
  return (
    <style>{`
      @media print {
        @page { size: ${s.width}cm ${s.height}cm; margin: 0; }
        .letterpad-sheet {
          position: fixed !important; left: 0; top: 0;
          width: ${s.width}cm !important; height: ${s.height}cm !important;
          border: 0 !important; border-radius: 0 !important;
        }
      }
    `}</style>
  );
}

// Renders a clinic's saved Letter Pad template (letterhead image + its
// positioned parameter fields) filled in with one patient's real data. Used
// both by the Letter Pad Prescription builder page (Coming Up's) after
// selecting a patient, and by any other screen that needs to print a
// prescription on that same letterhead — e.g. Billing -> Patient Bill —
// so every print of this template stays in sync with the saved layout.
// rx = the prescription's examination fields:
// { CaseHistory, Observation, Notes, NextVisitDate, labTests: [{ TestName }] }.
export default function LetterPadBoundView({ imageData, pageHeight, pageWidth, fields, patient, vitals, meds, age, rx }) {
  if (!imageData) return null;
  const sheet = sheetSize(pageHeight, pageWidth);

  const renderValue = (def, f) => {
    if (def.type === LABEL_TYPE) return f.text || '';
    if (MED_FIELD_GETTERS[def.type]) return <MedicineFieldLines type={def.type} items={meds} />;
    if (EXAM_FIELD_GETTERS[def.type]) return EXAM_FIELD_GETTERS[def.type](rx);
    // Age with its unit from the pet record; the bare `age` prop is the fallback.
    if (def.type === 'Age' && patient?.Age == null) return `${age ?? '-'}`;
    if (PATIENT_FIELD_GETTERS[def.type]) return PATIENT_FIELD_GETTERS[def.type](patient);
    return fmtVitalValue(def, vitals);
  };

  return (
    <>
      <LetterPadSheetStyle height={pageHeight} width={pageWidth} />
      <div
        className="letterpad-sheet relative w-full overflow-hidden rounded-lg border border-ink-100 bg-white"
        style={{ aspectRatio: `${sheet.width} / ${sheet.height}`, containerType: 'inline-size' }}
      >
        <img src={imageData} alt="Letterhead" className="absolute inset-0 h-full w-full select-none object-fill" draggable={false} />
        {(fields || []).map((f) => {
          const def = PARAMETER_TYPES.find((p) => p.type === f.type);
          if (!def) return null; // a field type from before this parameter set changed
          return (
            <div
              key={f.id}
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                // Anchor to the near edge instead of always centering once the
                // drop point is close to it, so the badge always renders fully
                // inside the image regardless of container width.
                transform: `translate(${f.x < 15 ? '0' : f.x > 85 ? '-100%' : '-50%'}, ${f.y < 15 ? '0' : f.y > 85 ? '-100%' : '-50%'})`,
              }}
              className="absolute max-w-[85%] text-ink-800"
            >
              <div className="whitespace-pre-line" style={{ fontSize: sheetFontSize(f.fontSize || DEFAULT_FONT_SIZE, sheet.width), fontWeight: f.bold ? 700 : 400 }}>{renderValue(def, f)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
