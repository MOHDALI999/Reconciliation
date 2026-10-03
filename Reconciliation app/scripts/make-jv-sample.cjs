'use strict';
/**
 * Second ledger sample: the same vouchers as sample-tally.xlsx, but referenced
 * as JV-CF-1001 instead of OD1001. Used to show that the engine works out which
 * prefix to ignore on each side on its own, from the data.
 *
 *   node scripts/make-jv-sample.cjs
 */

const XLSX=require('xlsx');
const wb=XLSX.readFile('samples/sample-tally.xlsx');
const sh=wb.Sheets[wb.SheetNames[0]];
const rows=XLSX.utils.sheet_to_json(sh,{defval:null,raw:true});
for(const r of rows){const d=String(r['Voucher Ref']??'').replace(/\D/g,'');if(d)r['Voucher Ref']='JV-CF-'+d;}
const out=XLSX.utils.json_to_sheet(rows);
const nb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(nb,out,'Tally');
XLSX.writeFile(nb,'samples/sample-tally-jv.xlsx');
console.log('rows',rows.length, rows.slice(0,3).map(r=>r['Voucher Ref']));
