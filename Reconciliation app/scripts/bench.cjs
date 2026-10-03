'use strict';
/** Measures the engine at scale. Usage: node scripts/bench.cjs [rows] */
const { reconcile, getPage } = require('../server/core/engine.cjs');

const N = Number(process.argv[2] || 500000);
const rowsA = new Array(N);
const rowsB = new Array(N);
for (let i = 0; i < N; i++) {
  const amt = 100 + (i % 9000);
  rowsA[i] = { id: `OD${i}`, amount: amt, date: `${(i % 28) + 1}/03/2026`, party: `Party ${i % 5000}` };
  rowsB[i] = { ref: `OD${i}`, amount: i % 37 === 0 ? amt + 5 : amt, voucherDate: `${(i % 28) + 1}/03/2026`, party: `Party ${i % 5000}` };
}

const t0 = Date.now();
const run = reconcile({
  rowsA, rowsB,
  headersA: Object.keys(rowsA[0]), headersB: Object.keys(rowsB[0]),
  settings: {
    keyA: 'id', keyB: 'ref',
    pairs: [
      { id: 'p1', colA: 'amount', colB: 'amount', type: 'amount' },
      { id: 'p2', colA: 'date', colB: 'voucherDate', type: 'date', dateFormatA: 'DMY', dateFormatB: 'DMY' },
      { id: 'p3', colA: 'party', colB: 'party', type: 'text' },
    ],
  },
});
const matchMs = Date.now() - t0;
const t1 = Date.now();
const page = getPage(run, rowsA, rowsB, { tab: 'breaks', offset: 0, limit: 100 });
const pageMs = Date.now() - t1;
const mb = (b) => Math.round(b / 1048576);
const m = process.memoryUsage();

console.log(JSON.stringify({
  rows: N,
  matchMs,
  pageMs,
  heapUsedMb: mb(m.heapUsed),
  rssMb: mb(m.rss),
  counts: run.counts,
  tieOut: run.integrity.ok,
  breakRowsReturned: page.rows.length,
  breakTotal: page.total,
}, null, 2));
