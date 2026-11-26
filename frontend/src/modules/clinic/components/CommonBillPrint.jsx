import { useEffect, useState } from 'react';

// The saved letter pad (Coming Up's > Prescription for Your Letter Pad) has
// the hospital header across its top: logo, name, address, phone numbers and
// the red/blue rule under them; below that, the two doctors and the
// "Veterinary Prescription" badge. Fractions of the image height:
export const HEADER_BILL = 0.175;         // hospital strip only (bills)
export const HEADER_PRESCRIPTION = 0.262; // strip + doctors + badge (prescriptions)
// The two doctors' details on the letter pad, [left, top, right, bottom] as
// fractions of the full image, plus how much to thicken (2 = names, 1 = the
// smaller degree / Reg. No. / phone text). The prescription print bolds them.
export const DOCTOR_NAME_BOXES = [
  [0.08, 0.178, 0.293, 0.204, 2], // Dr. K KANAGARAJ
  [0.293, 0.178, 0.385, 0.204, 1], //   BVSc & AH
  [0.15, 0.204, 0.33, 0.223, 1], //   Reg. No.
  [0.14, 0.223, 0.31, 0.246, 1], //   phone
  [0.64, 0.178, 0.852, 0.204, 2], // Dr. POOJASHRI V
  [0.852, 0.178, 0.925, 0.204, 1], //   BVSc & AH
  [0.71, 0.204, 0.86, 0.223, 1], //   Reg. No.
  [0.70, 0.223, 0.86, 0.246, 1], //   phone
];
const SCALE = 3; // header is redrawn at 3x so the thickened text stays smooth

// Makes the text inside each box heavier: every pixel takes its darkest
// neighbour's colour (thicker strokes), then the ink is deepened.
function boldenRegions(g, W, H, boxes, radius = 2) {
  for (const [fx1, fy1, fx2, fy2, r = radius] of boxes) {
    const x = Math.round(fx1 * W); const y = Math.round(fy1 * H);
    const w = Math.round((fx2 - fx1) * W); const h = Math.round((fy2 - fy1) * H);
    const img = g.getImageData(x, y, w, h);
    const s = img.data;
    const out = new Uint8ClampedArray(s);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let mr = 255; let mg = 255; let mb = 255;
        for (let dj = -r; dj <= r; dj++) {
          const jj = j + dj;
          if (jj >= 0 && jj < h) {
            for (let di = -r; di <= r; di++) {
              const ii = i + di;
              if (ii >= 0 && ii < w && di * di + dj * dj <= r * r + 1) {
                const k = (jj * w + ii) * 4;
                if (s[k] + s[k + 1] + s[k + 2] < mr + mg + mb) { mr = s[k]; mg = s[k + 1]; mb = s[k + 2]; }
              }
            }
          }
        }
        const k = (j * w + i) * 4;
        const lum = (mr + mg + mb) / 3;
        const t = lum < 200 ? Math.min(1, (200 - lum) / 80) : 0;
        out[k] = mr * (1 - 0.25 * t);
        out[k + 1] = mg * (1 - 0.7 * t);
        out[k + 2] = mb * (1 - 0.7 * t);
      }
    }
    img.data.set(out);
    g.putImageData(img, x, y);
  }
}

const fmtMoney = (n) => `₹${Number(n || 0).toFixed(2)}`;

// Cuts the top of the letter pad image (fraction of its height) into its own
// image; boldBoxes (optional) are regions whose text is made bolder.
export function useLetterPadHeader(imageData, fraction = HEADER_BILL, boldBoxes = null) {
  const [header, setHeader] = useState('');
  useEffect(() => {
    if (!imageData) { setHeader(''); return undefined; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const W = img.naturalWidth; const H = img.naturalHeight;
      const h = Math.round(H * fraction);
      const scale = boldBoxes?.length ? SCALE : 1;
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = h * scale;
      const g = canvas.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, W, h, 0, 0, W * scale, h * scale);
      if (boldBoxes?.length) boldenRegions(g, W * scale, H * scale, boldBoxes);
      setHeader(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => { if (!cancelled) setHeader(''); };
    img.src = imageData;
    return () => { cancelled = true; };
  }, [imageData, fraction, boldBoxes]);
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
