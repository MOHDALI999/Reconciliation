# Order vs Tally reconciliation — v6

## Reconciliation behaviour (v6)

```
Order ID -> find matching record -> compare text -> compare date -> show result
```

| Result | Meaning |
|---|---|
| **Matched** | Same Order ID in File A and File B, and every compared field passes |
| **Mismatched** | Same Order ID in both files, but at least one compared field fails |
| **Only in File A** | Order ID is in File A but not in File B |
| **Only in File B** | Order ID is in File B but not in File A |

* Text: similarity **50% or more -> Matched**, below 50% -> Mismatched (50, 51, 75, 90, 100 match; 49, 40 do not).
* Date: **File A date - File B date**; 0 -> Matched, anything else -> Mismatched (15/09/2026 vs 16/09/2026 = -1).
* Amount: File A - File B at zero tolerance (configurable on the Rules screen).

### Output columns (screen, Excel and CSV)

* **Matched / Mismatched**: `Order ID (File A)`, `Order ID (File B)`, then for every field you selected:
  text -> `A value`, `B value`, `Similarity %`; date -> `A date`, `B date`, `Diff (A - B) days`;
  amount -> `A value`, `B value`, `Diff (A - B)`; and finally `Result`.
* **Only in File A**: the File A row exactly as it is in File A (same columns, same values and formats).
* **Only in File B**: the File B row exactly as it is in File B.
* No `Row`, `Side`, reason or technical columns. No decorative symbols; values are written exactly as in the files.
  CSV files carry a UTF-8 BOM so Excel shows every character correctly.
* **All Data**: all four results in one list with the Matched / Mismatched columns. `Result` says which one each row is
  (Matched, Mismatched, Only in File A, Only in File B). Only-in-A rows leave the File B cells empty and only-in-B rows
  leave the File A cells empty; Similarity % and Diff are empty for those rows.
* **Download Excel (all results)** gives one workbook with 5 sheets: All Data, Matched, Mismatched, Only in File A, Only in File B.
  The Excel / CSV buttons next to the tabs download just the result you are looking at.

---

# Earlier notes (v3.1)

Upload two spreadsheets, press **Compare files**, get **Match / Not Match** for every row,
download an Excel with your data on sheet 1 and the reasoning on sheet 2. Underneath it is
still a reconciliation tool you can defend to an auditor: every source row is accounted for,
every match says which rule produced it, and 500k × 500k runs never enter the API process heap.

## The three promises of v3.1

1. **One text rule.** Text similarity of **50 % or more → Match**, below 50 % → **Not Match**.
   No "review" band. The line is configurable (Advanced → *Text match line*), 50 is the default.
2. **What you see is what is in the file.** Every value in the review grid, the details drawer
   and the Excel export is the text the spreadsheet itself displayed — `1,234.50` stays
   `1,234.50`, `02-Mar-26` stays `02-Mar-26` — never the engine's parsed or reformatted form.
3. **Details live on sheet 2.** Sheet 1 of the export is the data plus Match / Not Match
   columns, nothing else; sheet 2 carries every explanation; sheet 3 carries the run
   parameters. In the UI, details open in a side drawer with a *Details* tab — never below
   the grid.

## Run it

```bash
npm install
npm run dev:all       # API on :8787, app on :3000
```

Other scripts:

| command | what it does |
|---|---|
| `npm test` | 78 golden tests covering every correctness rule (text engine, planner, original-value display, Excel export) |
| `npm run bench 500000` | engine timing / memory at scale |
| `node scripts/make-sample.cjs` | writes `samples/` demo workbooks (duplicates, splits, Cr, blank keys) |
| `node scripts/make-jv-sample.cjs` | writes `samples/sample-tally-jv.xlsx`, whose refs carry a different prefix (`JV-CF-1001`) so prefix learning is visible |
| `node scripts/make-formatted-sample.cjs` | writes `samples/sample-*-formatted.xlsx` with true Excel dates in mixed formats and `#,##0.00` amounts, to prove values are shown as-is |
| `API_BASE=http://localhost:8787 node scripts/e2e-xlsx.mjs [fileA] [fileB]` | end-to-end: upload, automatic run, download the Excel and inspect all three sheets |
| `npm run build` | production build of the frontend |

## Shape of the system

```
upload  → file stored on disk, parsed in a short-lived worker
          (browser receives metadata + 30 preview rows + column profile only)
run     → a dedicated worker owns the rows and the compact result index
review  → pages and row detail are pulled from that worker on demand
export  → the worker writes CSV or XLSX to disk, the API pipes it out
```

`server/core/export.cjs` — the Excel export (sheet 1 data, sheet 2 details, sheet 3 run info).

`server/core/values.cjs` — money (integer paise, Dr/Cr, EU formats), key normalisation, dates (1904 epoch, 1970 pivot, serial guard).
`server/core/engine.cjs` — cardinality-aware matching, tie-out, typed-array result index.
`server/core/workbook.cjs` — one-pass spreadsheet ingestion; keeps the raw value *and* the text each cell displayed.
`server/core/plan.cjs` — the automatic plan: key pair, prefixes to strip, and the field rules.
`src/` — three-step UI: Upload files → Check rules (optional) → Results.

## Guarantees the engine enforces

1. No source row is dropped. Blank keys, spreadsheet total rows and filtered rows become an explicit *Excluded* bucket, and the run proves `rows in = rows accounted for` plus a value tie-out.
2. A file B row is consumed at most once. Duplicate keys are ranked (fewest breaks → smallest amount distance → stable order); a genuine tie is reported as *Ambiguous* instead of guessed.
3. 1:N and N:1 are matched as one group when the amounts balance; group tolerance defaults to zero.
4. Money is compared in integer minor units, so `0.1 + 0.2 == 0.3`.
5. Comparison type comes from the column profile plus your override — never from the column name.
6. Dates use a per-column format with an asymmetric day window, and an ambiguous DD/MM vs MM/DD column is surfaced before the run instead of failing every row.

## Automatic plan (upload two files and run)

The normal path is: load both files, press **Run reconciliation**. Nothing else is asked for.
The planner runs inside the run worker, which already holds both full datasets, so planning
costs no extra parse and no extra copy of the rows.

What it works out from the data, in order:

1. **The key pair.** Every column of A is profiled against every column of B. Candidates are
   scored on how many sampled values actually meet on the other side (weighted far above
   everything else), then on whether the column reads like an identifier, how few transforms
   it needs, name similarity, and uniqueness. Date columns are never keys; amount columns are
   only keys when they are whole numbers, not money/tax/qty-named, and ≥95% unique — so
   `Order Amount` is never mistaken for a reference.
2. **The prefixes to strip.** For each side independently, the longest leading run shared by
   ≥90% of sampled values, with trailing digits trimmed back, required to start with a letter
   and to leave digits behind. `OD1013` vs `JV-CF-1013` therefore matches by learning `OD` on
   A and `JV-CF-` on B. A prefix (or a leading-zero drop) is only kept when it makes *more*
   keys meet than leaving it alone.
3. **The field pairs.** Remaining columns are paired by detected concept first (amount, date,
   party, narration, qty, tax) and by header similarity second, and compared as amount / date /
   text according to the column profile — never the column name.

When coverage is poor the plan is marked **weak** and says so on screen rather than
pretending. Every choice carries its reason, shown under *Why these N choices* on the Review
screen and on the Rules screen.

### Remembered rules

If you open the Rules screen and change anything, that version is saved against a fingerprint
of the two files' column names (`recon.rules.v1` in `localStorage`, newest 12 kept). Next time
you load files with the same columns, the run starts from your version and both screens say
so; **Detect again** throws them away and works everything out from the data. Your values
always win over detection — the planner only fills what you left alone.

## Automatic text comparison engine

`server/core/text.cjs` is the whole engine. Nothing about it is exposed as a choice: the
user never picks "fuzzy", "Levenshtein", "Jaro-Winkler", "token matching" or a
normalisation preset. A field pair typed `auto` is classified from the data profile
(`amount`, `date`, `identifier`, `text`, or unknown) and text pairs are scored
automatically. Amount, date and identifier comparison is untouched and still uses its own
specialised logic.

### Pipeline (cheapest reliable check first)

```
original A, original B
  → missing / empty check        → NOT_FOUND_IN_B | NOT_FOUND_IN_A | EMPTY (no scoring at all)
  → raw exact                    → 100
  → normalise both sides         → cached per value
  → normalised exact             → 100, matchType NORMALIZED_EXACT
  → token analysis               → set overlap + alignment
  → character similarity         → Levenshtein ratio + Jaro-Winkler, direct and token-sorted
  → weighted score               → one number, 0–100, two decimals kept internally
  → classification               → Match (≥ 50 %) | Not Match (< 50 %)
```

### Normalisation (documented, conservative)

Unicode NFKC → optional case fold (off when *Case sensitive* is on) → collapse separators
and punctuation to single spaces → strip characters that are neither letter nor number →
trim. Nothing is stemmed, transliterated, abbreviated or spell-corrected, because that
could change the identity of a financial value. The original A and B strings are never
modified — they are carried through to the UI and the export alongside the normalised
forms.

### Score

```
score = 0.55 · tokenSimilarity + 0.30 · charSimilarity(token-sorted) + 0.15 · charSimilarity(direct)
```

Token similarity carries the most weight, so reordered names
(`Konkan Marine Supplies` vs `Supplies Marine Konkan`) score high while genuinely
different parties do not. Character similarity is the max of the Levenshtein ratio and
Jaro-Winkler on each form. The result is always computed — there is no branch anywhere in
the codebase that assigns a percentage, and no randomness or model call is involved, so
the same pair always yields the same number. The full precision value (e.g. `91.00`,
`96.41`) is stored; the UI rounds only for display.

### The 50 % rule (configurable, in the UI under *Advanced → Text match line*)

| result | default | meaning |
|---|---|---|
| **Match** | score ≥ 50 | the two texts are treated as the same |
| **Not Match** | score < 50 | different text; the row is reported as a *Break* |

There is no middle band. A text cell that is a Match does not break the row; a text cell
that is Not Match does (unless the rule is marked informational). The line only *labels* a
score, it never changes it — the same pair always yields the same number. Identifier columns
keep exact-key semantics: 95 % similar is still a different invoice. Missing values on one
side are reported as *Not Match · missing in A/B* and are never fuzzy-compared.

Per run the line is `settings.textThresholds.match` (0–100). The pre-3.1 shape
`{ high, review }` is still accepted by the API so old saved rules validate, but it is ignored:
the line is always 50 unless `match` is given.

### Explainability

Every text cell returns `{ originalA, originalB, normalizedA, normalizedB, similarity,
status, matchType, reason, decision }` plus the raw signals (token score, direct and sorted
character scores, Levenshtein, Jaro-Winkler, token counts, weights used). `reason` says
what differs (*file A has "limited" where file B has "ltd"*); `decision` states the rule
(*67.68% ≥ 50% → Match*). The drawer's *Details* tab shows this as *How "X" was scored*, and
sheet 2 of the Excel export carries every field.

## What you see is what is in the file

`workbook.cjs` reads each sheet once and keeps two aligned views of every row: the raw value
the engine computes on (numbers, dates, strings) and — only where it differs — the text the
spreadsheet displayed for that cell (SheetJS's `w` field) together with its number format
(`z`). Text cells therefore cost no extra memory; only formatted numbers and dates carry a
second string. The review grid, the drawer, the CSV's source columns and sheet 1 of the Excel
export all show that displayed text. The engine's parsed form (`₹1,234.50`, `01/03/2026`) is
kept as `parsedA` / `parsedB` and appears only in the details. CSV input is read with
`raw: true`, so `1,234.50` in a CSV stays the literal string `1,234.50`.

In the Excel export the source cells are written back as **typed** cells — a number stays
a number and a date stays a date, each with its original format string — so Excel displays
the same text the user saw and totals still work.

## Excel export (`GET /api/runs/:id/export.xlsx?tab=all|matched|breaks|…`)

| sheet | contents |
|---|---|
| **Data** | `#`, every column of file A as-is, every column of file B as-is, `Result` (Match / Not Match for the row), one `Match? (colA vs colB)` column per compared text field. Header + rows only; nothing beneath. |
| **Details** | one clean line per row per compared field: `#`, Key (File A), Key (File B), Field, File A value, File B value, Similarity % (text fields only), Result (Match / Not Match). No technical scoring columns. |

Only-in-B rows are appended to the *all* and *needs attention* scopes with empty file-A cells.
The workbook is built in memory, so the Excel export is capped at 250,000 rows; the CSV export
has no cap. The CSV export still exists (`/export?tab=…&full=1`) and now carries `Result` and
`Text match?` columns plus the source columns as shown.

### Large data

Normalised values are memoised (120k entries) and compared pairs are memoised (250k), both
keyed by the raw string, so a repeated party name is normalised once. Comparison is linear
in the number of matched rows — no O(n²) sweep — and strings longer than 256 characters are
compared on a bounded prefix (flagged as `truncated` in the signals). Scoring happens
inside the run's `worker_thread`, off the API event loop, so the UI stays responsive; the
frontend keeps its virtualised grid and windowed paging untouched.
