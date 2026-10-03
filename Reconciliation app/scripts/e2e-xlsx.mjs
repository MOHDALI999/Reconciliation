// End-to-end check: upload two workbooks, run automatically, download the
// Excel (4 result sheets) and one CSV per result, and print what they hold.
//   API_BASE=http://localhost:8787 node scripts/e2e-xlsx.mjs samples/sample-orders.xlsx samples/sample-tally.xlsx
import { readFileSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';

const BASE = process.env.API_BASE || 'http://localhost:8787';
const [fileA = 'samples/sample-orders.xlsx', fileB = 'samples/sample-tally.xlsx'] = process.argv.slice(2);
const j = async (res) => { const t = await res.text(); const d = t ? JSON.parse(t) : {}; if (!res.ok) throw new Error(d.message || res.status); return d; };
const upload = async (p) => {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(p)]), p.split('/').pop());
  return j(await fetch(`${BASE}/api/files`, { method: 'POST', body: form }));
};

const a = await upload(fileA);
const b = await upload(fileB);
const { runId } = await j(await fetch(`${BASE}/api/runs`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileIdA: a.fileId, fileIdB: b.fileId, settings: { auto: true } }),
}));
let state;
for (let i = 0; i < 100; i++) {
  state = await j(await fetch(`${BASE}/api/runs/${runId}`));
  if (state.status !== 'running') break;
  await new Promise((r) => setTimeout(r, 200));
}
if (state.status !== 'ready') throw new Error(`run ${state.status}: ${state.error}`);
const c = state.summary.counts;
console.log('Matched', c.matched, '| Mismatched', c.mismatch, '| Only in File A', c.onlyA, '| Only in File B', c.onlyB);
console.log('Key', state.summary.keyA, '/', state.summary.keyB, '| fields', state.summary.pairs.map((p) => `${p.label} [${p.type}]`).join(', '));

const res = await fetch(`${BASE}/api/runs/${runId}/export.xlsx?tab=all`);
if (!res.ok) throw new Error(`xlsx export ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
const outPath = `/tmp/e2e-export-${Date.now()}.xlsx`;
writeFileSync(outPath, buf);
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, cellNF: true });
console.log('xlsx', res.headers.get('content-disposition'), '| sheets', wb.SheetNames, '| saved', outPath);
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
  console.log(`\n[${name}] ${rows.length - 1} rows`);
  for (const r of rows.slice(0, 4)) console.log('  ', r.join(' | '));
}
for (const tab of ['matched', 'breaks', 'onlyA', 'onlyB']) {
  const csv = await (await fetch(`${BASE}/api/runs/${runId}/export?tab=${tab}`)).text();
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
  console.log(`\nCSV ${tab} (BOM ${csv.charCodeAt(0) === 0xfeff}):`, lines[0], '\n  ', lines[1]);
}
