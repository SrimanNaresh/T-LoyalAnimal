import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';
import { NEXT_PATIENT_CODE_SQL } from '../../core/patientCode.js';

const router = Router();

const REFERRAL_TYPES = ['Doctor', 'Patient'];

// Referral is optional. Only a 'Doctor' referral keeps a clinic/hospital name
// (stored in ReferredBy, the column the Lab module also uses).
function readReferral(body) {
  const type = REFERRAL_TYPES.includes(body.referralType) ? body.referralType : null;
  const referredBy = type === 'Doctor' ? (body.referredBy || '').toString().trim() || null : null;
  return { type, referredBy };
}

const GENDERS = ['Male', 'Female'];
const AGE_UNITS = ['Years', 'Months'];
const clean = (v) => (v ?? '').toString().trim() || null;

// Pet details: the Patient row is the pet, MobileNo is the owner's mobile.
function readPet(body) {
  return {
    ownerName: clean(body.ownerName),
    species: clean(body.species),
    breed: clean(body.breed),
    color: clean(body.color),
    gender: GENDERS.includes(body.gender) ? body.gender : null,
    ageUnit: AGE_UNITS.includes(body.ageUnit) ? body.ageUnit : 'Years',
  };
}

function addPetInputs(request, pet) {
  return request
    .input('ownerName', sql.NVarChar, pet.ownerName)
    .input('species', sql.NVarChar, pet.species)
    .input('breed', sql.NVarChar, pet.breed)
    .input('color', sql.NVarChar, pet.color)
    .input('gender', sql.NVarChar, pet.gender)
    .input('ageUnit', sql.NVarChar, pet.ageUnit);
}

// List / search by name or mobile
router.get('/', async (req, res) => {
  try {
    const { search = '', mobile = '' } = req.query;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('search', sql.NVarChar, `%${search}%`)
      .input('mobile', sql.NVarChar, `%${mobile}%`)
      .query(`
        SELECT PatientId, Name, MobileNo, Address, Age, AgeUnit, Gender, OwnerName, Species, Breed, Color,
          ReferralType, ReferredBy, CreatedAt
        FROM Patient
        WHERE IsActive = 1
          AND (@search = '%%' OR Name LIKE @search OR OwnerName LIKE @search OR MobileNo LIKE @search)
          AND (@mobile = '%%' OR MobileNo LIKE @mobile)
        ORDER BY PatientId DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Next PatientId that will be assigned on insert (identity seed-aware).
// Defined before '/:id' so it isn't captured as an id param.
router.get('/next-id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT CAST(ISNULL(IDENT_CURRENT('Patient'), 0)
        + CASE WHEN (SELECT COUNT(*) FROM Patient) = 0 THEN 0 ELSE IDENT_INCR('Patient') END AS INT) AS nextId
    `);
    res.json({ nextId: result.recordset[0].nextId || 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Patient WHERE PatientId = @id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { mobileNo, address, age } = req.body;
    // Pet name is optional; Name is NOT NULL in the table, so a blank name is stored as ''.
    const name = (req.body.name ?? '').toString().trim();
    const referral = readReferral(req.body);
    const pet = readPet(req.body);
    const pool = await getPool();
    const result = await addPetInputs(pool.request(), pet)
      .input('name', sql.NVarChar, name)
      .input('mobileNo', sql.NVarChar, mobileNo || null)
      .input('address', sql.NVarChar, address || null)
      .input('age', sql.Int, age || null)
      .input('referralType', sql.NVarChar, referral.type)
      .input('referredBy', sql.NVarChar, referral.referredBy)
      .query(`
        INSERT INTO Patient (Name, MobileNo, Address, Age, ReferralType, ReferredBy,
          OwnerName, Species, Breed, Color, Gender, AgeUnit, PatientCode)
        OUTPUT INSERTED.*
        VALUES (@name, @mobileNo, @address, @age, @referralType, @referredBy,
          @ownerName, @species, @breed, @color, @gender, @ageUnit, ${NEXT_PATIENT_CODE_SQL})
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { mobileNo, address, age } = req.body;
    const name = (req.body.name ?? '').toString().trim();
    const referral = readReferral(req.body);
    const pet = readPet(req.body);
    const pool = await getPool();
    const result = await addPetInputs(pool.request(), pet)
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('mobileNo', sql.NVarChar, mobileNo || null)
      .input('address', sql.NVarChar, address || null)
      .input('age', sql.Int, age || null)
      .input('referralType', sql.NVarChar, referral.type)
      .input('referredBy', sql.NVarChar, referral.referredBy)
      .query(`
        UPDATE Patient SET Name=@name, MobileNo=@mobileNo, Address=@address, Age=@age,
          ReferralType=@referralType, ReferredBy=@referredBy,
          OwnerName=@ownerName, Species=@species, Breed=@breed, Color=@color, Gender=@gender, AgeUnit=@ageUnit,
          UpdatedAt=GETDATE()
        OUTPUT INSERTED.*
        WHERE PatientId=@id
      `);
    if (!result.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE Patient SET IsActive = 0 WHERE PatientId = @id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk insert / update. Rows with a numeric PatientId are updated, others inserted.
router.post('/bulk', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array is required' });
  }
  const pool = await getPool();
  let inserted = 0;
  let updated = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = (r.name ?? r.Name ?? '').toString().trim();
    const mobileNo = (r.mobileNo ?? r.MobileNo ?? '').toString().trim() || null;
    const address = (r.address ?? r.Address ?? '').toString().trim() || null;
    const pet = readPet({
      ownerName: r.ownerName ?? r.OwnerName,
      species: r.species ?? r.Species,
      breed: r.breed ?? r.Breed,
      color: r.color ?? r.Color,
      gender: r.gender ?? r.Gender,
      ageUnit: r.ageUnit ?? r.AgeUnit,
    });
    const id = Number(r.patientId ?? r.PatientId);
    if (!name && !pet.ownerName) {
      errors.push({ row: i + 1, error: 'Name or OwnerName is required' });
      continue;
    }
    try {
      if (Number.isInteger(id) && id > 0) {
        const upd = await addPetInputs(pool.request(), pet)
          .input('id', sql.Int, id)
          .input('name', sql.NVarChar, name)
          .input('mobileNo', sql.NVarChar, mobileNo)
          .input('address', sql.NVarChar, address)
          .query(`
            UPDATE Patient SET Name=@name, MobileNo=@mobileNo, Address=@address,
              OwnerName=@ownerName, Species=@species, Breed=@breed, Color=@color, Gender=@gender
            WHERE PatientId=@id;
            SELECT @@ROWCOUNT AS affected;
          `);
        if (upd.recordset[0].affected > 0) updated++;
        else errors.push({ row: i + 1, error: `PatientId ${id} not found` });
      } else {
        await addPetInputs(pool.request(), pet)
          .input('name', sql.NVarChar, name)
          .input('mobileNo', sql.NVarChar, mobileNo)
          .input('address', sql.NVarChar, address)
          .query(`INSERT INTO Patient (Name, MobileNo, Address, OwnerName, Species, Breed, Color, Gender, AgeUnit, PatientCode)
            VALUES (@name, @mobileNo, @address, @ownerName, @species, @breed, @color, @gender, @ageUnit, ${NEXT_PATIENT_CODE_SQL})`);
        inserted++;
      }
    } catch (err) {
      errors.push({ row: i + 1, error: err.message });
    }
  }
  res.json({ inserted, updated, failed: errors.length, errors });
});

export default router;
