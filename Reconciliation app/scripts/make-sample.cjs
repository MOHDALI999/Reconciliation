'use strict';
/** Builds two demo workbooks that contain every tricky case the engine handles. */
const XLSX = require('xlsx');
const fs = require('node:fs');
const path = require('node:path');

const out = path.join(__dirname, '..', 'samples');
fs.mkdirSync(out, { recursive: true });

const orders = [['Order ID', 'Order Date', 'Customer', 'Freight', 'Order Amount']];
const tally = [['Voucher Ref', 'Voucher Date', 'Party', 'Freight', 'Amount']];

// Customer names, so the automatic text comparison has real work to do.
const NAMES = [
  'ABC Traders Pvt. Ltd.', 'Mumbai Steel & Alloys', 'Sunrise Exports', 'Delhi Cement Works',
  'Kaveri Agro Foods', 'Nova Print Solutions', 'Sharma Brothers Hardware', 'Bluewave Logistics',
  'Patel Textiles Pvt Ltd', 'Gateway Chemicals', 'Orient Paper Mills', 'Sai Electricals',
  'Konkan Marine Supplies', 'Rathi Metal Corporation', 'Vertex Auto Parts', 'Deccan Spice Traders',
  'Aurora Packaging', 'Trident Tools & Dies', 'Pioneer Rubber Industries', 'Ganesh Timber Depot',
];

/**
 * How the tally side spells the same customer. Every variation below is a
 * formatting or wording difference, never a different company.
 */
function partyName(name, i) {
  if (i % 7 === 0) return name.toUpperCase();                       // case only
  if (i % 11 === 0) return name.replace(/[.,&]/g, '').replace(/\s+/g, '  '); // punctuation + spacing
  if (i % 13 === 0) return name.split(' ').reverse().join(' ');      // words reordered
  if (i % 19 === 0) return name.replace(/s\b/, '');                  // singular/plural slip
  if (i % 37 === 0) return 'Cash Sale';                              // genuinely different party
  return name;
}

for (let i = 1; i <= 400; i++) {
  const id = `OD${1000 + i}`;
  const amt = 1000 + i * 7.5;
  const date = `${(i % 27) + 1}/03/2026`;
  const name = NAMES[i % NAMES.length];
  const party = partyName(name, i);
  orders.push([id, date, name, 150.5, amt]);
  if (i % 23 === 0) continue;                                  // only in file A
  if (i % 17 === 0) { tally.push([`OD-${1000 + i}`, date, party, 150.5, `${(amt + 3).toFixed(2)}`]); continue; } // small break
  if (i % 29 === 0) {                                          // split settlement 1:2
    tally.push([`OD ${1000 + i}`, date, party, 150.5, (amt * 0.4).toFixed(2)]);
    tally.push([`OD ${1000 + i}`, date, party, 150.5, (amt * 0.6).toFixed(2)]);
    continue;
  }
  if (i % 31 === 0) { tally.push([`od/${1000 + i}`, date, party, '150.50', `${amt.toFixed(2)} Cr`]); continue; } // Cr + messy key
  tally.push([`OD${1000 + i}`, date, party, '150.50', amt.toFixed(2)]);
}
orders.push(['', '5/03/2026', 'Unknown customer', 150.5, 999]);  // blank key
orders.push(['Grand Total', '', '', '', 123456]);                 // spreadsheet total row
tally.push(['OD9999', '5/03/2026', 'Ghost Party Enterprises', '150.50', '4500.00']); // only in file B

const write = (aoa, sheet, file) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet);
  XLSX.writeFile(wb, path.join(out, file));
};
write(orders, 'Orders', 'sample-orders.xlsx');
write(tally, 'Tally', 'sample-tally.xlsx');
console.log('wrote samples/sample-orders.xlsx and samples/sample-tally.xlsx');
