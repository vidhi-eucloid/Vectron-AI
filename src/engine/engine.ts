/* Calculation engine — period roll-ups, tolerance bands, Plant Health Index,
   contribution analysis. Pure functions of (Ctx, inputs); no DOM. */
import { D, KBY, KPIS, PLANTS, PBY, PHIW, PLAT, type Kpi, type Plant, type Platform, type GroupId } from './data';

export type Band = 'red' | 'amber' | 'green';
export type Basis = 'target' | 'base';
export interface Ctx {
  type: 'all' | Platform;
  plant: string;       // 'all' or a plant id
  year: number;        // index into YEARS
  m0: number; m1: number;  // fiscal month indexes, Apr = 0
  basis: Basis;
}
export interface AT { a: number; t: number }
export interface Row { k: Kpi; a: number; t: number; plat: Platform; split: boolean; b: Band; v: Variance; sup: boolean }
export interface Variance { raw: number; txt: string; fav: boolean }

/* ---------------- period ---------------- */
export const FYM = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const now = new Date();
export const CURM = (now.getMonth() + 9) % 12;
const fyEnd = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
export const YEARS = [
  { l: 'FY' + fyEnd, max: CURM, cur: true },
  { l: 'FY' + (fyEnd - 1), max: 11, cur: false },
  { l: 'FY' + (fyEnd - 2), max: 11, cur: false },
];
export const maxM = (c: Ctx) => YEARS[c.year].max;
export const nMon = (c: Ctx) => c.m1 - c.m0 + 1;
export function periodLabel(c: Ctx) {
  const y = YEARS[c.year];
  if (c.m0 === 0 && c.m1 === y.max) return `${y.l}${y.cur ? ' YTD' : ''} · ${FYM[0]}–${FYM[y.max]}`;
  if (c.m0 === c.m1) return `${y.l} · ${FYM[c.m0]}`;
  return `${y.l} · ${FYM[c.m0]}–${FYM[c.m1]}`;
}

/* ---------------- deterministic noise ---------------- */
export function seed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5; let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const FC: Record<string, number[]> = {};
export function facs(k: string, pv: string, y: number) {
  const key = `${k}|${pv}|${y}`;
  if (FC[key]) return FC[key];
  const r = seed('f' + key), a: number[] = [];
  for (let i = 0; i < 12; i++) a.push(0.92 + r() * 0.16);
  let m = 0; for (let i = 0; i < 10; i++) m += a[i]; m /= 10;
  for (let i = 0; i < 12; i++) a[i] /= m;
  return (FC[key] = a);
}
export const ymul = (k: string, pv: string, y: number) => (y === 0 ? 1 : 0.9 + seed('y' + k + pv + y)() * 0.16);

/* ---------------- monthly + period values ---------------- */
const aggOf = (k: string) => (KBY[k] ? KBY[k].agg : 'sum');
export function monAT(c: Ctx, k: string, pv: string, i: number): AT {
  if (k === 'margin') {
    const s = monAT(c, 'sales', pv, i), r = monAT(c, 'rmc', pv, i), o = monAT(c, 'opex', pv, i);
    return { a: s.a - r.a - o.a, t: s.t - r.t - o.t };
  }
  const b = D[k][pv], f = facs(k, pv, c.year), ym = ymul(k, pv, c.year);
  if (aggOf(k) === 'sum') return { a: (b[0] / 10) * f[i] * ym, t: b[1] / 10 };
  return { a: b[0] * f[i] * ym, t: b[1] };
}
export function monATx(c: Ctx, k: string, pv: string, i: number): AT {
  if (k === 'opexTo') {
    const o = monAT(c, 'opex', pv, i), s = monAT(c, 'sales', pv, i);
    return { a: s.a ? (o.a / s.a) * 100 : 0, t: s.t ? (o.t / s.t) * 100 : 0 };
  }
  return monAT(c, k, pv, i);
}
export function AT(c: Ctx, k: string, pv: string): AT {
  if (k === 'opexTo') {
    const o = AT(c, 'opex', pv), s = AT(c, 'sales', pv);
    return { a: s.a ? (o.a / s.a) * 100 : 0, t: s.t ? (o.t / s.t) * 100 : 0 };
  }
  let a = 0, t = 0;
  for (let i = c.m0; i <= c.m1; i++) { const m = monAT(c, k, pv, i); a += m.a; t += m.t; }
  if (aggOf(k) === 'avg') { a /= nMon(c); t /= nMon(c); }
  return { a, t };
}

/* Baseline = last-FY March exit reading, slightly behind target by design. */
const BASE: Record<string, Record<string, number>> = (() => {
  const o: Record<string, Record<string, number>> = {};
  Object.keys(D).forEach((k) => {
    o[k] = {};
    Object.keys(D[k]).forEach((pv) => {
      const t = D[k][pv][1], K = KBY[k];
      if (!K || !t) { o[k][pv] = t; return; }
      const drift = 0.025 + seed('b' + k + pv)() * 0.045;
      o[k][pv] = K.dir === 'hi' ? t * (1 - drift) : t * (1 + drift);
    });
  });
  return o;
})();
function baseOf(c: Ctx, k: string, pv: string) {
  if (k === 'margin') return BASE.sales[pv] - BASE.rmc[pv] - BASE.opex[pv];
  if (k === 'opexTo') return BASE.sales[pv] ? (BASE.opex[pv] / BASE.sales[pv]) * 100 : 0;
  const b = BASE[k]?.[pv];
  if (b == null) return AT(c, k, pv).t;
  return aggOf(k) === 'sum' ? (b / 10) * nMon(c) : b;
}
export function ATb(c: Ctx, k: string, pv: string): AT {
  const v = AT(c, k, pv);
  return { a: v.a, t: c.basis === 'base' ? baseOf(c, k, pv) : v.t };
}

/* ---------------- bands ---------------- */
export function band(k: string, a: number, t: number): Band {
  const K = KBY[k], T = K.tol;
  switch (K.band) {
    case 'pctPlan': { const p = t ? (a / t) * 100 : 100; return p >= T[0] ? 'green' : p >= T[1] ? 'amber' : 'red'; }
    case 'pctOver': { const o = t ? ((a - t) / t) * 100 : 0; return o <= T[0] ? 'green' : o <= T[1] ? 'amber' : 'red'; }
    case 'pctBelow': { const b = t ? ((t - a) / t) * 100 : 0; return b <= T[0] ? 'green' : b <= T[1] ? 'amber' : 'red'; }
    case 'ppOver': { const q = a - t; return q <= T[0] ? 'green' : q <= T[1] ? 'amber' : 'red'; }
    case 'ppBelow': { const w = t - a; return w <= T[0] ? 'green' : w <= T[1] ? 'amber' : 'red'; }
    case 'ppBand': { const d = a - t; return d <= T[0] ? 'green' : d <= T[1] ? 'amber' : 'red'; }
    case 'absHi': return a >= T[0] ? 'green' : a >= T[1] ? 'amber' : 'red';
    case 'absLo': return a < T[0] ? 'green' : a <= T[1] ? 'amber' : 'red';
    case 'slaDays': return a <= t ? 'green' : a <= t + T[1] ? 'amber' : 'red';
    case 'loss': return a >= 0 ? 'green' : Math.abs(a) <= T[0] ? 'amber' : 'red';
  }
  return 'green';
}
export const RANK: Record<Band, number> = { red: 0, amber: 1, green: 2 };
export const bLab = (b: Band) => (b === 'red' ? 'Intervene' : b === 'amber' ? 'Monitor' : 'On track');

/* ---------------- formatting ---------------- */
export const uom = (k: string, plat: Platform = 'formulation') => KBY[k].u[plat];
const decOf = (k: string, plat?: Platform) => {
  const K = KBY[k];
  return plat === 'api' && K.decApi != null ? K.decApi : K.dec;
};
export function fmtN(k: string, v: number, plat?: Platform) {
  if (k === 'fv') { const f = Math.max(0, Math.min(100, v)); return `${Math.round(f)} / ${Math.round(100 - f)}`; }
  const d = decOf(k, plat), x = Math.abs(v);
  return (v < 0 ? '−' : '') + (d ? x.toFixed(d) : Math.round(x).toLocaleString('en-IN'));
}
export function fmtU(k: string, v: number, plat?: Platform) {
  const u = uom(k, plat);
  if (u.indexOf('₹') === 0) return (v < 0 ? '−' : '') + '₹' + fmtN(k, Math.abs(v), plat) + u.slice(1);
  return fmtN(k, v, plat) + (u === '%' || u.indexOf('%') === 0 ? '%' : ' ' + u);
}
export function vari(k: string, a: number, t: number): Variance {
  const K = KBY[k];
  let raw: number, txt: string;
  if (K.vm === 'pct') { raw = t ? ((a - t) / t) * 100 : 0; txt = (raw >= 0 ? '+' : '') + raw.toFixed(1) + '%'; }
  else if (K.vm === 'pp') { raw = a - t; txt = (raw >= 0 ? '+' : '') + raw.toFixed(K.dec > 1 ? 2 : 1) + 'pp'; }
  else if (K.vm === 'day') { raw = a - t; txt = (raw >= 0 ? '+' : '') + raw.toFixed(1) + 'd'; }
  else { raw = a; txt = (raw >= 0 ? '+' : '−') + '₹' + Math.abs(raw).toFixed(2) + ' Cr'; }
  const fav = K.vm === 'cur' ? raw >= 0 : K.dir === 'lo' ? a <= t : a >= t;
  return { raw, txt: txt.replace('-', '−'), fav };
}

/* ---------------- scope ---------------- */
export function sp(c: Ctx): Plant[] {
  if (c.plant !== 'all') return [PBY[c.plant]];
  return PLANTS.filter((p) => c.type === 'all' || p.p === c.type);
}
export const plats = (ps: Plant[]) => Array.from(new Set(ps.map((p) => p.p))) as Platform[];
export function scopeLabel(c: Ctx) {
  if (c.plant !== 'all') return PBY[c.plant].n;
  if (c.type === 'all') return 'All plants';
  return `${PLAT[c.type].l} plants`;
}
export function scopeName(c: Ctx) {
  if (c.plant !== 'all') return PBY[c.plant].n;
  if (c.type === 'all') return 'the network';
  return `the ${PLAT[c.type].l} plants`;
}
export function scopeShort(c: Ctx) {
  if (c.plant !== 'all') return PBY[c.plant].s;
  if (c.type === 'all') return 'Network';
  return c.type === 'api' ? 'API' : 'Formulation';
}

/* ---------------- aggregation (never blends platform-specific units) ---------------- */
export const unitSplit = (k: string) => ['cogs', 'conv', 'man'].indexOf(k) > -1;
function aggWith(c: Ctx, k: string, ps: Plant[], f: (c: Ctx, k: string, pv: string) => AT): AT {
  if (!ps.length) return { a: 0, t: 0 };
  if (k === 'opexTo') {
    const o = aggWith(c, 'opex', ps, f), s = aggWith(c, 'sales', ps, f);
    return { a: s.a ? (o.a / s.a) * 100 : 0, t: s.t ? (o.t / s.t) * 100 : 0 };
  }
  let a = 0, t = 0;
  ps.forEach((p) => { const v = f(c, k, p.id); a += v.a; t += v.t; });
  if (aggOf(k) === 'avg') { a /= ps.length; t /= ps.length; }
  return { a, t };
}
export const agg = (c: Ctx, k: string, ps: Plant[]) => aggWith(c, k, ps, AT);
export const aggB = (c: Ctx, k: string, ps: Plant[]) => aggWith(c, k, ps, c.basis === 'base' ? ATb : AT);

function headlineWith(c: Ctx, k: string, ps: Plant[], g: typeof agg) {
  const pl = plats(ps);
  if (pl.length === 1 || !unitSplit(k)) {
    const v = g(c, k, ps);
    return { a: v.a, t: v.t, plat: pl[0] || ('formulation' as Platform), split: false };
  }
  let best: { a: number; t: number; plat: Platform; split: boolean; b: Band } | null = null;
  pl.forEach((x) => {
    const v = g(c, k, ps.filter((p) => p.p === x)), b = band(k, v.a, v.t);
    if (!best || RANK[b] < RANK[best.b]) best = { a: v.a, t: v.t, plat: x, b, split: true };
  });
  return best!;
}
export const headline = (c: Ctx, k: string, ps: Plant[]) => headlineWith(c, k, ps, agg);
export const headlineB = (c: Ctx, k: string, ps: Plant[]) => headlineWith(c, k, ps, aggB);
export const kBand = (c: Ctx, k: string, ps: Plant[]) => { const h = headline(c, k, ps); return band(k, h.a, h.t); };
/* exception suppression: OPEx/Turnover hides when Sales is already red */
export const suppressed = (c: Ctx, k: string, ps: Plant[]) => k === 'opexTo' && kBand(c, 'sales', ps) === 'red';

function rowsWith(c: Ctx, ps: Plant[], h: typeof headline): Row[] {
  return KPIS.map((K) => {
    const x = h(c, K.id, ps), b = band(K.id, x.a, x.t);
    return { k: K, a: x.a, t: x.t, plat: x.plat, split: x.split, b, v: vari(K.id, x.a, x.t), sup: suppressed(c, K.id, ps) };
  });
}
export const rowsFor = (c: Ctx, ps: Plant[]) => rowsWith(c, ps, headline);
/** honours the Target / Baseline toggle */
export const rowsForT = (c: Ctx, ps: Plant[]) => rowsWith(c, ps, headlineB);

/* ---------------- Plant Health Index ----------------
   100 at/better than target, decays to 60 at the red threshold, then 60 → 20 beyond.
   Rolled up with group weights, renormalised over groups present. */
export function phiShort(K: Kpi, a: number, t: number) {
  const T = K.tol;
  switch (K.band) {
    case 'pctPlan': return t ? Math.max(0, ((t - a) / t) * 100) : 0;
    case 'pctOver': return t ? Math.max(0, ((a - t) / t) * 100) : 0;
    case 'pctBelow': return t ? Math.max(0, ((t - a) / t) * 100) : 0;
    case 'ppOver': case 'ppBand': return Math.max(0, a - t);
    case 'ppBelow': return Math.max(0, t - a);
    case 'absHi': return Math.max(0, T[0] - a);
    case 'absLo': return Math.max(0, a - T[0]);
    case 'slaDays': return Math.max(0, a - t);
    case 'loss': return Math.max(0, -a);
  }
  return 0;
}
export function phiRed(K: Kpi) {
  const T = K.tol;
  switch (K.band) {
    case 'pctPlan': return 100 - T[1];
    case 'absHi': return T[0] - T[1];
    case 'absLo': return T[1] - T[0];
    case 'loss': return T[0];
    default: return T[1] || 1;
  }
}
export function phiKpi(K: Kpi, a: number, t: number) {
  const s = phiShort(K, a, t), R = phiRed(K) || 1;
  if (s <= 0) return 100;
  const r = s / R;
  return r <= 1 ? Math.max(20, 100 - 40 * r) : Math.max(20, 60 - 25 * (r - 1));
}
export const severity = (r: { k: Kpi; a: number; t: number }) => phiShort(r.k, r.a, r.t) / (phiRed(r.k) || 1);
export function phi(c: Ctx, ps: Plant[]) {
  const byg: Partial<Record<GroupId, number[]>> = {};
  KPIS.forEach((K) => {
    const h = headline(c, K.id, ps);
    (byg[K.g] = byg[K.g] || []).push(phiKpi(K, h.a, h.t));
  });
  let w = 0, acc = 0;
  const per: Partial<Record<GroupId, number>> = {};
  (Object.keys(byg) as GroupId[]).forEach((g) => {
    const v = byg[g]!, gs = v.reduce((x, y) => x + y, 0) / v.length;
    per[g] = gs; acc += gs * PHIW[g]; w += PHIW[g];
  });
  return { sc: w ? Math.round(acc / w) : 0, per };
}
let PHINET: number | null = null;
/** fixed benchmark: all plants, full current-FY YTD */
export function phiNet() {
  if (PHINET === null) PHINET = phi({ type: 'all', plant: 'all', year: 0, m0: 0, m1: CURM, basis: 'target' }, PLANTS).sc;
  return PHINET;
}

/* ---------------- contribution ---------------- */
export function gapOf(k: string, a: number, t: number) {
  const K = KBY[k];
  if (K.vm === 'cur') return -a;
  return K.dir === 'lo' ? a - t : t - a;
}
export function relPs(c: Ctx, k: string, ps: Plant[]) {
  if (!unitSplit(k) || plats(ps).length < 2) return ps;
  const h = headline(c, k, ps);
  return ps.filter((p) => p.p === h.plat);
}
export interface Contribution { total: number; list: { p: Plant; a: number; t: number; g: number; eff: number; sh: number }[]; top: Contribution['list'][number] }
function contribWith(c: Ctx, k: string, ps0: Plant[], f: typeof AT, g: typeof agg): Contribution | null {
  const ps = relPs(c, k, ps0), K = KBY[k];
  if (ps.length < 2) return null;
  const v = g(c, k, ps), tg = gapOf(k, v.a, v.t);
  if (tg <= 0) return null;
  const list = ps.map((p) => {
    const q = f(c, k, p.id), gp = gapOf(k, q.a, q.t);
    const eff = K.agg === 'sum' || K.vm === 'cur' ? gp : gp / ps.length;
    return { p, a: q.a, t: q.t, g: gp, eff, sh: eff / tg };
  }).sort((x, y) => y.eff - x.eff);
  return { total: tg, list, top: list[0] };
}
export const contrib = (c: Ctx, k: string, ps: Plant[]) => contribWith(c, k, ps, AT, agg);
export const contribB = (c: Ctx, k: string, ps: Plant[]) =>
  c.basis === 'base' ? contribWith(c, k, ps, ATb, aggB) : contrib(c, k, ps);
export const pct = (x: number) => (x >= 0.995 ? 'effectively all' : Math.round(x * 100) + '%');

/* ---------------- quarterly trail + trend ---------------- */
const QTR = [
  { k: 'Q1', l: 'Apr–Jun', a: 0, b: 2 }, { k: 'Q2', l: 'Jul–Sep', a: 3, b: 5 },
  { k: 'Q3', l: 'Oct–Dec', a: 6, b: 8 }, { k: 'Q4', l: 'Jan–Mar', a: 9, b: 11 },
];
export interface TrailCell { q: string; label: string; part: boolean; b: Band; strong: boolean; now: boolean; a: number; t: number }
export function trail(c: Ctx, k: string, ps: Plant[]): TrailCell[] {
  const qs = QTR.map((q) => {
    const a = Math.max(q.a, c.m0), b = Math.min(q.b, c.m1);
    return b >= a ? { q, a, b, part: a > q.a || b < q.b } : null;
  }).filter(Boolean) as { q: (typeof QTR)[number]; a: number; b: number; part: boolean }[];
  const avg = aggOf(k) === 'avg' || k === 'opexTo';
  return qs.map((z, ix) => {
    let a = 0, t = 0;
    const n = z.b - z.a + 1;
    for (let i = z.a; i <= z.b; i++) {
      let ma = 0, mt = 0;
      ps.forEach((p) => { const m = monATx(c, k, p.id, i); ma += m.a; mt += m.t; });
      if (avg) { ma /= ps.length; mt /= ps.length; }
      a += ma; t += mt;
    }
    if (avg) { a /= n; t /= n; }
    const b = band(k, a, t), v = vari(k, a, t);
    const strong = b !== 'green' && Math.abs(v.raw) > (KBY[k].vm === 'pct' ? 4 : 1.2);
    return { q: z.q.k, label: z.q.l, part: z.part, b, strong, now: ix === qs.length - 1, a, t };
  });
}
export function trend(c: Ctx, k: string, ps: Plant[]): 'bad' | 'good' | 'flat' {
  if (nMon(c) < 2) return 'flat';
  let f = 0, l = 0;
  ps.forEach((p) => {
    const A = monATx(c, k, p.id, c.m0), B = monATx(c, k, p.id, c.m1);
    f += gapOf(k, A.a, A.t); l += gapOf(k, B.a, B.t);
  });
  if (Math.abs(l - f) < 1e-9) return 'flat';
  return l > f ? 'bad' : 'good';
}
/** last up-to-6 months for the drill sparkline */
export function monthly(c: Ctx, k: string, ps: Plant[]) {
  const n = Math.min(6, nMon(c)), start = c.m1 - n + 1, out: { l: string; a: number; t: number; b: Band }[] = [];
  const avg = aggOf(k) === 'avg' || k === 'opexTo';
  for (let i = start; i <= c.m1; i++) {
    let a = 0, t = 0;
    ps.forEach((p) => { const m = monATx(c, k, p.id, i); a += m.a; t += m.t; });
    if (avg) { a /= ps.length; t /= ps.length; }
    out.push({ l: FYM[i], a, t, b: band(k, a, t) });
  }
  return out;
}

/* ---------------- tolerance bar ----------------
   Uses only the original band rules and each KPI's tolerance column (K.tol).
   g      : signed distance from target in the rule's own units (positive = worse)
   amber  : distance at which the KPI leaves green
   red    : distance at which it turns red (same as phiRed)
   So "g past amber" == Monitor and "g past red" == Intervene, exactly as band() decides. */
export function tolPos(K: Kpi, a: number, t: number) {
  const T = K.tol;
  let g = 0, amber = 0;
  switch (K.band) {
    case 'pctPlan': g = t ? ((t - a) / t) * 100 : 0; amber = 100 - T[0]; break;
    case 'pctOver': g = t ? ((a - t) / t) * 100 : 0; amber = T[0]; break;
    case 'pctBelow': g = t ? ((t - a) / t) * 100 : 0; amber = T[0]; break;
    case 'ppOver': case 'ppBand': g = a - t; amber = T[0]; break;
    case 'ppBelow': g = t - a; amber = T[0]; break;
    case 'absHi': g = T[0] - a; amber = 0; break;
    case 'absLo': g = a - T[0]; amber = 0; break;
    case 'slaDays': g = a - t; amber = 0; break;
    case 'loss': g = -a; amber = 0; break;
  }
  return { g, amber, red: phiRed(K) };
}
/** plain-English tolerance rule, straight from the original tolerance column */
export function tolText(K: Kpi) {
  const T = K.tol;
  switch (K.band) {
    case 'pctPlan': return `Monitor below ${T[0]}% of target, intervene below ${T[1]}%`;
    case 'pctOver': return `Monitor above target by more than ${T[0]}%, intervene beyond ${T[1]}%`;
    case 'pctBelow': return `Monitor below target by more than ${T[0]}%, intervene beyond ${T[1]}%`;
    case 'ppOver': case 'ppBand': return `Monitor above target by more than ${T[0]}pp, intervene beyond ${T[1]}pp`;
    case 'ppBelow': return `Monitor below target by more than ${T[0]}pp, intervene beyond ${T[1]}pp`;
    case 'absHi': return `Monitor below ${T[0]}%, intervene below ${T[1]}%`;
    case 'absLo': return `Monitor at ${T[0]}% or above, intervene above ${T[1]}%`;
    case 'slaDays': return `Monitor once past SLA, intervene beyond SLA + ${T[1]} days`;
    case 'loss': return `Monitor on any loss, intervene beyond a ₹${T[0]} Cr loss`;
  }
  return '';
}
