/* Presentational views for the insight engine — used by the Insights panel and the chat dock. */
import { fmtN } from '../engine/engine';
import type { Brief, Drill } from '../engine/insight';
import type { Detail } from '../engine/drill';
import { Icon } from '../lib/icons';
import { Rich } from '../lib/Rich';

const stateWord = { red: 'Needs intervention', amber: 'Worth watching', green: 'On track' } as const;

export function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="isec">
      <header className="isec-h"><h3>{title}</h3>{aside && <span>{aside}</span>}</header>
      {children}
    </section>
  );
}

export function Situation({ state, eyebrow, headline, support, compact }: { state: 'red' | 'amber' | 'green'; eyebrow: string; headline: string; support: string; compact?: boolean }) {
  return (
    <div className={'situ b-' + state + (compact ? ' compact' : '')}>
      <div className="situ-top"><span className={'situ-dot bg-' + state} />{stateWord[state]}<span className="situ-sc">{eyebrow}</span></div>
      <p className="situ-h"><Rich text={headline} /></p>
      <p className="situ-s"><Rich text={support} /></p>
    </div>
  );
}

/* ---------------- brief ---------------- */
export function BriefView({ b, onKpi, onPlant, compact }: { b: Brief; onKpi?: (k: string) => void; onPlant?: (p: string) => void; compact?: boolean }) {
  return (
    <div className="iview">
      <Situation state={b.state} eyebrow={b.scope[0].toUpperCase() + b.scope.slice(1)} headline={b.headline} support={b.support} compact={compact} />
      {b.conc && (
        <Section title={b.conc.title} aside={b.conc.caption}>
          <div className="conc">
            {b.conc.rows.map((r) => (
              <button key={r.id} className="conc-r" onClick={() => (r.kind === 'plant' ? onPlant?.(r.id) : onKpi?.(r.id))}>
                <span className="conc-n">{r.name}</span>
                <span className="conc-t"><i className={'bg-' + r.tone} style={{ width: Math.max(4, r.width * 100) + '%' }} /></span>
                <span className={'conc-v tx-' + r.tone}>{r.value}</span>
                {r.chips.length > 0 && (
                  <span className="conc-chips">{r.chips.map((c) => <span key={c.n} className="chip-s">{c.n} <b>{c.v}</b></span>)}</span>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}
      {b.why.length > 0 && (
        <Section title="Why it is happening">
          <div className="why">
            {b.why.map((w) => (
              <button key={w.k} className="why-r" onClick={() => onKpi?.(w.k)}>
                <span className={'why-bar bg-' + w.tone} />
                <span className="why-body">
                  <span className="why-k"><b>{w.name}</b><span className={'tx-' + w.tone}>{w.v}</span>{w.site && <span className="why-site">{w.site}</span>}</span>
                  <span className="why-t">{w.text}</span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {b.actions.length > 0 && (
        <Section title="What to do next">
          <ol className="acts">
            {b.actions.map((a, i) => (
              <li key={a.k}>
                <span className={'act-n b-' + a.tone}>{i + 1}</span>
                <span className="act-t"><b>{a.site}</b> {a.text}</span>
                <span className="act-i">{a.impact}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

/* ---------------- drill ---------------- */
function Spark({ d }: { d: Drill }) {
  const pts = d.spark;
  if (pts.length < 2) return <p className="muted-p">Widen the period to at least two months to see a trend.</p>;
  const W = 460, H = 92, L = 8, R = 64, T = 12, B = 20;
  const vals = pts.map((p) => p.a).concat(pts.map((p) => p.t));
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const span = Math.max(mx - mn, Math.abs(mx || 1) * 0.04, 1e-6), lo = mn - span * 0.35, hi = mx + span * 0.35;
  const X = (i: number) => L + (i * (W - L - R)) / (pts.length - 1);
  const Y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const line = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.a).toFixed(1)}`).join(' ');
  const area = `M${X(0)},${H - B} L${line.replace(/ /g, ' L')} L${X(pts.length - 1)},${H - B} Z`;
  const tY = Y(pts[pts.length - 1].t), last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${d.short} by month`}>
      <defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand)" stopOpacity=".18" /><stop offset="1" stopColor="var(--brand)" stopOpacity="0" /></linearGradient></defs>
      <polyline points={pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.t).toFixed(1)}`).join(' ')} className="sp-tgt" />
      <text x={W - R + 6} y={tY + 3} className="sp-lab">target</text>
      <path d={area} fill="url(#spg)" />
      <polyline points={line} className="sp-line" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={X(i)} cy={Y(p.a)} r={i === pts.length - 1 ? 4 : 3} className={'sp-pt f-' + p.b} />
          <text x={X(i)} y={H - 5} textAnchor="middle" className="sp-x">{p.l}</text>
        </g>
      ))}
      <text x={W - R + 6} y={Y(last.a) + 4} className="sp-v">{fmtN(d.k, last.a, d.plat)}</text>
    </svg>
  );
}

export function DetailTable({ d }: { d: Detail }) {
  return (
    <div className="dtab-wrap">
      {d.split && (
        <div className="split">
          <div className="split-bar">
            <i className="bg-vio" style={{ flex: Math.abs(d.split.vol) }} />
            <i className="bg-brand" style={{ flex: Math.abs(d.split.op) }} />
          </div>
          <div className="split-leg">
            <span><i className="sw bg-vio" /><b>Volume {d.split.vol >= 0 ? '+' : '−'}{Math.abs(d.split.vol).toFixed(d.split.dec)}</b> output below budget, so fixed cost spreads over fewer units</span>
            <span><i className="sw bg-brand" /><b>OPEx {d.split.op >= 0 ? '+' : '−'}{Math.abs(d.split.op).toFixed(d.split.dec)}</b> spend above budget at the volume achieved</span>
          </div>
        </div>
      )}
      {d.rows.length > 0 && (
        <table className="dtab">
          <thead><tr>{d.cols.map((c) => <th key={c.h} className={c.r ? 'num' : ''}>{c.h}</th>)}</tr></thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => (
                <td key={j} className={(d.cols[j]?.r ? 'num ' : '') + (c.tone ? 'tx-' + c.tone : '')}>
                  {c.t}{c.sub && <small>{c.sub}</small>}
                </td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DrillView({ d, onBack, onKpi, onPlant, compact }: { d: Drill; onBack?: () => void; onKpi?: (k: string) => void; onPlant?: (p: string) => void; compact?: boolean }) {
  return (
    <div className="iview">
      {onBack && <button className="back" onClick={onBack}><Icon n="back" size={13} />All KPIs</button>}
      <div className="drill-head">
        <div>
          <h2 className="drill-name">{d.name}</h2>
          <div className="drill-nums">
            <span className="dn-v">{d.value}</span>
            <span className="dn-t">target {d.target}</span>
            <span className={'dn-d tx-' + (d.fav ? 'green' : d.state)}>{d.variance}</span>
          </div>
        </div>
        <span className={'pill lg b-' + d.state}>{stateWord[d.state]}</span>
      </div>
      <Situation state={d.state} eyebrow={compact ? '' : d.short} headline={d.headline} support={d.support} compact />

      <Section title="By site">
        <div className="sites">
          {d.sites.map((s) => (
            <button key={s.id} className={'site b-' + s.b} onClick={() => onPlant?.(s.id)} title={`Focus on ${s.name}`}>
              <span className="site-n">{s.name}</span>
              <span className="site-p">{s.plat === 'api' ? 'API' : 'Formulation'}</span>
              <span className="site-v">{s.value}</span>
              <span className={'site-d tx-' + s.b}>{s.v}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Root cause and consequence">
        <div className="cause">
          <div><h4>Why</h4><p><Rich text={d.cause} /></p></div>
          <div><h4>What it costs</h4><p>{d.consequence}</p></div>
        </div>
        {!compact && d.detail && (d.detail.rows.length > 0 || d.detail.split) && (
          <details className="detail" open>
            <summary>{d.detail.label}</summary>
            <DetailTable d={d.detail} />
          </details>
        )}
      </Section>

      <Section title={d.plan.mode === 'recover' ? 'Recovery plan' : d.plan.mode === 'monitor' ? 'What to watch' : 'Keep it there'}
        aside={d.plan.phiGain ? `Worth about +${d.plan.phiGain} pts to the health index` : undefined}>
        <ol className="plan">
          {d.plan.steps.map((s, i) => (
            <li key={i}>
              <span className="plan-w">{s.when}</span>
              <span className="plan-t">{s.text}{s.site && <b> {s.site}.</b>}</span>
              {s.from != null && <span className="plan-s">{s.from} → {s.to}</span>}
            </li>
          ))}
        </ol>
      </Section>

      {!compact && d.links.length > 0 && (
        <Section title="Effect on other KPIs">
          <div className="links">
            {d.links.map((l) => (
              <button key={l.k} className="link-r" onClick={() => onKpi?.(l.k)}>
                <span className={'link-dir ' + (l.dir === 'drives' ? 'dr' : 'im')}>{l.dir === 'drives' ? 'Drives' : 'Improves with'}</span>
                <span className="link-b"><b>{l.name}</b> {l.eff}</span>
                <Icon n="chev" size={13} />
              </button>
            ))}
          </div>
        </Section>
      )}

      {!compact && <Section title="Monthly trend"><div className="spark-wrap"><Spark d={d} /></div></Section>}
    </div>
  );
}
