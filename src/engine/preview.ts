/* Preview answers, used only while the supervisor agent is not connected.
   Built from the dashboard's own sample data and returned as markdown (text + table),
   the same shape the real agent replies in. */
import { KBY, PLANTS, PBY, type Plant } from './data';
import { cz } from './content';
import { AT, band, bLab, FYM, fmtU, headline, monATx, relPs, vari, YEARS, type Ctx } from './engine';
import { routeQ } from './insight';

const PLANT_ALIASES: [RegExp, string][] = [
  [/unit[\s-]*1\b/i, 'unit1'], [/unit[\s-]*2\b/i, 'unit2'], [/unit[\s-]*3\b/i, 'unit3'],
  [/sikkim/i, 'sikkim'], [/behror|api[\s-]*1\b/i, 'behror'], [/vizag|api[\s-]*2\b/i, 'vizag'],
];

function yearFrom(q: string) {
  const m = q.match(/fy\s?'?(\d{2,4})/i);
  if (!m) return 0;
  const y = m[1].length === 2 ? 2000 + +m[1] : +m[1];
  const i = YEARS.findIndex((x) => x.l === 'FY' + y);
  return i < 0 ? 0 : i;
}

export function previewAnswer(base: Ctx, q: string): string {
  const k = routeQ(q);
  if (!k) {
    return 'I can answer questions about the KPIs on this dashboard — for example COGS, OPEx, production output, yield, power rate, OTIF or inventory ageing.\n\n' +
      '_Preview mode: the supervisor agent is not connected yet, so answers come from the dashboard\'s sample data._';
  }
  const K = KBY[k];
  const plantId = PLANT_ALIASES.find(([re]) => re.test(q))?.[1];
  const year = yearFrom(q);
  const c: Ctx = { ...base, year, m0: 0, m1: YEARS[year].max, plant: plantId || 'all', type: plantId ? PBY[plantId].p : 'all' };
  const tLabel = /budget/i.test(q) ? 'Budget' : 'Target';
  const period = `${YEARS[year].l}${YEARS[year].cur ? ' YTD' : ''} (${FYM[0]}–${FYM[c.m1]})`;
  const trendQ = /trend|month|over time/i.test(q) || !!plantId;
  const note = '\n\n_Preview answer from the dashboard\'s sample data — connect the supervisor agent for live answers._';

  if (trendQ) {
    const ps: Plant[] = plantId ? [PBY[plantId]] : relPs(c, k, PLANTS.slice());
    const plat = ps[0].p;
    const avg = K.agg === 'avg' || k === 'opexTo';
    const rows: string[] = [];
    for (let i = c.m0; i <= c.m1; i++) {
      let a = 0, t = 0;
      ps.forEach((p) => { const m = monATx(c, k, p.id, i); a += m.a; t += m.t; });
      if (avg) { a /= ps.length; t /= ps.length; }
      rows.push(`| ${FYM[i]} | ${fmtU(k, a, plat)} | ${fmtU(k, t, plat)} | ${vari(k, a, t).txt} |`);
    }
    const h = headline(c, k, ps), v = vari(k, h.a, h.t), hb = band(k, h.a, h.t);
    const who = plantId ? PBY[plantId].n : ps.length < PLANTS.length ? `the ${plat === 'api' ? 'API' : 'Formulation'} plants` : 'all plants';
    return `**${K.n}** for ${who}, ${period}: **${fmtU(k, h.a, plat)}** against a ${tLabel.toLowerCase()} of ${fmtU(k, h.t, plat)} (${v.txt}), status **${bLab(hb)}**.\n\n` +
      `| Month | Actual | ${tLabel} | Variance |\n|---|---|---|---|\n${rows.join('\n')}\n\n${hb !== 'green' ? cz(k, plantId) : ''}${note}`;
  }

  /* plant-wise comparison — one table per platform so units never mix */
  const parts: string[] = [];
  (['formulation', 'api'] as const).forEach((pl) => {
    const ps = PLANTS.filter((p) => p.p === pl);
    const rows = ps.map((p) => {
      const x = AT(c, k, p.id), b = band(k, x.a, x.t);
      return `| ${p.n} | ${fmtU(k, x.a, pl)} | ${fmtU(k, x.t, pl)} | ${vari(k, x.a, x.t).txt} | ${bLab(b)} |`;
    });
    parts.push(`**${pl === 'api' ? 'API' : 'Formulation'} plants**\n\n| Plant | Actual | ${tLabel} | Variance | Status |\n|---|---|---|---|---|\n${rows.join('\n')}`);
  });
  const all = PLANTS.map((p) => ({ p, x: AT(c, k, p.id) })).map((r) => ({ ...r, b: band(k, r.x.a, r.x.t) }));
  const worst = all.filter((r) => r.b !== 'green');
  const lead = worst.length
    ? `${worst.length} of ${all.length} plants are outside tolerance on **${K.n}** for ${period}: ${worst.map((r) => r.p.s).join(', ')}.`
    : `All ${all.length} plants are within tolerance on **${K.n}** for ${period}.`;
  return `${lead}\n\n${parts.join('\n\n')}\n\n${worst.length ? cz(k) : ''}${note}`;
}
