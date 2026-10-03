'use strict';
/**
 * Demo workbooks with real Excel formatting — true date cells with mixed
 * formats, amounts with thousands separators — so the "shown exactly as in
 * the file" promise has something to prove against.
 */
const XLSX = require('xlsx');
const fs = require('node:fs');
const path = require('node:path');

const out = path.join(__dirname, '..', 'samples');
fs.mkdirSync(out, { recursive: true });

const NAMES = [
  'ABC Traders Pvt. Ltd.', 'Mumbai Steel & Alloys', 'Sunrise Exports', 'Delhi Cement Works',
  'Kaveri Agro Foods', 'Nova Print Solutions', 'Sharma Brothers Hardware', 'Bluewave Logistics',
];
const party = (name, i) => {
  if (i % 5 === 0) return name.toUpperCase();
  if (i % 7 === 0) return name.replace(/[.,&]/g, '');
  if (i % 9 === 0) return name.split(' ').reverse().join(' ');
  if (i % 11 === 0) return 'Cash Sale';
  if (i % 13 === 0) return name.replace(/Pvt\. Ltd\./, 'Private Limited');
  return name;
};

const orders = [['Order ID', 'Order Date', 'Customer', 'Order Amount']];
const tally = [['Voucher Ref', 'Voucher Date', 'Party', 'Amount']];
for (let i = 1; i <= 60; i++) {
  const d = new Date(Date.UTC(2026, 2, (i % 28) + 1));
  const amt = 1000 + i * 137.25;
  orders.push([`OD${2000 + i}`, d, NAMES[i % NAMES.length], amt]);
  if (i % 17 === 0) continue;
  tally.push([`OD-${2000 + i}`, d, party(NAMES[i % NAMES.length], i), i % 19 === 0 ? amt + 1 : amt]);
}

const write = (aoa, sheet, file, dateFormats, amountFormat) => {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  for (let r = 1; r < aoa.length; r++) {
    ws[XLSX.utils.encode_cell({ r, c: 1 })].z = dateFormats[r % dateFormats.length];
    ws[XLSX.utils.encode_cell({ r, c: 3 })].z = amountFormat;
  }
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, path.join(out, file), { cellDates: true });
};
write(orders, 'Orders', 'sample-orders-formatted.xlsx', ['dd-mmm-yyyy', 'dd/mm/yyyy'], '#,##0.00');
write(tally, 'Tally', 'sample-tally-formatted.xlsx', ['d-mmm-yy'], '0.00');
console.log('wrote samples/sample-orders-formatted.xlsx and samples/sample-tally-formatted.xlsx');
