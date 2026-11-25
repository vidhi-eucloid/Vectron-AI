/* Sub-level detail for the KPI drill-down: GL, product, block, customer, utility head,
   ageing bucket, department, requisition, and the conversion-cost volume/OPEx split. */
import { AGE, BLOCKS, CUST, DEPTS, FXD, GLS, KBY, PBY, PRBY, PRS, UTIL, type Plant, type Platform } from './data';
import { AT, agg, facs, nMon, relPs, seed, uom, ymul, type Band, type Ctx } from './engine';

export type Tone = Band | 'mut';
export interface Cell { t: string; sub?: string; tone?: Tone }
export interface Detail {
  label: string;
  cols: { h: string; r?: boolean }[];
  rows: Cell[][];
  evidence: string;          // one sentence, **bold** markup
  split?: { vol: number; op: number; tot: number; unit: string; dec: number };
}

const toneBy = (v: number, red: number, amber: number, hiBad = true): Tone =>
  hiBad ? (v > red ? 'red' : v > amber ? 'amber' : 'green') : (v < red ? 'red' : v < amber ? 'amber' : 'green');

function glAgg(c: Ctx, ps: Plant[]) {
  const m: Record<string, { g: (typeof GLS)[number]; amt: number; fixed: number; fx: number }> = {};
  ps.forEach((p) => {
    const o = AT(c, 'opex', p.id).a, d = FXD[p.id] || 0;
    GLS.forEach((g) => {
      const amt = o * g.sh, fx = Math.max(0, Math.min(1, g.fx + d));
      const x = m[g.c] || (m[g.c] = { g, amt: 0, fixed: 0, fx: 0 });
      x.amt += amt; x.fixed += amt * fx;
    });
  });
  return Object.values(m).map((x) => ({ ...x, fx: x.amt ? (x.fixed / x.amt) * 100 : 0 }));
}

function drillGL(c: Ctx, ps: Plant[], k: string): Detail {
  const g = glAgg(c, ps);
  const tot = g.reduce((a, x) => a + x.amt, 0) || 1;
  const rnd = seed('gl' + ps.map((p) => p.id).join() + c.m0 + c.m1 + c.year);
  const gap = agg(c, k === 'fv' ? 'opex' : k, ps);
  const over = k === 'fv' ? 0 : Math.max(0, gap.a - gap.t);
  const noisy = g.map((x) => ({ ...x, w: (x.amt / tot) * (0.55 + rnd() * 1.1), c: 0 }));
  const sw = noisy.reduce((a, x) => a + x.w, 0) || 1;
  noisy.forEach((x) => { x.c = over * (x.w / sw); });
  noisy.sort((a, b) => (k === 'fv' ? b.fx * b.amt - a.fx * a.amt : b.c - a.c));
  const top = noisy[0];
  return {
    label: 'By GL',
    cols: [{ h: 'GL' }, { h: 'Head' }, { h: 'Amount', r: true }, { h: k === 'fv' ? 'Fixed share' : 'Overrun share', r: true }],
    rows: noisy.slice(0, 5).map((x) => [
      { t: x.g.n, sub: x.g.c }, { t: x.g.h, tone: 'mut' }, { t: '₹' + x.amt.toFixed(2) + ' Cr' },
      k === 'fv'
        ? { t: x.fx.toFixed(0) + '%', tone: x.fx >= 70 ? 'red' : x.fx >= 45 ? 'amber' : 'green' }
        : { t: '₹' + x.c.toFixed(3) + ' Cr', tone: 'red' },
    ]),
    evidence: `Largest single line: **${top.g.n} (${top.g.c})**.`,
  };
}

function productRows(c: Ctx, ps: Plant[]) {
  const rows: { pl: Plant; pr: (typeof PRBY)[string][number]; miss: number; n: number; ay: number; ca: number; ybps: number; yval: number; cval: number; gapPct: number }[] = [];
  ps.forEach((pl) => (PRBY[pl.id] || []).forEach((pr) => {
    const f = facs('pq', pr.id, c.year), ym = ymul('pq', pr.id, c.year), n = nMon(c);
    let act = 0, tgt = 0, miss = 0, ys = 0, cs = 0;
    for (let i = c.m0; i <= c.m1; i++) {
      const a = (pr.q / 10) * f[i] * ym, t = (pr.q * pr.tf) / 10;
      act += a; tgt += t; if (a < t) miss++;
      ys += pr.by + (pr.ay - pr.by) * f[i] * ym; cs += pr.cb + (pr.ca - pr.cb) * f[i] * ym;
    }
    const ay = ys / n, ca = cs / n, q = (pr.q / 10) * n;
    rows.push({ pl, pr, miss, n, ay, ca, ybps: (ay - pr.by) * 100, yval: (((ay - pr.by) / 100) * q * pr.gc) / 1e7,
      cval: ((pr.cb - ca) * q) / 1e7, gapPct: tgt ? ((act - tgt) / tgt) * 100 : 0 });
  }));
  return rows;
}

function drillProduct(c: Ctx, ps: Plant[], k: string): Detail | null {
  let rows = productRows(c, ps);
  if (k === 'yield' || k === 'olY') {
    rows = rows.filter((r) => r.yval < 0).sort((a, b) => a.yval - b.yval);
    if (!rows.length) return null;
    return {
      label: 'By product', cols: [{ h: 'Product' }, { h: 'Plant' }, { h: 'vs baseline', r: true }, { h: 'At stake', r: true }],
      rows: rows.slice(0, 5).map((r) => [{ t: r.pr.n, sub: r.pr.blk }, { t: r.pl.s, tone: 'mut' }, { t: r.ybps.toFixed(0) + ' bps', tone: 'red' }, { t: '−₹' + Math.abs(r.yval).toFixed(2) + ' Cr', tone: 'red' }]),
      evidence: `Worst line: **${rows[0].pr.n}** at ${rows[0].pl.s}.`,
    };
  }
  if (k === 'cogs' || k === 'olC') {
    rows = rows.filter((r) => r.cval < 0).sort((a, b) => a.cval - b.cval);
    if (!rows.length) return null;
    return {
      label: 'By product', cols: [{ h: 'Product' }, { h: 'Plant' }, { h: 'vs standard', r: true }, { h: 'At stake', r: true }],
      rows: rows.slice(0, 5).map((r) => [{ t: r.pr.n, sub: r.pr.blk }, { t: r.pl.s, tone: 'mut' },
        { t: '+₹' + (r.pl.p === 'api' ? Math.round(r.ca - r.pr.cb) : (r.ca - r.pr.cb).toFixed(2)), tone: 'red' },
        { t: '−₹' + Math.abs(r.cval).toFixed(2) + ' Cr', tone: 'red' }]),
      evidence: `Worst line: **${rows[0].pr.n}** at ${rows[0].pl.s}.`,
    };
  }
  rows = rows.filter((r) => r.gapPct < 0).sort((a, b) => a.gapPct - b.gapPct);
  if (!rows.length) return null;
  return {
    label: 'By product', cols: [{ h: 'Product' }, { h: 'Plant / block' }, { h: 'Months missed', r: true }, { h: 'vs target', r: true }],
    rows: rows.slice(0, 5).map((r) => [{ t: r.pr.n }, { t: r.pl.s + ' · ' + r.pr.blk, tone: 'mut' },
      { t: `${r.miss} / ${r.n}`, tone: r.miss >= r.n * 0.6 ? 'red' : 'amber' }, { t: r.gapPct.toFixed(1) + '%', tone: 'red' }]),
    evidence: `Worst line: **${rows[0].pr.n}** at ${rows[0].pl.s}.`,
  };
}

function drillPR(c: Ctx, ps: Plant[]): Detail | null {
  const ids = new Set(ps.map((p) => p.id));
  const sla = agg(c, 'prpo', ps).t;
  const all = PRS.filter((x) => ids.has(x.pl)).sort((a, b) => b.age - a.age);
  const over = all.filter((x) => x.age > sla);
  if (!over.length) return null;
  const byStage: Record<string, number> = {};
  over.forEach((x) => { byStage[x.st] = (byStage[x.st] || 0) + 1; });
  const worst = Object.keys(byStage).sort((a, b) => byStage[b] - byStage[a])[0];
  const val = over.reduce((a, x) => a + x.v, 0);
  return {
    label: 'Open requisitions past SLA', cols: [{ h: 'Requisition' }, { h: 'Stuck at' }, { h: 'Value', r: true }, { h: 'Age', r: true }],
    rows: over.slice(0, 5).map((x) => [{ t: x.id, sub: x.cat }, { t: x.st, sub: x.o, tone: 'mut' }, { t: '₹' + x.v.toFixed(1) + ' L' },
      { t: x.age + 'd', tone: x.age > sla * 1.6 ? 'red' : 'amber' }]),
    evidence: `**${over.length} of ${all.length}** open requisitions are past SLA, holding **₹${val.toFixed(1)} L**; the biggest queue is ${worst.toLowerCase()}.`,
  };
}

function drillSimple(c: Ctx, ps: Plant[], k: string): Detail | null {
  const ids = new Set(ps.map((p) => p.id));
  const d = KBY[k].drill;
  if (d === 'block') {
    const b = BLOCKS.filter((x) => ids.has(x.pl)).sort((a, z) => a.u - z.u);
    if (!b.length) return null;
    return { label: 'By block', cols: [{ h: 'Block' }, { h: 'Plant' }, { h: 'Utilisation', r: true }, { h: 'Downtime', r: true }],
      rows: b.slice(0, 5).map((x) => [{ t: x.n, sub: x.rc !== '—' ? x.rc : undefined }, { t: PBY[x.pl].s, tone: 'mut' },
        { t: x.u.toFixed(1) + '%', tone: toneBy(x.u, 75, 85, false) }, { t: x.dt.toFixed(1) + '%', tone: x.dt > 10 ? 'red' : 'amber' }]),
      evidence: `Lowest block: **${b[0].n}** at ${PBY[b[0].pl].s}, ${b[0].dt.toFixed(1)}% downtime (${b[0].rc}).` };
  }
  if (d === 'customer') {
    const cu = CUST.filter((x) => ids.has(x.pl)).sort((a, z) => z.fail - a.fail);
    if (!cu.length) return null;
    return { label: 'By customer', cols: [{ h: 'Customer' }, { h: 'Plant' }, { h: 'Failed lines', r: true }, { h: 'Reason', r: true }],
      rows: cu.slice(0, 5).map((x) => [{ t: x.n }, { t: PBY[x.pl].s, tone: 'mut' }, { t: `${x.fail} / ${x.ord}`, tone: x.fail >= 2 ? 'red' : 'amber' }, { t: x.rc, tone: 'mut' }]),
      evidence: `Most exposed customer: **${cu[0].n}**, ${cu[0].fail} failed lines (${cu[0].rc.toLowerCase()}).` };
  }
  if (d === 'utility') {
    const u = UTIL.filter((x) => ids.has(x.pl)).map((x) => ({ ...x, over: ((x.a - x.b) / x.b) * 100 })).sort((a, z) => z.over - a.over);
    if (!u.length) return null;
    const t = u[0];
    return { label: 'By utility head', cols: [{ h: 'Utility' }, { h: 'Plant' }, { h: 'Rate vs budget', r: true }, { h: 'Consumption', r: true }],
      rows: u.slice(0, 5).map((x) => [{ t: x.n, sub: x.u }, { t: PBY[x.pl].s, tone: 'mut' },
        { t: (x.over >= 0 ? '+' : '') + x.over.toFixed(1) + '%', tone: toneBy(x.over, 3, 0) },
        { t: (x.cons >= 0 ? '+' : '') + x.cons.toFixed(1) + '%', tone: toneBy(x.cons, 3, 0) }]),
      evidence: `Rate effect ${t.over >= 0 ? '+' : ''}${t.over.toFixed(1)}% vs consumption effect ${t.cons >= 0 ? '+' : ''}${t.cons.toFixed(1)}%` +
        (Math.abs(t.cons) > Math.abs(t.over) ? ' — consumption, not tariff, is the larger driver.' : ' — tariff is the larger driver.') };
  }
  if (d === 'agebucket') {
    const g = AGE.filter((x) => ids.has(x.pl)).sort((a, z) => z.v - a.v);
    if (!g.length) return null;
    return { label: 'By ageing bucket', cols: [{ h: 'Item' }, { h: 'Plant' }, { h: 'Bucket' }, { h: 'Value', r: true }],
      rows: g.slice(0, 5).map((x) => [{ t: x.item }, { t: PBY[x.pl].s, tone: 'mut' }, { t: x.b, tone: x.b === '>180 days' ? 'red' : 'amber' }, { t: '₹' + x.v.toFixed(2) + ' Cr' }]),
      evidence: `Largest block: **${g[0].item}** at ${PBY[g[0].pl].s}, ₹${g[0].v.toFixed(2)} Cr in ${g[0].b}.` };
  }
  if (d === 'dept') {
    const dp = DEPTS.filter((x) => ids.has(x.pl)).sort((a, z) => a.idx - z.idx);
    if (!dp.length) return null;
    return { label: 'By department', cols: [{ h: 'Department' }, { h: 'Plant' }, { h: 'vs norm', r: true }, { h: 'Overtime', r: true }],
      rows: dp.slice(0, 5).map((x) => [{ t: x.n }, { t: PBY[x.pl].s, tone: 'mut' }, { t: x.idx + '%', tone: toneBy(x.idx, 95, 100, false) }, { t: x.ot.toFixed(1) + '%', tone: x.ot > 10 ? 'red' : 'amber' }]),
      evidence: `Weakest department: **${dp[0].n}** at ${dp[0].idx}% of norm, overtime ${dp[0].ot.toFixed(1)}%.` };
  }
  return null;
}

/* conversion cost: how much of the per-unit gap is volume (absorption) vs OPEx spend */
function convDec(c: Ctx, ps: Plant[]) {
  const plat: Platform = ps[0].p;
  let Va = 0, Vb = 0, Aa = 0, Ab = 0;
  ps.forEach((p) => {
    const pv = { a: 0, t: 0 }, div = plat === 'api' ? 1000 : 1e7;
    (PRBY[p.id] || []).forEach((x) => {
      const f = facs('pq', x.id, c.year), ym = ymul('pq', x.id, c.year);
      for (let i = c.m0; i <= c.m1; i++) { pv.a += ((x.q / 10) * f[i] * ym) / div; pv.t += (x.q * x.tf) / 10 / div; }
    });
    const cv = AT(c, 'conv', p.id);
    Va += pv.a; Vb += pv.t; Aa += cv.a * pv.a; Ab += cv.t * pv.t;
  });
  if (!Va || !Vb) return null;
  const Ra = Aa / Va, Rb = Ab / Vb;
  if (Ra <= Rb) return null;
  const vol = (Rb * (Vb - Va)) / Va, tot = Ra - Rb;
  return { plat, vol, op: tot - vol, tot };
}

export function detailFor(c: Ctx, k: string, ps: Plant[]): Detail | null {
  const K = KBY[k];
  const use = ps.length > 1 ? relPs(c, k, ps) : ps;
  if (k === 'conv') {
    const dc = convDec(c, use);
    if (!dc) return null;
    const d = dc.plat === 'api' ? 0 : 2;
    const sub = Math.abs(dc.vol) >= Math.abs(dc.op) ? drillProduct(c, use, 'prod') : drillGL(c, use, 'opex');
    return {
      ...(sub || { cols: [], rows: [] }),
      label: 'Volume vs OPEx effect',
      split: { vol: dc.vol, op: dc.op, tot: dc.tot, unit: uom('conv', dc.plat), dec: d },
      evidence: `Volume effect **${dc.vol >= 0 ? '+' : ''}${dc.vol.toFixed(d)}** vs OPEx effect **${dc.op >= 0 ? '+' : ''}${dc.op.toFixed(d)}** ${uom('conv', dc.plat)}.`,
    };
  }
  if (K.drill === 'gl') return drillGL(c, use, k);
  if (K.drill === 'product') return drillProduct(c, use, k);
  if (K.drill === 'pr') return drillPR(c, use);
  return drillSimple(c, use, k);
}
