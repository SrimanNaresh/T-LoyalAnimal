// Billing > Bill Entry > Common Bill: fee types (Add / Edit / Delete from the
// Fee Type dropdown) and bills of Patient + Fee Type + Amount.
import { Router } from 'express';
import { getPool, sql } from '../../db/pool.js';

const router = Router();

const fail = (res, err) => {
  if (err.number === 2627 || err.number === 2601) return res.status(400).json({ error: 'That fee type already exists' });
  if (err.number === 547) return res.status(400).json({ error: 'This fee type is used on saved bills and cannot be deleted' });
  return res.status(500).json({ error: err.message });
};

// ---- Fee types ----
router.get('/fee-types', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT FeeTypeId, Name FROM FeeType ORDER BY Name');
    res.json(r.recordset);
  } catch (err) { fail(res, err); }
});

router.post('/fee-types', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Fee type name is required' });
    const pool = await getPool();
    const r = await pool.request().input('name', sql.NVarChar(100), name)
      .query('INSERT INTO FeeType (Name) OUTPUT INSERTED.FeeTypeId, INSERTED.Name VALUES (@name)');
    res.json(r.recordset[0]);
  } catch (err) { fail(res, err); }
});

router.put('/fee-types/:id', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Fee type name is required' });
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, Number(req.params.id)).input('name', sql.NVarChar(100), name)
      .query('UPDATE FeeType SET Name = @name OUTPUT INSERTED.FeeTypeId, INSERTED.Name WHERE FeeTypeId = @id');
    if (!r.recordset.length) return res.status(404).json({ error: 'Fee type not found' });
    res.json(r.recordset[0]);
  } catch (err) { fail(res, err); }
});

router.delete('/fee-types/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, Number(req.params.id)).query('DELETE FROM FeeType WHERE FeeTypeId = @id');
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// ---- Bills (one patient, many fee lines) ----
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });
    const pool = await getPool();
    const r = await pool.request().input('date', sql.Date, date).query(`
      SELECT b.CommonBillId, b.PatientId, b.BillDate, b.TotalAmount,
             p.Name AS PatientName, p.OwnerName, p.MobileNo,
             i.CommonBillItemId, i.FeeTypeId, i.Amount, f.Name AS FeeTypeName
      FROM CommonBill b
      INNER JOIN Patient p ON p.PatientId = b.PatientId
      LEFT JOIN CommonBillItem i ON i.CommonBillId = b.CommonBillId
      LEFT JOIN FeeType f ON f.FeeTypeId = i.FeeTypeId
      WHERE b.BillDate = @date
      ORDER BY b.CommonBillId DESC, i.CommonBillItemId ASC`);
    const bills = [];
    const byId = new Map();
    for (const row of r.recordset) {
      let bill = byId.get(row.CommonBillId);
      if (!bill) {
        bill = {
          CommonBillId: row.CommonBillId, PatientId: row.PatientId, BillDate: row.BillDate,
          TotalAmount: Number(row.TotalAmount), PatientName: row.PatientName,
          OwnerName: row.OwnerName, MobileNo: row.MobileNo, items: [],
        };
        byId.set(row.CommonBillId, bill);
        bills.push(bill);
      }
      if (row.CommonBillItemId) {
        bill.items.push({ FeeTypeId: row.FeeTypeId, FeeTypeName: row.FeeTypeName, Amount: Number(row.Amount) });
      }
    }
    res.json(bills);
  } catch (err) { fail(res, err); }
});

const readBill = (body) => {
  const patientId = Number(body.patientId);
  if (!patientId) return { error: 'Patient is required' };
  if (!body.date) return { error: 'date is required' };
  const items = (Array.isArray(body.items) ? body.items : []).map((it) => ({
    feeTypeId: Number(it.feeTypeId), amount: Number(it.amount),
  }));
  if (!items.length) return { error: 'Add at least one fee line' };
  if (items.some((it) => !it.feeTypeId)) return { error: 'Select a fee type on every line' };
  if (new Set(items.map((it) => it.feeTypeId)).size !== items.length) return { error: 'Each fee type can be used only once per bill' };
  if (items.some((it) => !(it.amount > 0))) return { error: 'Amount must be more than 0 on every line' };
  const total = Number(items.reduce((s, it) => s + it.amount, 0).toFixed(2));
  return { patientId, date: body.date, items, total };
};

// Save header + lines together; on edit the old lines are replaced.
const saveBill = async (b, id) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const head = new sql.Request(tx)
      .input('patientId', sql.Int, b.patientId)
      .input('date', sql.Date, b.date)
      .input('total', sql.Decimal(12, 2), b.total);
    let billId = id;
    if (id) {
      const r = await head.input('id', sql.Int, id).query(`
        UPDATE CommonBill SET PatientId = @patientId, BillDate = @date, TotalAmount = @total, UpdatedAt = GETDATE()
        OUTPUT INSERTED.CommonBillId WHERE CommonBillId = @id`);
      if (!r.recordset.length) { await tx.rollback(); return null; }
      await new sql.Request(tx).input('id', sql.Int, id).query('DELETE FROM CommonBillItem WHERE CommonBillId = @id');
    } else {
      const r = await head.query(`
        INSERT INTO CommonBill (PatientId, BillDate, TotalAmount)
        OUTPUT INSERTED.CommonBillId VALUES (@patientId, @date, @total)`);
      billId = r.recordset[0].CommonBillId;
    }
    for (const it of b.items) {
      await new sql.Request(tx)
        .input('billId', sql.Int, billId)
        .input('feeTypeId', sql.Int, it.feeTypeId)
        .input('amount', sql.Decimal(10, 2), it.amount)
        .query('INSERT INTO CommonBillItem (CommonBillId, FeeTypeId, Amount) VALUES (@billId, @feeTypeId, @amount)');
    }
    await tx.commit();
    return { CommonBillId: billId, TotalAmount: b.total };
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
};

router.post('/', async (req, res) => {
  try {
    const b = readBill(req.body);
    if (b.error) return res.status(400).json(b);
    res.json(await saveBill(b, null));
  } catch (err) { fail(res, err); }
});

router.put('/:id', async (req, res) => {
  try {
    const b = readBill(req.body);
    if (b.error) return res.status(400).json(b);
    const saved = await saveBill(b, Number(req.params.id));
    if (!saved) return res.status(404).json({ error: 'Bill not found' });
    res.json(saved);
  } catch (err) { fail(res, err); }
});

export default router;
