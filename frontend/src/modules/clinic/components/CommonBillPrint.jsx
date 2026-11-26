import { useEffect, useState } from 'react';

// The saved letter pad (Coming Up's > Prescription for Your Letter Pad) has
// the hospital header across its top: logo, name, address, phone numbers and
// the red/blue rule under them; below that, the two doctors and the
// "Veterinary Prescription" badge. Fractions of the image height:
export const HEADER_BILL = 0.175;         // hospital strip only (bills)
export const HEADER_PRESCRIPTION = 0.262; // strip + doctors + badge (prescriptions)

const fmtMoney = (n) => `₹${Number(n || 0).toFixed(2)}`;

// Cuts the top of the letter pad image (fraction of its height) into its own image.
export function useLetterPadHeader(imageData, fraction = HEADER_BILL) {
  const [header, setHeader] = useState('');
  useEffect(() => {
    if (!imageData) { setHeader(''); return undefined; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const h = Math.round(img.naturalHeight * fraction);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, img.naturalWidth, h, 0, 0, img.naturalWidth, h);
      setHeader(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => { if (!cancelled) setHeader(''); };
    img.src = imageData;
    return () => { cancelled = true; };
  }, [imageData, fraction]);
  return header;
}

/**
 * Printed Common Bill on A4: letter pad header image, patient details, the
 * fee lines and the total. bill = { billNo, date, patientName, ownerName,
 * mobileNo, items: [{ name, amount }] }
 */
export default function CommonBillPrint({ headerImage, bill }) {
  const total = bill.items.reduce((s, it) => s + Number(it.amount || 0), 0);
  return (
    <div className="hidden print:block">
      <style>{'@page { size: A4; margin: 8mm; }'}</style>
      <div className="text-ink-900">
        {headerImage
          ? <img src={headerImage} alt="" className="block w-full" />
          : <div className="border-b-2 border-ink-800 pb-2 text-center text-xl font-bold">Bill</div>}

        <h2 className="mt-4 text-center text-base font-bold uppercase tracking-widest">Bill</h2>

        <table className="mt-3 w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1"><span className="font-semibold">Patient Name:</span> {bill.patientName || '-'}</td>
              <td className="py-1 text-right"><span className="font-semibold">Bill No:</span> {bill.billNo ?? '-'}</td>
            </tr>
            <tr>
              <td className="py-1">
                <span className="font-semibold">Owner Name:</span> {bill.ownerName || '-'}
                <span className="ml-8 font-semibold">Mobile:</span> {bill.mobileNo || '-'}
              </td>
              <td className="py-1 text-right">
                <span className="font-semibold">Date:</span> {new Date(`${bill.date}T00:00:00`).toLocaleDateString('en-GB')}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-ink-800">
              <th className="w-12 px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">Fee Type</th>
              <th className="w-40 px-2 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((it, i) => (
              <tr key={i} className="border-b border-ink-200">
                <td className="px-2 py-1.5">{i + 1}</td>
                <td className="px-2 py-1.5">{it.name}</td>
                <td className="px-2 py-1.5 text-right">{fmtMoney(it.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-y-2 border-ink-800 text-base font-bold">
              <td className="px-2 py-1.5" colSpan={2}>Total</td>
              <td className="px-2 py-1.5 text-right">{fmtMoney(total)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-16 flex justify-end text-sm font-semibold">
          <span className="border-t border-ink-800 px-6 pt-1">Authorised Signature</span>
        </div>
      </div>
    </div>
  );
}
