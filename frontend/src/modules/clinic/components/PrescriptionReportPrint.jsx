import { useLetterPadHeader, HEADER_PRESCRIPTION, DOCTOR_NAME_BOXES } from './CommonBillPrint.jsx';
import { VitalTable, SectionTitle, Value, th, td, labelTd } from './HistoryReportDay.jsx';

// Printed prescription in the same report pattern as Patient History:
// letter pad header strip, patient details, then bordered Vital Signs,
// Examination and Medicines tables. Shapes are the saved ones:
// vitals = VitalSign row, rx = { CaseHistory, Treatment, Observation, Notes,
// NextVisitDate, labTests: [{ TestName }] }, meds = [{ MedicineName,
// Frequency, Instructions, Duration }].
const fmtDate = (v) => {
  if (!v) return '';
  const day = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB');
};

// date: the visit day (YYYY-MM-DD); today when not given.
export default function PrescriptionReportPrint({ letterPadImage, patient, age, vitals, rx, meds = [], date }) {
  const headerImage = useLetterPadHeader(letterPadImage, HEADER_PRESCRIPTION, DOCTOR_NAME_BOXES);
  const petName = patient?.Name || `${patient?.OwnerName || 'Owner'}'s pet`;
  const species = [patient?.Species, patient?.Breed].filter(Boolean).join(' / ');

  return (
    <div className="print-prescription rx-compact text-slate-800">
      <style>{'@page { size: A4; margin: 8mm; }'}</style>
      {headerImage && <img src={headerImage} alt="" className="mb-1.5 block w-full" />}

      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={labelTd}>Patient Name</td><td className={td}>{petName}</td>
            <td className={labelTd}>Date</td><td className={td}>{date ? fmtDate(date) : new Date().toLocaleDateString('en-GB')}</td>
          </tr>
          <tr>
            <td className={labelTd}>Owner Name</td><td className={td}><Value v={patient?.OwnerName} /></td>
            <td className={labelTd}>Mobile</td><td className={td}><Value v={patient?.MobileNo} /></td>
          </tr>
          <tr>
            <td className={labelTd}>Species / Breed</td><td className={td}><Value v={species} /></td>
            <td className={labelTd}>Age / Gender</td>
            <td className={td}><Value v={[age, patient?.Gender].filter((x) => x != null && x !== '').join(' / ')} /></td>
          </tr>
        </tbody>
      </table>

      <SectionTitle>Vital Signs</SectionTitle>
      {vitals ? <VitalTable vital={vitals} /> : <p className="text-sm text-slate-400">No vital signs recorded.</p>}

      <SectionTitle>Examination</SectionTitle>
      <table className="rx-two-line w-full border-collapse">
        <tbody>
          <tr><td className={labelTd}>History</td><td className={td}><Value v={rx?.CaseHistory} /></td></tr>
          <tr><td className={labelTd}>Treatment</td><td className={td}><Value v={rx?.Treatment} /></td></tr>
          {rx?.Observation && <tr><td className={labelTd}>Observation</td><td className={td}><Value v={rx.Observation} /></td></tr>}
          <tr><td className={labelTd}>Notes / Advice</td><td className={td}><Value v={rx?.Notes} /></td></tr>
          <tr><td className={labelTd}>Lab Tests</td><td className={td}><Value v={rx?.labTests?.map((t) => t.TestName).join(', ')} /></td></tr>
          <tr><td className={labelTd}>Next Visit Date</td><td className={td}><Value v={fmtDate(rx?.NextVisitDate)} /></td></tr>
        </tbody>
      </table>

      {/* More than 3 medicines: the Medicines part starts on its own page. */}
      <div style={meds.length > 3 ? { breakBefore: 'page', pageBreakBefore: 'always' } : undefined}>
      <SectionTitle>Medicines</SectionTitle>
      {meds.length > 0 ? (
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
            {meds.map((it, n) => (
              <tr key={n}>
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

      <div className="mt-10 flex justify-end text-sm font-semibold">
        <span className="border-t border-slate-800 px-6 pt-1">Doctor&apos;s Signature</span>
      </div>
    </div>
  );
}
