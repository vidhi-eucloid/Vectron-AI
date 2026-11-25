import { useMemo } from 'react';
import { GRP, GRPS, GRP_ORDER, PHIW } from '../engine/data';
import { periodLabel, phi, phiNet, rowsFor, scopeShort, severity, sp } from '../engine/engine';
import { Icon } from '../lib/icons';
import { useStore } from '../lib/store';

const tone = (v: number) => (v >= 80 ? 'green' : v >= 60 ? 'amber' : 'red');

export function HealthHero() {
  const { ctx, setKpi } = useStore();
  const d = useMemo(() => {
    const ps = sp(ctx), rs = rowsFor(ctx, ps), P = phi(ctx, ps);
    const flag = rs.filter((x) => x.b !== 'green' && !x.sup).sort((x, y) => (x.b === y.b ? severity(y) - severity(x) : x.b === 'red' ? -1 : 1));
    return {
      P, net: phiNet(), n: rs.length, lead: flag[0],
      r: rs.filter((x) => x.b === 'red').length, a: rs.filter((x) => x.b === 'amber').length, g: rs.filter((x) => x.b === 'green').length,
    };
  }, [ctx]);
  const sc = d.P.sc, delta = sc - d.net, single = ctx.plant !== 'all' || ctx.type !== 'all';
  const R = 30, C = 2 * Math.PI * R;

  return (
    <section className="hero" aria-label="Plant health">
      <div className={'hero-dial t-' + tone(sc)}>
        <svg viewBox="0 0 72 72" className="dial">
          <defs>
            <linearGradient id="dialg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="dg0" /><stop offset="1" className="dg1" />
            </linearGradient>
          </defs>
          <circle cx="36" cy="36" r={R} className="dial-trk" />
          {Array.from({ length: 40 }).map((_, i) => {
            const ang = (i / 40) * Math.PI * 2 - Math.PI / 2;
            return <line key={i} className="dial-tick" x1={36 + Math.cos(ang) * 35} y1={36 + Math.sin(ang) * 35} x2={36 + Math.cos(ang) * 33.6} y2={36 + Math.sin(ang) * 33.6} />;
          })}
          <circle cx="36" cy="36" r={R} className="dial-arc" style={{ strokeDasharray: `${(C * sc) / 100} ${C}` }} transform="rotate(-90 36 36)" />
        </svg>
        <div className="dial-v"><b>{sc}</b><span>/100</span></div>
        <div className="dial-meta">
          <span className="dial-k">Plant Health Index</span>
          <span className="dial-scope">{single ? scopeShort(ctx) : 'Network'}</span>
          {single
            ? <span className={'dial-d ' + (delta >= 0 ? 'up' : 'dn')}>{delta >= 0 ? '+' : '−'}{Math.abs(delta)} vs network {d.net}</span>
            : <span className="dial-d">{d.n} KPIs, weighted</span>}
        </div>
      </div>

      <div className="hero-groups" aria-label="Score by group">
        {GRP_ORDER.filter((g) => d.P.per[g] !== undefined).map((g) => {
          const v = Math.round(d.P.per[g]!);
          return (
            <div key={g} className="hg" title={`${GRP[g]}: ${v} · weight ${PHIW[g]}%`}>
              <div className="hg-top"><span>{GRPS[g]}</span><b className={'tx-' + tone(v)}>{v}</b></div>
              <div className="hg-bar"><i className={'bg-' + tone(v)} style={{ width: v + '%' }} /></div>
              <div className="hg-w">{PHIW[g]}% weight</div>
            </div>
          );
        })}
      </div>

      <div className="hero-status">
        <div className="hs-nums">
          <div className="hs red"><b>{d.r}</b><span>Intervene</span></div>
          <div className="hs amber"><b>{d.a}</b><span>Monitor</span></div>
          <div className="hs green"><b>{d.g}</b><span>On track</span></div>
        </div>
        <div className="hs-bar" title={`${d.r} intervene · ${d.a} monitor · ${d.g} on track`}>
          <i className="bg-red" style={{ flex: d.r }} /><i className="bg-amber" style={{ flex: d.a }} /><i className="bg-green" style={{ flex: d.g }} />
        </div>
        <div className="hs-period">{periodLabel(ctx)}</div>
      </div>

      {d.lead && (
        <button className={'hero-lead b-' + d.lead.b} onClick={() => setKpi(d.lead!.k.id)}>
          <span className="hl-k">Lead exception</span>
          <span className="hl-n">{d.lead.k.s}</span>
          <span className="hl-v">{d.lead.v.txt} <Icon n="arrowRight" size={13} /></span>
        </button>
      )}
    </section>
  );
}
