/* Insight engine: turns engine numbers into the brief (summary) and the KPI drill-down.
   Returns plain data with **bold** markup — components decide how it looks, and the
   same objects feed narration and exports so they always match the screen. */
import { KBY, PHIW, PLAT, PLANTS, type Plant, type Platform } from './data';
import { az, cz, KLINKS, HIK, HIM, HIP, hiNum } from './content';
import {
  AT, band, bLab, contrib, contribB, fmtN, fmtU, headline, monthly, pct, periodLabel, phiKpi, plats, relPs,
  rowsFor, rowsForT, scopeName, severity, sp, vari, type Band, type Ctx, type Row,
} from './engine';
import { detailFor, type Detail } from './drill';

export const firstSentence = (s: string) => (s.match(/^.*?\.(\s|$)/)?.[0] || s).trim();

function impact(c: Ctx, k: string, ps: Plant[]) {
  const cc = contrib(c, k, ps);
  if (!cc) return null;
  const K = KBY[k];
  if (K.vm === 'pp') return `~${Math.abs(cc.top.eff).toFixed(1)}pp`;
  if (K.vm === 'cur') return `~₹${Math.abs(cc.top.eff).toFixed(2)} Cr`;
  if (K.vm === 'day') return `~${Math.abs(cc.top.eff).toFixed(1)} days`;
  return cc.top.sh >= 0.995 ? 'Full gap' : `~${Math.round(cc.top.sh * 100)}% of gap`;
}
export function fmtGap(k: string, g: number, plat: Platform) {
  const K = KBY[k];
  if (K.vm === 'pp') return Math.abs(g).toFixed(1) + 'pp';
  if (K.vm === 'day') return Math.abs(g).toFixed(1) + '-day';
  if (K.vm === 'cur') return '₹' + Math.abs(g).toFixed(2) + ' Cr';
  return fmtU(k, Math.abs(g), plat);
}

/* ================= BRIEF ================= */
export interface ConcRow { id: string; kind: 'plant' | 'kpi'; name: string; value: string; width: number; tone: Band | 'mut'; chips: { n: string; v: string }[] }
export interface Brief {
  kind: 'brief';
  state: Band; scope: string; basisTxt: string;
  headline: string; support: string;
  focusCount: number;
  conc?: { title: string; caption: string; rows: ConcRow[] };
  why: { k: string; name: string; v: string; tone: Band; text: string; site?: string }[];
  actions: { k: string; tone: Band; site: string; text: string; impact: string }[];
  narr: string;
}

export function buildBrief(c: Ctx): Brief {
  const ps = sp(c), p = ps.length === 1 ? ps[0].id : null;
  const basisTxt = c.basis === 'base' ? 'last-FY March baseline' : 'FY target';
  const irs = rowsForT(c, ps);
  const red = irs.filter((r) => r.b === 'red' && !r.sup);
  const amber = irs.filter((r) => r.b === 'amber' && !r.sup);
  const focus = (red.length ? red : amber).slice().sort((x, y) => severity(y) - severity(x));
  const isRed = red.length > 0;
  const state: Band = isRed ? 'red' : amber.length ? 'amber' : 'green';
  const sName = scopeName(c);

  /* concentration — multi-plant ranks plants, single plant ranks KPI lines */
  const byPlant = ps.length > 1;
  type Rk = { p?: Plant; row?: Row; w: number; kpis: { n: string; sh: number }[]; share: number };
  let ranked: Rk[] = [];
  let grand = 0;
  if (byPlant) {
    const tally: Record<string, Rk> = {};
    focus.forEach((r) => {
      const cc = contribB(c, r.k.id, ps);
      if (!cc) return;
      cc.list.forEach((pt) => {
        if (pt.sh <= 0) return;
        const sh = Math.min(1, pt.sh);
        const x = (tally[pt.p.id] = tally[pt.p.id] || { p: pt.p, w: 0, kpis: [], share: 0 });
        x.w += sh;
        if (sh >= 0.15) x.kpis.push({ n: r.k.s, sh });
        grand += sh;
      });
    });
    ranked = Object.values(tally).sort((x, y) => y.w - x.w);
  } else {
    focus.forEach((r) => { const s = severity(r); if (s > 0) { ranked.push({ row: r, w: s, kpis: [], share: 0 }); grand += s; } });
    ranked.sort((x, y) => y.w - x.w);
  }
  ranked.forEach((x) => { x.share = grand ? x.w / grand : 0; });
  const prime = ranked[0];

  let head: string, supp: string;
  if (!focus.length) {
    head = `${sName[0].toUpperCase() + sName.slice(1)} is running clean against ${basisTxt} — no KPI needs intervention this period.`;
    supp = 'Hold current controls and carry the position into next cycle.';
  } else {
    const one = focus.length === 1;
    const tone = isRed ? (one ? 'requires intervention' : 'require intervention') : one ? 'is drifting and needs monitoring' : 'are drifting and need monitoring';
    const names = focus.slice(0, 2).map((r) => r.k.s).join(' and ');
    if (byPlant && prime?.p && prime.share >= 0.45) {
      head = `**${prime.p.n}** is where the problem sits — it carries ${Math.round(prime.share * 100)}% of the total exposure across ${names}${focus.length > 2 ? ' and others' : ''}.`;
      supp = `Against ${basisTxt}, ${sName} is holding on most lines, but the shortfall is concentrated rather than systemic. One site-level intervention addresses the bulk of it.`;
    } else if (byPlant && prime?.p) {
      head = `${names}${focus.length > 2 ? ` and ${focus.length - 2} other line${focus.length > 3 ? 's' : ''}` : ''} ${tone}, with **${prime.p.n}** the largest single contributor.`;
      supp = `Against ${basisTxt}, exposure is spread across ${ranked.length} sites rather than sitting at one — recovery needs a coordinated push, not a single fix.`;
    } else if (prime?.row) {
      head = `**${prime.row.k.s}** is the deepest gap at this site at ${prime.row.v.txt}` +
        (ranked[1]?.row ? `, followed by **${ranked[1].row.k.s}** at ${ranked[1].row.v.txt}` : '') + '.';
      supp = `${focus.length} line${focus.length > 1 ? 's' : ''} sit outside tolerance against ${basisTxt}. ${prime.row.k.s} alone accounts for ${Math.round(prime.share * 100)}% of the total severity here, so it is the first thing to fix.`;
    } else {
      head = `${names} ${tone} against ${basisTxt}.`;
      supp = 'Gaps are shallow and evenly spread — treat this as routine control tightening.';
    }
  }

  const maxW = ranked[0]?.share || 1;
  const conc = focus.length ? {
    title: byPlant ? 'Where the exposure sits' : 'Which lines carry the gap',
    caption: byPlant
      ? `Share of the total gap across ${focus.length} line${focus.length > 1 ? 's' : ''} outside tolerance`
      : `Severity against each line's own tolerance`,
    rows: ranked.slice(0, 6).map((x): ConcRow => {
      if (x.p) {
        const pc = Math.round(x.share * 100);
        return { id: x.p.id, kind: 'plant', name: x.p.n, value: pc + '%', width: x.share / maxW,
          tone: pc >= 40 ? 'red' : pc >= 20 ? 'amber' : 'mut',
          chips: x.kpis.sort((u, v) => v.sh - u.sh).slice(0, 3).map((kk) => ({ n: kk.n, v: Math.round(kk.sh * 100) + '%' })) };
      }
      const r = x.row!;
      return { id: r.k.id, kind: 'kpi', name: r.k.s, value: r.v.txt, width: x.share / maxW, tone: r.b, chips: [] };
    }),
  } : undefined;

  const why = focus.slice(0, 4).map((r) => {
    const cc = contribB(c, r.k.id, ps);
    return { k: r.k.id, name: r.k.s, v: r.v.txt, tone: r.b, text: cz(r.k.id, cc ? cc.top.p.id : p),
      site: cc ? `${cc.top.p.s} · ${pct(cc.top.sh)}` : undefined };
  });
  const actions = focus.slice(0, 4).map((r) => {
    const cc = contribB(c, r.k.id, ps);
    return { k: r.k.id, tone: r.b, site: cc ? cc.top.p.s : ps.length === 1 ? ps[0].s : sName,
      text: firstSentence(az(r.k.id, cc ? cc.top.p.id : p)), impact: impact(c, r.k.id, ps) || r.v.txt };
  });

  const strip = (s: string) => s.replace(/\*\*/g, '');
  return {
    kind: 'brief', state, scope: sName, basisTxt, headline: head, support: supp, focusCount: focus.length, conc, why, actions,
    narr: `Vectron briefing for ${sName}, ${periodLabel(c)}, against ${basisTxt}. ${strip(head)} ${supp}`,
  };
}

/* ================= KPI DRILL ================= */
export interface Drill {
  kind: 'drill';
  k: string; name: string; short: string; state: Band; plat: Platform;
  headline: string; support: string;
  sites: { id: string; name: string; plat: Platform; value: string; v: string; b: Band }[];
  cause: string; consequence: string;
  plan: { mode: 'recover' | 'monitor' | 'sustain'; steps: { when: string; text: string; site?: string; from?: number; to?: number }[]; phiGain: number };
  links: { dir: 'drives' | 'improves with'; k: string; name: string; eff: string }[];
  spark: { l: string; a: number; t: number; b: Band }[];
  value: string; target: string; variance: string; fav: boolean;
  detail: Detail | null;
  narr: string;
}

export function buildDrill(c: Ctx, k: string): Drill {
  const ps = sp(c), K = KBY[k], hd = headline(c, k, ps), b = band(k, hd.a, hd.t), V = vari(k, hd.a, hd.t);
  const rel = relPs(c, k, ps), cc = contrib(c, k, rel);
  const per = rel.map((x) => { const q = AT(c, k, x.id); return { p: x, a: q.a, t: q.t, b: band(k, q.a, q.t) }; });
  const off = per.filter((x) => x.b !== 'green').sort((x, y) => (x.b === 'red' ? -1 : 0) - (y.b === 'red' ? -1 : 0));
  const single = ps.length === 1;
  const sName = scopeName(c);
  const A = fmtU(k, hd.a, hd.plat), T = fmtU(k, hd.t, hd.plat);

  let head: string, supp: string;
  if (b === 'green' && off.length) {
    head = `${K.n} is within tolerance for ${sName}, at ${A} against ${T}.`;
    supp = `${off.length} site${off.length > 1 ? 's are' : ' is'} masked by the average — **${off[0].p.n}** at ${fmtU(k, off[0].a, off[0].p.p)} is worth a closer look.`;
  } else if (b === 'green') {
    head = `${K.n} is on plan for ${sName} — ${A} against ${T} (${V.txt}).`;
    supp = 'No plant in scope is outside tolerance. Sustain current controls.';
  } else if (single) {
    head = `${K.n} at **${ps[0].n}** is ${A} against a target of ${T} (${V.txt}).`;
    supp = `This is ${ps[0].s}'s own ${periodLabel(c)} figure.`;
  } else if (cc && cc.top.sh >= 0.5) {
    head = `**${cc.top.p.n}** is driving ${pct(cc.top.sh)} of the ${K.s} gap — fixing one site closes most of the exposure.`;
    supp = `${K.n} is ${A} against ${T} (${V.txt})${hd.split ? ` on the ${PLAT[hd.plat].l} basis` : ''}.`;
  } else {
    head = `${K.n} is ${A} against ${T} for ${sName} (${V.txt}).`;
    supp = off.length ? `${off.length} of ${per.length} plants sit outside band.` : 'Exposure is spread.';
  }

  const sitePool = relPs(c, k, ps.length > 1 ? ps : PLANTS.slice());
  const sites = sitePool.map((pl) => {
    const q = AT(c, k, pl.id), bb = band(k, q.a, q.t);
    return { id: pl.id, name: pl.s, plat: pl.p, value: fmtN(k, q.a, pl.p), v: vari(k, q.a, q.t).txt, b: bb };
  });

  const who = cc ? cc.top.p.id : single ? ps[0].id : null;
  const detail = detailFor(c, k, ps);
  let cause = cz(k, who);
  if (cc) cause += ` **${cc.top.p.s}** carries ${pct(cc.top.sh)} of the ${fmtGap(k, cc.total, cc.top.p.p)} gap.`;
  if (detail) cause += ' ' + detail.evidence;
  const links = (KLINKS[k] || []).filter((l) => KBY[l.k]).map((l) => ({ ...l, name: KBY[l.k].s }));
  const consequence = links.length ? links[0].eff + (links[1] ? ' ' + links[1].eff : '') : 'Sustained misses on this KPI compound through the quarterly review.';

  const ksc = Math.round(phiKpi(K, hd.a, hd.t));
  let plan: Drill['plan'];
  if (b === 'green' && off.length) {
    plan = { mode: 'monitor', phiGain: 0, steps: [
      { when: 'Now', text: `Watch ${off[0].p.s} alone — no network intervention is needed.` },
      { when: 'If it persists', text: az(k, off[0].p.id) }] };
  } else if (b === 'green') {
    plan = { mode: 'sustain', phiGain: 0, steps: [{ when: 'Ongoing', text: "Sustain current controls and fold this period's performance into next cycle's baseline." }] };
  } else {
    const s1to = Math.min(100, ksc + Math.round((100 - ksc) * 0.5));
    const s2to = Math.min(100, s1to + Math.round((100 - s1to) * 0.6));
    plan = { mode: 'recover', phiGain: Math.max(1, Math.round(((PHIW[K.g] || 0) * (100 - ksc)) / 100 / 5)), steps: [
      { when: 'This quarter', text: az(k, who), site: cc?.top.p.s, from: ksc, to: s1to },
      { when: 'Next quarter', text: `Set a monthly breach alert on ${K.s} and review with the plant team at each toll-gate.`, from: s1to, to: s2to },
      { when: 'By year-end', text: 'Embed the target into the plant-level OMP milestone and validate it in the BSC review.', from: s2to, to: 100 },
    ] };
  }

  const strip = (s: string) => s.replace(/\*\*/g, '');
  return {
    kind: 'drill', k, name: K.n, short: K.s, state: b, plat: hd.plat, headline: head, support: supp, sites, cause, consequence,
    plan, links, spark: monthly(c, k, rel), value: A, target: T, variance: V.txt, fav: V.fav, detail,
    narr: `${K.n} for ${sName}, ${periodLabel(c)}. ${strip(head)} ${strip(supp)} Why: ${cz(k, who)} Action: ${az(k, who)}`,
  };
}

/* ================= narration ================= */
function hiScope(c: Ctx) {
  if (c.plant !== 'all') return HIP[c.plant] || c.plant;
  if (c.type === 'all') return 'पूरे नेटवर्क';
  return (c.type === 'api' ? 'ए पी आई' : 'फॉर्मुलेशन') + ' प्लांट्स';
}
export function narration(c: Ctx, kpi: string | null, lang: 'en' | 'hi') {
  if (lang === 'en') return kpi ? buildDrill(c, kpi).narr : buildBrief(c).narr;
  const ps = sp(c);
  const t = `वेक्ट्रॉन ब्रीफिंग। ${hiScope(c)} के लिए, ${HIM[c.m0]} से ${HIM[c.m1]}। `;
  if (kpi) {
    const hd = headline(c, kpi, ps);
    return t + `${HIK[kpi] || KBY[kpi].s} इस समय ${hiNum(fmtU(kpi, hd.a, hd.plat))} है, टारगेट ${hiNum(fmtU(kpi, hd.t, hd.plat))} के मुकाबले। वजह। ${cz(kpi)} सुझाई गई कार्रवाई। ${az(kpi)}`;
  }
  const flag = rowsFor(c, ps).filter((r) => r.b !== 'green' && !r.sup).sort((a, b) => severity(b) - severity(a));
  if (!flag.length) return t + 'सभी के पी आई टॉलरेंस के अंदर हैं।';
  const w = flag[0];
  return t + `सबसे पहले ध्यान ${HIK[w.k.id] || w.k.s} पर चाहिए, जो ${hiNum(w.v.txt)} है। वजह। ${cz(w.k.id)} सुझाई गई कार्रवाई। ${az(w.k.id)}`;
}

/* ================= free-text routing (mock mode) ================= */
const ROUTES: [string, string][] = [
  ['opex to turnover', 'opexTo'], ['turnover ratio', 'opexTo'], ['opex', 'opex'],
  ['rmc', 'cogs'], ['cogs', 'cogs'], ['material', 'cogs'], ['conversion', 'conv'], ['yield', 'yield'],
  ['fixed', 'fv'], ['variable', 'fv'], ['capacity', 'cap'], ['utilis', 'cap'], ['downtime', 'cap'],
  ['otif', 'otif'], ['service', 'otif'], ['customer', 'otif'], ['inventory', 'inv'], ['ageing', 'inv'],
  ['power', 'pwr'], ['tariff', 'pwr'], ['diesel', 'dsl'], ['briquette', 'brq'], ['manpower', 'man'], ['overtime', 'man'],
  ['pr to po', 'prpo'], ['requisition', 'prpo'], ['procure', 'prpo'], ['margin', 'margin'], ['sales', 'sales'], ['turnover', 'sales'],
  ['production', 'prod'], ['output', 'prod'], ['batch', 'batch'], ['dofc', 'dofc'], ['dobc', 'dobc'],
  ['budget', 'opex'],   // generic word last, so 'power rate vs budget' routes to power
];
export function routeQ(q: string) {
  const s = q.toLowerCase();
  for (const [needle, k] of ROUTES) if (s.includes(needle)) return k;
  return null;
}
