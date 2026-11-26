import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Pencil, Printer, Plus } from 'lucide-react';
import { PageHeader, CardHeader, Spinner, EmptyState, Toast } from '../../../../components/ui.jsx';
import CommonBillPrint, { useLetterPadHeader } from '../../components/CommonBillPrint.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { commonBillApi, clinicApi } from '../../api.js';
import { localDateKey } from '../../../../utils/localDate.js';

const fmtMoney = (n) => `₹${Number(n || 0).toFixed(2)}`;

// Billing > Bill Entry > Common Bill List: the day's common bills, with Edit
// (opens the bill on the Common Bill screen) and Print.
export default function BillingCommonBillList() {
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const [date, setDate] = useState(localDateKey());
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [letterPad, setLetterPad] = useState('');
  const headerImage = useLetterPadHeader(letterPad);
  const [printBill, setPrintBill] = useState(null);

  const loadBills = async (d) => {
    setLoading(true);
    try { setBills(await commonBillApi.list(d)); }
    catch (err) { show(err.response?.data?.error || 'Failed to load bills', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadBills(date);
    clinicApi.get().then((c) => setLetterPad(c?.PrescriptionAttachment || '')).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!printBill) return undefined;
    const t = setTimeout(() => window.print(), 100);
    const done = () => setPrintBill(null);
    window.addEventListener('afterprint', done);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printBill]);

  const printSaved = (b) => setPrintBill({
    billNo: b.CommonBillId,
    date: localDateKey(new Date(b.BillDate)),
    patientName: b.PatientName,
    ownerName: b.OwnerName,
    mobileNo: b.MobileNo,
    items: b.items.map((it) => ({ name: it.FeeTypeName, amount: it.Amount })),
  });

  const edit = (b) => navigate(`/clinic/billing/common-bill?edit=${b.CommonBillId}&date=${date}`);

  const dayTotal = bills.reduce((s, b) => s + Number(b.TotalAmount || 0), 0);

  return (
    <div>
      <div className={printBill ? 'print:hidden' : ''}>
        <PageHeader
          title="Billing - Common Bill List"
          actions={(
            <button type="button" className="btn-primary" onClick={() => navigate('/clinic/billing/common-bill')}>
              <Plus size={16} /> New Bill
            </button>
          )}
        />

        <div className="card">
          <CardHeader
            icon={List}
            title="Common Bills"
            subtitle={new Date(`${date}T00:00:00`).toLocaleDateString()}
            actions={(
              <input
                type="date" className="input w-44" value={date}
                onChange={(e) => { setDate(e.target.value); if (e.target.value) loadBills(e.target.value); }}
              />
            )}
          />
          {loading ? <Spinner /> : bills.length === 0 ? (
            <EmptyState message="No common bills for this date." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-13">
                <thead>
                  <tr className="table-head">
                    <th className="rounded-l-lg px-2.5 py-1.5">#</th>
                    <th className="px-2.5 py-1.5">Patient</th>
                    <th className="px-2.5 py-1.5">Mobile</th>
                    <th className="px-2.5 py-1.5">Fees</th>
                    <th className="px-2.5 py-1.5 text-right">Total</th>
                    <th className="rounded-r-lg px-2.5 py-1.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b, i) => (
                    <tr key={b.CommonBillId} className="table-row align-top">
                      <td className="px-2.5 py-1 text-slate-500">{bills.length - i}</td>
                      <td className="px-2.5 py-1 font-medium text-slate-700">{b.PatientName || `${b.OwnerName || 'Owner'}'s pet`}</td>
                      <td className="px-2.5 py-1 text-slate-500">{b.MobileNo || '-'}</td>
                      <td className="px-2.5 py-1">
                        {b.items.map((it, j) => (
                          <div key={j} className="flex justify-between gap-4">
                            <span>{it.FeeTypeName}</span>
                            <span className="text-slate-500">{fmtMoney(it.Amount)}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-2.5 py-1 text-right font-semibold text-slate-800">{fmtMoney(b.TotalAmount)}</td>
                      <td className="px-2.5 py-1">
                        <div className="flex justify-end gap-1">
                          <button type="button" className="btn-ghost !p-1.5 text-amber-600 hover:bg-amber-50" title="Edit" onClick={() => edit(b)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="btn-ghost !p-1.5 text-teal-600 hover:bg-teal-50" title="Print" onClick={() => printSaved(b)}>
                            <Printer size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink-200 text-sm font-semibold text-slate-800">
                    <td className="px-2.5 py-1" colSpan={4}>Total ({bills.length} bills)</td>
                    <td className="px-2.5 py-1 text-right">{fmtMoney(dayTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {printBill && <CommonBillPrint headerImage={headerImage} bill={printBill} />}

      <Toast toast={toast} />
    </div>
  );
}
