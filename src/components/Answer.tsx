/* Renders an agent answer: markdown text, plus every markdown table as a data table
   with a Chart toggle when the table has numeric columns. */
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { downloadTablesAsExcel, downloadWorkbook, extractFileBlocks, planWorkbook, type Attachment, type FileBlock } from '../lib/excel';
import { Icon } from '../lib/icons';

type Seg = { kind: 'md'; text: string } | { kind: 'table'; head: string[]; rows: string[][] };

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
// Genie tables use single-dash separators (|-|-|), so accept one or more dashes
const isSep = (line: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-');

export function splitAnswer(text: string): Seg[] {
  const lines = text.split('\n'), out: Seg[] = [];
  let buf: string[] = [];
  const flush = () => { if (buf.join('').trim()) out.push({ kind: 'md', text: buf.join('\n') }); buf = []; };
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      flush();
      const head = cells(lines[i]), rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cells(lines[i])); i++; }
      i--;
      out.push({ kind: 'table', head, rows: rows.map((r) => head.map((_, j) => r[j] ?? '')) });
    } else buf.push(lines[i]);
  }
  flush();
  return out;
}

/** "₹3.55 Cr", "−4.5%", "1,142", "(0.33)" → number; anything else → null */
export function toNum(s: string): number | null {
  let t = s.replace(/\*\*/g, '').replace(/[₹$,\s]/g, '').replace(/[−–]/g, '-')
    .replace(/\/[a-z]+$/i, '')                                   // ₹/kWh, /pack, /kg …
    .replace(/(cr|crore|l|lakh|mt|kg|days?|d|pp|%|x|pk|units?)$/i, '');
  const neg = /^\(.*\)$/.test(t);
  t = t.replace(/[()]/g, '').replace(/^\+/, '');
  if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(t)) return null;
  const n = parseFloat(t);
  return neg ? -n : n;
}
const TIME = /^(fy\s?\d{2,4}|q[1-4]|h[12]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}-\d{2}|w(ee)?k\s?\d+)/i;

function analyse(head: string[], rows: string[][]) {
  if (rows.length < 2 || head.length < 2) return null;
  const numeric = head.map((_, j) => {
    const ok = rows.filter((r) => toNum(r[j]) !== null).length;
    return ok >= Math.max(2, rows.length * 0.7);
  });
  const label = numeric.findIndex((n) => !n);
  if (label < 0) return null;
  // skip "variance"/"%" style columns when real value columns exist — they distort the scale
  let series = head.map((h, j) => j).filter((j) => numeric[j] && j !== label);
  const value = series.filter((j) => !/var|change|diff|delta|%|share|status/i.test(head[j]));
  if (value.length) series = value;
  series = series.slice(0, 3);
  if (!series.length) return null;
  const time = rows.filter((r) => TIME.test(r[label].replace(/\*\*/g, ''))).length >= rows.length * 0.7;
  return { label, series, kind: time ? 'line' : 'bar' as 'line' | 'bar' };
}

const COLORS = ['var(--brand)', 'var(--vio)', 'var(--a-fill)'];
const fmt = (n: number) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-IN') : +n.toFixed(2) + '');

function Chart({ head, rows, spec }: { head: string[]; rows: string[][]; spec: NonNullable<ReturnType<typeof analyse>> }) {
  const labels = rows.map((r) => r[spec.label].replace(/\*\*/g, ''));
  const data = spec.series.map((j) => rows.map((r) => toNum(r[j]) ?? 0));
  const all = data.flat();
  // bars start at zero; lines zoom to the data so a real trend isn't flattened
  let mn = spec.kind === 'bar' ? Math.min(0, ...all) : Math.min(...all), mx = spec.kind === 'bar' ? Math.max(0, ...all) : Math.max(...all);
  if (spec.kind === 'line') { const pad = (mx - mn || Math.abs(mx) || 1) * 0.15; mn -= pad; mx += pad; }
  if (mx === mn) mx = mn + 1;
  const W = 520, H = 220, L = 46, R = 10, T = 14, B = 44;
  const y = (v: number) => T + ((mx - v) / (mx - mn || 1)) * (H - T - B);
  const band = (W - L - R) / labels.length;
  const ticks = Array.from({ length: 4 }, (_, i) => mn + ((mx - mn) * i) / 3);
  return (
    <div className="ch">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${spec.kind} chart of ${spec.series.map((j) => head[j]).join(', ')} by ${head[spec.label]}`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="ch-grid" />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" className="ch-ax">{fmt(t)}</text>
          </g>
        ))}
        {mn <= 0 && mx >= 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="ch-zero" />}
        {spec.kind === 'bar'
          ? data.map((s, si) => s.map((v, i) => {
              const bw = Math.min(28, (band * 0.72) / data.length), x = L + i * band + (band - bw * data.length) / 2 + si * bw;
              return (
                <rect key={si + '-' + i} x={x} width={bw - 2} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={3} fill={COLORS[si]}>
                  <title>{`${labels[i]} · ${head[spec.series[si]]}: ${rows[i][spec.series[si]]}`}</title>
                </rect>
              );
            }))
          : data.map((s, si) => (
              <g key={si}>
                <polyline fill="none" stroke={COLORS[si]} strokeWidth={2.2} strokeLinejoin="round"
                  points={s.map((v, i) => `${L + i * band + band / 2},${y(v)}`).join(' ')} />
                {s.map((v, i) => (
                  <circle key={i} cx={L + i * band + band / 2} cy={y(v)} r={3.5} fill={COLORS[si]} stroke="#fff" strokeWidth={1.5}>
                    <title>{`${labels[i]} · ${head[spec.series[si]]}: ${rows[i][spec.series[si]]}`}</title>
                  </circle>
                ))}
              </g>
            ))}
        {labels.map((l, i) => (
          <text key={i} x={L + i * band + band / 2} y={H - B + 16} textAnchor="middle" className="ch-ax">
            {l.length > 12 ? l.slice(0, 11) + '…' : l}
          </text>
        ))}
      </svg>
      {spec.series.length > 1 && (
        <div className="ch-leg">{spec.series.map((j, i) => <span key={j}><i style={{ background: COLORS[i] }} />{head[j]}</span>)}</div>
      )}
    </div>
  );
}

function DataTable({ head, rows, preferChart }: { head: string[]; rows: string[][]; preferChart: boolean }) {
  const spec = useMemo(() => analyse(head, rows), [head, rows]);
  const [view, setView] = useState<'table' | 'chart'>(spec && preferChart ? 'chart' : 'table');
  const copy = () => {
    const tsv = [head, ...rows].map((r) => r.map((c) => c.replace(/\*\*/g, '')).join('\t')).join('\n');
    navigator.clipboard?.writeText(tsv);
  };
  return (
    <div className="dt">
      <div className="dt-bar">
        {spec && (
          <div className="seg seg-light sm2" role="radiogroup" aria-label="Show as">
            <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}><Icon n="grid2" size={12} />Table</button>
            <button className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}><Icon n="stack" size={12} />Chart</button>
          </div>
        )}
        <button className="dt-copy" onClick={copy} title="Copy table (paste into Excel)"><Icon n="copy" size={13} /></button>
        <button className="dt-copy dt-xl" onClick={() => downloadTablesAsExcel([{ head, rows }])} title="Download this table as Excel"><Icon n="sheet" size={13} />Excel</button>
      </div>
      {view === 'chart' && spec ? <Chart head={head} rows={rows} spec={spec} /> : (
        <div className="dt-scroll">
          <table>
            <thead><tr>{head.map((h, i) => <th key={i} className={spec && spec.series.includes(i) || rows.every((r) => toNum(r[i]) !== null) ? 'num' : ''}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => {
                const n = toNum(c);
                return <td key={j} className={n !== null ? 'num' : ''}><ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>{c}</ReactMarkdown></td>;
              })}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FileCard({ f, source }: { f: FileBlock; source?: Attachment }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const plan = useMemo(() => (f.ok ? planWorkbook(f.spec, source) : null), [f, source]);
  if (!f.ok || !plan) {
    return (
      <div className="xf xf-bad" role="alert">
        <Icon n="sheet" size={18} />
        <div className="xf-meta"><b>The Excel file from the agent could not be read</b><span>{!f.ok && f.error}. Ask again, or ask for a smaller extract.</span></div>
      </div>
    );
  }
  const go = async () => {
    setBusy(true); setErr('');
    try { await downloadWorkbook(f.spec, source); }
    catch (e: any) { setErr(e?.message || 'The file could not be built.'); }
    finally { setBusy(false); }
  };
  const rows = (r: unknown[][]) => Math.max(0, r.length - 1).toLocaleString();
  return (
    <div className={'xf' + (plan.gaps ? ' xf-warn' : '')}>
      <div className="xf-top">
        <Icon n="sheet" size={18} />
        <div className="xf-meta">
          <b title={plan.filename}>{plan.filename}</b>
          <span>{plan.base ? <>Built on your file <em>{plan.base.name}</em></> : 'New workbook from the agent'}</span>
        </div>
        <button className="xf-dl" onClick={go} disabled={busy}>{busy ? 'Preparing…' : 'Download .xlsx'}</button>
      </div>
      <ul className="xf-sheets" aria-label="Sheets in this file">
        {plan.keep.map((n) => <li key={'k' + n} className="orig" title="Original sheet, formatting kept"><i>Original</i>{n}</li>)}
        {plan.add.map((s) => <li key={'a' + s.name} className="new" title={s.changed ? `The agent changed "${s.changed}"; your original is kept alongside` : 'New sheet from the agent'}><i>{s.changed ? 'Updated' : 'New'}</i>{s.name}<em>{rows(s.rows)} rows</em></li>)}
      </ul>
      {(plan.dropped.length > 0 || plan.gaps || plan.notes.length > 0 || err) && (
        <div className="xf-notes">
          {plan.dropped.length > 0 && <p>The agent repeated {plan.dropped.map((n) => `“${n}”`).join(', ')} from your file. Your original is used instead, so its formatting is kept.</p>}
          {plan.gaps && <p className="warn">Some cells contain “…”, so the agent may have left rows out. Check the file, or ask again for every row.</p>}
          {plan.notes.map((n) => <p key={n}>{n}</p>)}
          {err && <p className="warn" role="alert">{err}</p>}
        </div>
      )}
    </div>
  );
}

export function Answer({ text, question, source }: { text: string; question: string; source?: Attachment }) {
  const parsed = useMemo(() => extractFileBlocks(text), [text]);
  const segs = useMemo(() => splitAnswer(parsed.text), [parsed.text]);
  const preferChart = /\b(chart|graph|plot|trend|visuali[sz]e|compare)\b/i.test(question);
  const tables = segs.filter((s): s is Extract<Seg, { kind: 'table' }> => s.kind === 'table');
  return (
    <div className="ans">
      {parsed.files.map((f, i) => <FileCard key={'f' + i} f={f} source={source} />)}
      {parsed.pending && <div className="xf xf-wait"><Icon n="sheet" size={18} /><div className="xf-meta"><b>Preparing Excel file…</b></div></div>}
      {tables.length > 1 && (
        <button className="ans-xl" onClick={() => downloadTablesAsExcel(tables)}>
          <Icon n="sheet" size={14} />Download all {tables.length} tables as Excel
        </button>
      )}
      {segs.map((s, i) => s.kind === 'md'
        ? <div key={i} className="md"><ReactMarkdown>{s.text}</ReactMarkdown></div>
        : <DataTable key={i} head={s.head} rows={s.rows} preferChart={preferChart} />)}
    </div>
  );
}
