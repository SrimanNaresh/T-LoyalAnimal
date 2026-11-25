import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';

const router = Router();

const MUCOUS_MEMBRANES = ['Pink', 'Pale', 'Red', 'Blue', 'Yellow'];

// Pet examination text fields: [body key, SQL param/column, max length].
const EXAM_TEXT_FIELDS = [
  ['skinCoat', 'SkinCoat', 200],
  ['cmm', 'CMM', 100],
  ['stt', 'STT', 50],
  ['crp', 'CRP', 50],
  ['vmm', 'VMM', 100],
  ['oralCavity', 'OralCavity', 500],
  ['abdominalExam', 'AbdominalExam', 1000],
  ['rectalExam', 'RectalExam', 1000],
];
const EXAM_COLUMNS = EXAM_TEXT_FIELDS.map(([, col]) => col);

// Pet vitals added on top of the original fields.
function addPetVitalInputs(request, body) {
  const bcs = Number(body.bodyConditionScore);
  for (const [key, col, max] of EXAM_TEXT_FIELDS) {
    const v = (body[key] ?? '').toString().trim().slice(0, max);
    request.input(col, sql.NVarChar, v || null);
  }
  return request
    .input('heartRate', sql.Int, body.heartRate || null)
    .input('respiratoryRate', sql.Int, body.respiratoryRate || null)
    .input('bodyConditionScore', sql.TinyInt, Number.isInteger(bcs) && bcs >= 1 && bcs <= 9 ? bcs : null)
    .input('mucousMembrane', sql.NVarChar, MUCOUS_MEMBRANES.includes(body.mucousMembrane) ? body.mucousMembrane : null);
}

// List vitals, optionally by patient / search / date (YYYY-MM-DD).
router.get('/', async (req, res) => {
  try {
    const { patientId = '', search = '', date = '' } = req.query;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('patientId', sql.Int, patientId ? Number(patientId) : null)
      .input('search', sql.NVarChar, `%${search}%`)
      .input('date', sql.Date, date || null)
      .query(`
        SELECT v.*, p.Name AS PatientName, p.MobileNo, p.OwnerName, p.Species, p.Breed
        FROM VitalSign v
        INNER JOIN Patient p ON p.PatientId = v.PatientId
        WHERE (@patientId IS NULL OR v.PatientId = @patientId)
          AND (@search = '%%' OR p.Name LIKE @search OR p.OwnerName LIKE @search OR p.MobileNo LIKE @search)
          AND (@date IS NULL OR CAST(v.RecordedAt AS DATE) = @date)
        ORDER BY v.RecordedAt DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await addPetVitalInputs(pool.request(), req.body)
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM VitalSign WHERE VitalId = @id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { patientId, height, weight, bloodPressure, pulseRate, temperature, comments } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });
    const pool = await getPool();
    const result = await addPetVitalInputs(pool.request(), req.body)
      .input('patientId', sql.Int, patientId)
      .input('height', sql.Decimal(6, 2), height || null)
      .input('weight', sql.Decimal(6, 2), weight || null)
      .input('bloodPressure', sql.NVarChar, bloodPressure || null)
      .input('pulseRate', sql.Int, pulseRate || null)
      .input('temperature', sql.Decimal(5, 2), temperature || null)
      .input('comments', sql.NVarChar, comments || null)
      .query(`
        INSERT INTO VitalSign (PatientId, Height, Weight, BloodPressure, PulseRate, Temperature, Comments,
          RespiratoryRate, BodyConditionScore, MucousMembrane, HeartRate, ${EXAM_COLUMNS.join(', ')})
        OUTPUT INSERTED.*
        VALUES (@patientId, @height, @weight, @bloodPressure, @pulseRate, @temperature, @comments,
          @respiratoryRate, @bodyConditionScore, @mucousMembrane, @heartRate, ${EXAM_COLUMNS.map((c) => `@${c}`).join(', ')})
      `);

    // Auto-advance today's confirmation status to 'Pre-Examine' if still at 'Confirm'.
    // Non-fatal: never let this break the vital save.
    try {
      await pool
        .request()
        .input('patientId', sql.Int, patientId)
        .query(`
          UPDATE PatientConfirmation SET Status = 'Pre-Examine'
          WHERE PatientId = @patientId
            AND CAST(ConfirmedAt AS DATE) = CAST(GETDATE() AS DATE)
            AND Status = 'Confirm'
        `);
    } catch { /* ignore status bump errors */ }

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { height, weight, bloodPressure, pulseRate, temperature, comments } = req.body;
    const pool = await getPool();
    const result = await addPetVitalInputs(pool.request(), req.body)
      .input('id', sql.Int, req.params.id)
      .input('height', sql.Decimal(6, 2), height || null)
      .input('weight', sql.Decimal(6, 2), weight || null)
      .input('bloodPressure', sql.NVarChar, bloodPressure || null)
      .input('pulseRate', sql.Int, pulseRate || null)
      .input('temperature', sql.Decimal(5, 2), temperature || null)
      .input('comments', sql.NVarChar, comments || null)
      .query(`
        UPDATE VitalSign
        SET Height=@height, Weight=@weight, BloodPressure=@bloodPressure,
            PulseRate=@pulseRate, Temperature=@temperature, Comments=@comments,
            RespiratoryRate=@respiratoryRate, BodyConditionScore=@bodyConditionScore, MucousMembrane=@mucousMembrane,
            HeartRate=@heartRate, ${EXAM_COLUMNS.map((c) => `${c}=@${c}`).join(', ')}
        OUTPUT INSERTED.*
        WHERE VitalId=@id
      `);
    if (!result.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
