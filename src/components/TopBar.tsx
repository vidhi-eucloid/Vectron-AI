import { useMemo, useState, type ReactNode } from 'react';
import { PLANTS, PBY } from '../engine/data';
import { FYM, YEARS, maxM, periodLabel, scopeLabel } from '../engine/engine';
import { Icon } from '../lib/icons';
import { useStore } from '../lib/store';

function Field({ icon, children, label }: { icon: string; children: ReactNode; label: string }) {
  return (
    <label className="tb-field" title={label}>
      <Icon n={icon} size={14} />
      {children}
      <Icon n="down" size={12} className="tb-caret" />
    </label>
  );
}

export function TopBar() {
  const { ctx, setCtx, setKpi, toast } = useStore();
  const mx = maxM(ctx);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [a, b] = drag || [ctx.m0, ctx.m1];
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const monVal = ctx.m0 === 0 && ctx.m1 === mx ? 'all' : ctx.m0 === ctx.m1 ? String(ctx.m0) : 'custom';
  const plants = useMemo(() => PLANTS.filter((p) => ctx.type === 'all' || p.p === ctx.type), [ctx.type]);
  const commit = (x: number, y: number) => { setDrag(null); setCtx({ m0: Math.min(x, y), m1: Math.max(x, y) }); };

  return (
    <header className="topbar">
      <div className="tb-brand">
        <span className="tb-mark"><Icon n="spark" size={15} /></span>
        <span className="tb-name">Vectron AI</span>
        <span className="tb-sep" />
        <div className="tb-title">
          <strong>Manufacturing Performance Cockpit</strong>
          <span>{scopeLabel(ctx)} · {periodLabel(ctx)}</span>
        </div>
      </div>

      <div className="tb-tools">
        <div className="tb-group" role="group" aria-label="Period">
          <Field icon="cal" label="Financial year">
            <select value={ctx.year} onChange={(e) => { const y = +e.target.value; setCtx({ year: y, m0: 0, m1: YEARS[y].max }); }}>
              {YEARS.map((y, i) => <option key={y.l} value={i}>{y.l}</option>)}
            </select>
          </Field>
          <Field icon="clock" label="Month">
            <select value={monVal} onChange={(e) => {
              const v = e.target.value;
              if (v === 'all') setCtx({ m0: 0, m1: mx });
              else if (v !== 'custom') setCtx({ m0: +v, m1: +v });
            }}>
              <option value="all">{YEARS[ctx.year].cur ? 'Year to date' : 'Full year'}</option>
              {FYM.slice(0, mx + 1).map((m, i) => <option key={m} value={i}>{m}</option>)}
              <option value="custom" disabled={monVal !== 'custom'}>Custom range</option>
            </select>
          </Field>
          <div className="tb-range" title="Drag to set a month range">
            <div className="rng">
              <span className="rng-trk" />
              <span className="rng-fil" style={{ left: `${(lo / mx) * 100}%`, width: `${((hi - lo) / mx) * 100}%` }} />
              <input type="range" min={0} max={mx} value={a} aria-label="Period start"
                onChange={(e) => setDrag([+e.target.value, b])} onMouseUp={() => commit(a, b)} onTouchEnd={() => commit(a, b)} onKeyUp={() => commit(a, b)} />
              <input type="range" min={0} max={mx} value={b} aria-label="Period end"
                onChange={(e) => setDrag([a, +e.target.value])} onMouseUp={() => commit(a, b)} onTouchEnd={() => commit(a, b)} onKeyUp={() => commit(a, b)} />
            </div>
            <span className="rng-lab">{FYM[lo]}–{FYM[hi]}</span>
          </div>
        </div>

        <div className="seg seg-dark" role="radiogroup" aria-label="Compare against">
          {(['target', 'base'] as const).map((v) => (
            <button key={v} role="radio" aria-checked={ctx.basis === v} className={ctx.basis === v ? 'on' : ''}
              onClick={() => { setCtx({ basis: v }); toast(v === 'base' ? 'Comparing against last-FY March baseline' : 'Comparing against FY targets'); }}
              title={v === 'base' ? 'Last-FY March exit reading' : 'Financial-year targets'}>
              {v === 'target' ? 'FY target' : 'Baseline'}
            </button>
          ))}
        </div>

        <div className="tb-group" role="group" aria-label="Scope">
          <Field icon="type" label="Plant type">
            <select value={ctx.type} onChange={(e) => { setCtx({ type: e.target.value as any, plant: 'all' }); setKpi(null); }}>
              <option value="all">All types</option>
              <option value="formulation">Formulation</option>
              <option value="api">API</option>
            </select>
          </Field>
          <Field icon="plant" label="Plant">
            <select value={ctx.plant} onChange={(e) => {
              const v = e.target.value;
              if (v === 'all') setCtx({ plant: 'all' });
              else setCtx({ plant: v, type: ctx.type === 'all' ? 'all' : PBY[v].p });
            }}>
              <option value="all">All plants</option>
              {plants.map((p) => <option key={p.id} value={p.id}>{p.n}</option>)}
            </select>
          </Field>
        </div>

        <button className="tb-icon" aria-label="Alerts"
          onClick={() => toast('Behror: Compressor-3 breakdown · 4 requisitions past SLA · inventory beyond 180 days')}>
          <Icon n="bell" size={16} /><span className="tb-dot" />
        </button>
        <span className="tb-avatar" title="Signed in">RV</span>
      </div>
    </header>
  );
}
