/* Spreadsheet helpers for the chat. Everything here runs in the browser.

   Upload  - readSpreadsheet() reads ONE Excel/CSV file, keeps the original bytes in memory, and turns
             it into text for the agent: CSV per sheet with real dates, blank rows kept, and a short
             note of cell colours and merged cells. The file is never uploaded or stored anywhere.
   Reply   - the agent answers with a ```xlsx JSON block (see extractFileBlocks). planWorkbook()
             works out how that block fits the attached file, and downloadWorkbook() builds the .xlsx:
             the ORIGINAL file is reopened with its formatting and only the new sheets are added.
             If the agent repeats an attached sheet unchanged, that copy is dropped.
   Tables  - downloadTablesAsExcel() saves tables from an answer as a formatted workbook.

   Reading uses SheetJS (handles .xlsx, .xls, .csv). Writing uses ExcelJS, which keeps the original
   formatting (fills, fonts, borders, number formats, widths, merged cells) when it saves.
   No size limits: meant for small sheets that fit the model's context. */
import type { Workbook, Worksheet } from 'exceljs';

export const ACCEPT = '.xlsx,.xlsm,.xls,.csv';

export interface SourceSheet {
  name: string;
  /** cell values as read: numbers, booleans, Dates, strings ('' for empty) */
  values: unknown[][];
  /** the same cells as the text the agent saw */
  text: string[][];
  /** the same cells as Excel displays them (e.g. "12-Nov"), used to recognise copies the agent sends back */
  shown: string[][];
}
export interface Attachment {
  name: string;
  /** text block sent to the agent */
  text: string;
  /** short label for the UI, e.g. "2 sheets · 340 rows" */
  summary: string;
  kind: 'xlsx' | 'xlsm' | 'xls' | 'csv';
  /** original file bytes, kept in memory so the download can reuse the file with its formatting */
  buffer: ArrayBuffer;
  sheets: SourceSheet[];
}

/* ---------------- reading ---------------- */

const pad = (n: number) => String(n).padStart(2, '0');
// dates are kept as UTC midnight (plus time, if any) so they never shift with the user's timezone
function isoDate(d: Date) {
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return d.getUTCHours() || d.getUTCMinutes() ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day;
}
const csvCell = (v: string) => {
  const s = v.replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** rough colour name so the agent can talk about "yellow bars" rather than hex codes */
function colourName(hex: string) {
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510, d = max - min;
  if (d < 20) return l > 0.9 ? 'white' : l > 0.6 ? 'light grey' : l > 0.3 ? 'grey' : 'black';
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const tone = l > 0.75 ? 'light ' : l < 0.3 ? 'dark ' : '';
  const name = h < 15 || h >= 340 ? (l > 0.7 ? 'pink' : 'red') : h < 45 ? 'orange' : h < 70 ? 'yellow' : h < 165 ? 'green' : h < 200 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : 'pink';
  return name === 'pink' ? name : tone + name;
}

export async function readSpreadsheet(file: File): Promise<Attachment> {
  const ext = /\.(xlsx|xlsm|xls|csv)$/i.exec(file.name)?.[1].toLowerCase() as Attachment['kind'] | undefined;
  if (!ext) throw new Error('Only Excel (.xlsx, .xls) or CSV files can be attached.');

  // loaded on demand so the library is not in the main bundle
  const mod: any = await import('xlsx');
  const XLSX: typeof import('xlsx') = mod.SSF ? mod : mod.default; // ESM build in the browser, CommonJS elsewhere
  const buffer = await file.arrayBuffer();
  // dates are read as serial numbers and decoded below, which does not depend on the timezone
  const wb = XLSX.read(buffer.slice(0), { type: 'array', cellDates: false, cellStyles: true });
  const asDate = (cell: any): Date | null => {
    if (cell?.t !== 'n' || !cell.z || !XLSX.SSF.is_date(cell.z)) return null;
    const p = XLSX.SSF.parse_date_code(cell.v);
    return p ? new Date(Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, Math.round(p.S))) : null;
  };

  let totalRows = 0;
  const blocks: string[] = [], sheets: SourceSheet[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // a CSV has no sheet names; use the file name so the sheet reads "plants" rather than "Sheet1"
    const name = ext === 'csv' ? file.name.replace(/\.csv$/i, '').replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31) || sheetName : sheetName;
    if (!ws?.['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const values: unknown[][] = [], text: string[][] = [], shown: string[][] = [];
    const fills = new Map<string, Map<number, number[]>>(); // colour -> row -> columns

    for (let r = range.s.r; r <= range.e.r; r++) {
      const vr: unknown[] = [], tr: string[] = [], sr: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell: any = ws[XLSX.utils.encode_cell({ r, c })];
        let v: unknown = '', t = '';
        if (cell && cell.v !== undefined && cell.v !== null) {
          const d = cell.v instanceof Date ? cell.v : asDate(cell);
          if (d) { v = d; t = isoDate(d); }
          else { v = cell.v; t = cell.w ?? String(cell.v); }
        }
        vr.push(v); tr.push(t); sr.push(cell?.w ?? t);
        const rgb: string | undefined = cell?.s?.fgColor?.rgb;
        if (rgb && cell.s.patternType !== 'none') {
          const hex = rgb.slice(-6).toUpperCase();
          if (hex !== 'FFFFFF') {
            const byRow = fills.get(hex) ?? new Map<number, number[]>();
            byRow.set(r, [...(byRow.get(r) ?? []), c]);
            fills.set(hex, byRow);
          }
        }
      }
      values.push(vr); text.push(tr); shown.push(sr);
    }

    // trim empty rows/columns at the end; blank rows inside the sheet are kept so the layout reads right
    const filled = (row: string[]) => row.some((x) => x.trim() !== '');
    while (text.length && !filled(text[text.length - 1])) { text.pop(); values.pop(); shown.pop(); }
    if (!text.length) continue;
    let width = 0;
    for (const row of text) { let l = row.length; while (l > 0 && !row[l - 1].trim()) l--; width = Math.max(width, l); }
    text.forEach((row, i) => { text[i] = row.slice(0, width); values[i] = values[i].slice(0, width); shown[i] = shown[i].slice(0, width); });

    const dataRows = text.filter(filled).length;
    totalRows += Math.max(0, dataRows - 1);

    const start = XLSX.utils.encode_cell(range.s);
    const lines = [`### Sheet "${name}" (${text.length} rows × ${width} columns${start !== 'A1' ? `, starting at cell ${start}` : ''})`];
    lines.push('```csv', ...text.map((row) => row.map(csvCell).join(',')), '```');

    // formatting note: coloured cells grouped into ranges per row, plus merged cells
    const notes: string[] = [];
    for (const [hex, byRow] of fills) {
      const parts: string[] = [];
      for (const [r, cols] of [...byRow].sort((a, b) => a[0] - b[0])) {
        cols.sort((a, b) => a - b);
        let s = cols[0], p = cols[0];
        const push = () => parts.push(s === p ? XLSX.utils.encode_cell({ r, c: s }) : `${XLSX.utils.encode_cell({ r, c: s })}:${XLSX.utils.encode_cell({ r, c: p })}`);
        for (const c of cols.slice(1)) { if (c === p + 1) p = c; else { push(); s = p = c; } }
        push();
      }
      notes.push(`- ${colourName(hex)} fill (#${hex}): ${parts.slice(0, 40).join(', ')}${parts.length > 40 ? ', …' : ''}`);
    }
    const merges = (ws['!merges'] ?? []).map((m) => XLSX.utils.encode_range(m));
    if (merges.length) notes.push(`- merged cells: ${merges.slice(0, 30).join(', ')}${merges.length > 30 ? ', …' : ''}`);
    if (notes.length) lines.push('Formatting:', ...notes);

    blocks.push(lines.join('\n'));
    sheets.push({ name, values, text, shown });
  }

  if (!blocks.length) throw new Error('The file has no data in it.');
  const n = blocks.length;
  return {
    name: file.name, kind: ext, buffer, sheets,
    text: blocks.join('\n\n'),
    summary: `${n} sheet${n > 1 ? 's' : ''} · ${totalRows.toLocaleString()} rows`,
  };
}

/** Appended to the typed question when the user wants a file (the "Excel" toggle). */
export const EXCEL_ASK = ' Return the result as a downloadable Excel file.';

/** The question plus the file contents, in the form the agent receives it.
    The opening line is matched by server/index.js, so keep it as it is. */
export function withAttachment(question: string, a: Attachment) {
  return `${question}

Use the data from the attached spreadsheet "${a.name}" to answer. Its contents are below as CSV: dates are written as YYYY-MM-DD, blank rows are kept so the layout matches the file, and cell colours and merged cells are listed under each sheet. When your answer includes data rows, present them as a markdown table. The app keeps the original file with its formatting, so when the user wants data added to it, put the new data in separate sheets; the original sheets do not need to be repeated.

${a.text}`;
}

/* ---------------- agent-built workbooks ----------------
   The agent cannot attach files, so for file requests it replies with a fenced ```xlsx block holding
   JSON: {"filename": "x.xlsx", "sheets": [{"name": "S", "rows": [[header...], [...]]}]}. */
export interface SheetSpec { name: string; rows: unknown[][] }
export interface WorkbookSpec { filename: string; sheets: SheetSpec[] }
export type FileBlock = { ok: true; spec: WorkbookSpec } | { ok: false; error: string; raw: string };

const BLOCK = /```xlsx[^\n]*\n([\s\S]*?)```/gi;

function normalise(j: any): WorkbookSpec {
  // accept a few shapes the model may produce: {sheets:[...]}, a single sheet, or a bare rows array
  let sheets: any[] = Array.isArray(j?.sheets) ? j.sheets : Array.isArray(j?.rows) ? [j] : Array.isArray(j) ? [{ rows: j }] : [];
  sheets = sheets
    .map((s, i) => {
      let rows: unknown[][] = [];
      if (Array.isArray(s?.rows) && s.rows.every((r: unknown) => Array.isArray(r))) rows = s.rows;
      else if (Array.isArray(s?.rows) && s.rows.length && typeof s.rows[0] === 'object') {
        // rows given as objects: [{col: val}, ...]
        const head = Array.isArray(s.columns) ? s.columns : Object.keys(s.rows[0]);
        rows = [head, ...s.rows.map((o: any) => head.map((h: string) => o?.[h] ?? ''))];
      }
      if (Array.isArray(s?.columns) && rows.length && Array.isArray(s.rows?.[0]) && String(rows[0][0]) !== String(s.columns[0])) rows = [s.columns, ...rows];
      return { name: String(s?.name || `Sheet${i + 1}`), rows };
    })
    .filter((s) => s.rows.length);
  if (!sheets.length) throw new Error('The file had no rows.');
  let filename = String(j?.filename || 'vectron-export.xlsx').replace(/[\\/:*?"<>|]+/g, '_').trim();
  if (!/\.xlsx$/i.test(filename)) filename = filename.replace(/\.(xls|xlsm|csv)$/i, '') + '.xlsx';
  return { filename, sheets };
}

/** Pulls ```xlsx blocks out of an answer. `pending` is true while a block is still streaming in. */
export function extractFileBlocks(text: string): { text: string; files: FileBlock[]; pending: boolean } {
  const files: FileBlock[] = [];
  let rest = text.replace(BLOCK, (_m, body: string) => {
    try { files.push({ ok: true, spec: normalise(JSON.parse(body.trim())) }); }
    catch (e: any) { files.push({ ok: false, error: e?.message || 'Invalid file data', raw: body }); }
    return '';
  });
  const open = rest.search(/```xlsx/i);
  const pending = open >= 0;
  if (pending) rest = rest.slice(0, open);
  return { text: rest.replace(/\n{3,}/g, '\n\n').trim(), files, pending };
}

export const rowCount = (spec: WorkbookSpec) => spec.sheets.reduce((n, s) => n + Math.max(0, s.rows.length - 1), 0);

/* ---------------- how an agent workbook fits the attached file ---------------- */

const norm = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isoDate(v).slice(0, 10);
  if (typeof v === 'number') return String(+v.toFixed(6));
  const s = String(v).replace(/\*\*/g, '').trim().toLowerCase();
  const n = s.replace(/,/g, '');
  return /^-?\d*\.?\d+$/.test(n) ? String(+(+n).toFixed(6)) : s;
};
const cellSet = (rows: unknown[][]) => new Set(rows.flat().map(norm).filter(Boolean));

export interface WorkbookPlan {
  /** attached file the download is built on, if any */
  base?: Attachment;
  /** sheets of the attached file, kept as they are */
  keep: string[];
  /** sheets from the agent that are added */
  add: { name: string; rows: unknown[][]; changed?: string }[];
  /** agent copies of attached sheets that were left out because the original is kept */
  dropped: string[];
  /** cells such as "..." suggest the agent left rows out */
  gaps: boolean;
  filename: string;
  notes: string[];
}

export function planWorkbook(spec: WorkbookSpec, base?: Attachment): WorkbookPlan {
  const plan: WorkbookPlan = { base, keep: base ? base.sheets.map((s) => s.name) : [], add: [], dropped: [], gaps: false, filename: spec.filename, notes: [] };
  const sources = (base?.sheets ?? []).map((s) => ({ name: s.name, set: new Set([...cellSet(s.values), ...cellSet(s.text), ...cellSet(s.shown)]) }));

  for (const sheet of spec.sheets) {
    if (sheet.rows.some((r) => Array.isArray(r) && r.some((c) => /^\s*(\.{3}|…)\s*$/.test(String(c ?? ''))))) plan.gaps = true;
    const own = cellSet(sheet.rows);
    let match: { name: string; inSource: number; byName: boolean } | null = null;
    for (const src of sources) {
      const shared = [...own].filter((v) => src.set.has(v)).length;
      const coverage = src.set.size ? shared / src.set.size : 0;   // how much of the original it repeats
      const byName = src.name.toLowerCase() === sheet.name.trim().toLowerCase();
      if ((byName || coverage >= 0.6) && (!match || coverage > match.inSource)) match = { name: src.name, inSource: own.size ? shared / own.size : 1, byName };
    }
    if (match && match.inSource >= 0.9) plan.dropped.push(sheet.name);        // a plain copy of the original
    else if (match) plan.add.push({ name: `${match.name} (updated)`, rows: sheet.rows, changed: match.name }); // original plus changes
    else plan.add.push({ name: sheet.name, rows: sheet.rows });
  }

  if (base) {
    if (!/\.xlsx$/i.test(plan.filename) || plan.filename === 'vectron-export.xlsx') plan.filename = base.name.replace(/\.(xlsx|xlsm|xls|csv)$/i, '') + '.xlsx';
    if (base.kind === 'csv') plan.notes.push('A CSV file has no formatting, so the original sheet comes back as plain values.');
    if (base.kind === 'xls') plan.notes.push('Old .xls files cannot be reopened with their formatting, so the original sheets come back as plain values.');
    if (base.kind === 'xlsm') plan.notes.push('Macros in the original file are not kept.');
  }
  return plan;
}

/* ---------------- writing (ExcelJS) ---------------- */

async function excel() {
  const m: any = await import('exceljs');
  return (m.default ?? m) as typeof import('exceljs');
}

function save(buf: ArrayBuffer, filename: string) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function uniqueName(wb: Workbook, wanted: string) {
  const used = new Set(wb.worksheets.map((w) => w.name.toLowerCase()));
  let name = wanted.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
  for (let k = 2; used.has(name.toLowerCase()); k++) name = `${name.slice(0, 27)} (${k})`;
  return name;
}

type Cell = { v: string | number | boolean | Date | null; fmt?: string };
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;
// plain numbers and percentages become real numbers; anything with units stays text
function toCell(raw: unknown): Cell {
  if (raw === null || raw === undefined || raw === '') return { v: null };
  if (typeof raw === 'number' || typeof raw === 'boolean') return { v: raw };
  if (raw instanceof Date) return { v: raw, fmt: 'yyyy-mm-dd' };
  const s = String(raw).replace(/\*\*/g, '').trim();
  const d = ISO.exec(s);
  if (d) {
    const dt = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +(d[4] ?? 0), +(d[5] ?? 0)));
    if (!isNaN(+dt)) return { v: dt, fmt: d[4] ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd' };
  }
  const plain = s.replace(/,/g, '').replace(/[−–]/g, '-');
  if (/^-?\d*\.?\d+$/.test(plain)) return { v: Number(plain) };
  if (/^-?\d*\.?\d+%$/.test(plain)) return { v: Number(plain.slice(0, -1)) / 100, fmt: '0.0%' };
  return { v: s };
}

/** Writes rows to a new sheet: bold header, frozen top row, filters, number formats and widths. */
function writeTable(ws: Worksheet, rows: unknown[][], styled = true) {
  const cells = rows.map((r) => (Array.isArray(r) ? r : [r]).map(toCell));
  const width = Math.max(1, ...cells.map((r) => r.length));
  cells.forEach((r, i) => {
    const row = ws.getRow(i + 1);
    r.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      cell.value = c.v as any;
      if (c.fmt) cell.numFmt = c.fmt;
    });
  });

  // column number formats from the data rows (header excluded)
  for (let j = 0; j < width; j++) {
    const vals = cells.slice(1).map((r) => r[j]).filter((c) => c && c.v !== null);
    const nums = vals.filter((c) => typeof c!.v === 'number' && !c!.fmt).map((c) => c!.v as number);
    if (styled && nums.length && nums.length === vals.length) {
      const fmt = nums.every(Number.isInteger) ? (Math.max(...nums.map(Math.abs)) >= 1000 ? '#,##0' : '0') : '#,##0.00';
      for (let i = 2; i <= cells.length; i++) if (typeof cells[i - 1][j]?.v === 'number' && !cells[i - 1][j].fmt) ws.getRow(i).getCell(j + 1).numFmt = fmt;
    }
    const longest = Math.max(...cells.map((r) => {
      const c = r[j];
      if (!c || c.v === null) return 0;
      return c.v instanceof Date ? 11 : typeof c.v === 'number' ? (c.v as number).toLocaleString('en-IN').length + 1 : String(c.v).length;
    }));
    ws.getColumn(j + 1).width = Math.min(48, Math.max(9, longest + 2));
  }

  if (styled && cells.length) {
    const head = ws.getRow(1);
    for (let j = 1; j <= width; j++) {
      const c = head.getCell(j);
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1F6' } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFB8C1D1' } } };
      c.alignment = { vertical: 'middle', wrapText: true };
    }
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (cells.length > 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: width } };
  }
}

/** Builds the agent's workbook. With an attached file, the original is reopened with its formatting
    and the agent's new sheets are added after it. */
export async function downloadWorkbook(spec: WorkbookSpec, base?: Attachment) {
  const ExcelJS = await excel();
  const plan = planWorkbook(spec, base);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vectron AI';

  if (base) {
    let reopened = false;
    if (base.kind === 'xlsx' || base.kind === 'xlsm') {
      try { await wb.xlsx.load(base.buffer.slice(0)); reopened = true; } catch { /* fall back to values below */ }
    }
    if (!reopened) {
      for (const s of base.sheets) writeTable(wb.addWorksheet(uniqueName(wb, s.name)), s.values, false);
    }
  }
  for (const s of plan.add) writeTable(wb.addWorksheet(uniqueName(wb, s.name)), s.rows);
  if (!wb.worksheets.length) throw new Error('There was nothing to put in the file.');

  save(await wb.xlsx.writeBuffer() as ArrayBuffer, plan.filename);
}

/* ---------------- answer tables → .xlsx ---------------- */
export interface Table { head: string[]; rows: string[][] }

export async function downloadTablesAsExcel(tables: Table[], fileName = 'vectron-answer.xlsx') {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vectron AI';
  tables.forEach((t, i) => {
    const ws = wb.addWorksheet(uniqueName(wb, tables.length > 1 ? `Table ${i + 1}` : 'Answer'));
    writeTable(ws, [t.head.map((h) => h.replace(/\*\*/g, '')), ...t.rows]);
  });
  save(await wb.xlsx.writeBuffer() as ArrayBuffer, fileName);
}
