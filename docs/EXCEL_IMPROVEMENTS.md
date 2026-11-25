# Excel improvements (frontend only)

Builds on the 16 Nov xlsx feature. No changes to `server/index.js`, `app.yaml`, the supervisor agent or the Genie spaces.

## What changed

1. **Original file kept in the browser.** The uploaded workbook's bytes stay in memory (never uploaded or stored), so downloads can be built on top of it.
2. **More accurate text for the agent.** Dates are sent as `YYYY-MM-DD` instead of "12-Nov", blank rows are kept, and each sheet gets a short note of cell colours and merged cells (for example `yellow fill (#FFFF00): D4:G4, D5:H5`).
3. **Merge instead of rebuild.** When the agent's ```xlsx reply repeats an attached sheet unchanged, that copy is dropped and the original sheet (with its formatting) is used. Only new sheets are added. If the agent changed an attached sheet, its version is added as "<name> (updated)" next to the original.
4. **ExcelJS for writing.** Downloads keep the original fills, fonts, borders, number formats, column widths and merged cells. New sheets get a bold header, frozen top row, filters, number formats and column widths. Per-table "Excel" downloads use the same formatting. SheetJS is still used for reading (it handles `.xls` and `.csv`).
5. **"Excel" toggle in the chat input.** Adds "Return the result as a downloadable Excel file." to the question, which the server's existing file detection picks up. Resets after each question.
6. **Clearer file card.** Shows which sheets are original and which are new, and warns when the agent's data contains "…" (rows may be missing) or when an original sheet can't keep formatting (CSV, old `.xls`, macros in `.xlsm`).

## Files

| File | Change |
| --- | --- |
| `src/lib/excel.ts` | New reading (dates, blank rows, colour notes, original bytes kept), `planWorkbook()` merge logic, ExcelJS writer for agent files and answer tables |
| `src/components/Answer.tsx` | File card shows original/new sheets and warnings; builds on the attached file |
| `src/components/AskDock.tsx` | Each answer remembers the latest attached file; "Excel" toggle; "Excel file requested" tag on the question |
| `src/styles/chat.css` | Styles for the file card sheets list, warnings and the toggle |
| `package.json`, `package-lock.json` | Adds `exceljs` 4.4.0 (from npm) |

## Tested with

`genie_agent_plan_simple (1).xlsx` as the upload and the agent's `COGS_FY26_with_Plan.xlsx` reply: the download keeps the yellow timeline bars, pink blocker cells, grey header and real dates on "Plan", and adds a formatted "FY26 COGS Trend" sheet. The agent's plain-text copy of "Plan" is dropped.

## Limits

- The server and supervisor instructions still ask the agent to repeat attached sheets, so replies are not shorter or faster yet. The copy is discarded in the browser.
- Charts, pivot tables, images and macros in uploaded files may be simplified or dropped by ExcelJS.
- Numbers in new sheets are only as accurate as the agent's reply.
- `exceljs` brings an older `uuid` dependency flagged by `npm audit` (moderate). ExcelJS only uses it to generate random IDs, which is not the affected code path.
- The ExcelJS bundle (~940 KB, ~270 KB gzipped) loads only when a user downloads an Excel file. Vite prints a chunk-size warning for it during build; the build still succeeds.
