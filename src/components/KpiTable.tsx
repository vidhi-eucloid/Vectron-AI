import { useMemo, useState } from 'react';
import { GRP, GRP_ORDER, KORD, type GroupId, type Kpi, type Plant, type Platform } from '../engine/data';
import {
  aggB, band, bLab, fmtN, periodLabel, plats, relPs, rowsForT, sp, trail, trend, unitSplit, vari, type Ctx, type Row,
} from '../engine/engine';
import { Icon } from '../lib/icons';
import { useStore } from '../lib/store';
import { buildRows, LeanTable, StatusList, TileGrid, type KView } from './KpiViews';

const VIEWS: [KView, string, string][] = [['status', 'By status', 'layers'], ['lean', 'Table', 'grid2'], ['tiles', 'Tiles', 'stack'], ['detailed', 'Detailed', 'doc']];
const readView = (): KView => { try { return (localStorage.getItem('vx-kview') as KView) || 'status'; } catch { return 'status'; } };

const shortU = (u: string) => u.replace('/pack', '/pk');
function unitCell(K: Kpi, mixed: boolean, solo: Platform) {
  if (K.id === 'fv') return '% fix / var';
  if (mixed && unitSplit(K.id)) return `${shortU(K.u.formulation)} · ${shortU(K.u.api)}`;
  return shortU(K.u[mixed ? 'formulation' : solo]);
}

function Val({ n, v, tone, muted }: { n: string; v?: string; tone?: string; muted?: boolean }) {
  return (
    <span className="kv">
      <span className={'kv-n' + (muted ? ' muted' : '') + (tone && !v ? ' tx-' + tone : '')}>{n}</span>
      {v && <span className={'kv-d tx-' + tone}>{v}</span>}
    </span>
  );
}
function platVal(c: Ctx, K: Kpi, list: Plant[], plat: Platform) {
  if (!list.length) return <span className="kv"><span className="kv-n muted">—</span></span>;
  const x = aggB(c, K.id, list), b = band(K.id, x.a, x.t), v = vari(K.id, x.a, x.t);
  const tone = v.fav ? 'green' : b;
  return K.vm === 'cur' ? <Val n={fmtN(K.id, x.a, plat)} tone={tone} /> : <Val n={fmtN(K.id, x.a, plat)} v={v.txt} tone={tone} />;
}

export function KpiTable() {
  const { ctx, kpi, setKpi } = useStore();
  const [closed, setClosed] = useState<Partial<Record<GroupId, boolean>>>({});
  const [view, setViewS] = useState<KView>(readView);
  const setView = (v: KView) => { setViewS(v); try { localStorage.setItem('vx-kview', v); } catch { /* private mode */ } };
  const ps = useMemo(() => sp(ctx), [ctx]);
  const rows = useMemo(() => rowsForT(ctx, ps), [ctx, ps]);
  const mixed = plats(ps).length > 1, solo = plats(ps)[0] || 'formulation';
  const fP = ps.filter((p) => p.p === 'formulation'), aP = ps.filter((p) => p.p === 'api');
  const base = ctx.basis === 'base';
  const byG: Partial<Record<GroupId, Row[]>> = {};
  rows.forEach((r) => (byG[r.k.g] = byG[r.k.g] || []).push(r));

  return (
    <section className="panel kpi-panel" aria-label="KPI scorecard">
      <div className="panel-h">
        <h2>KPI scorecard</h2>
        <span className="panel-sub">{rows.length} KPIs · vs {base ? 'last-FY baseline' : 'FY target'}</span>
        <div className="seg seg-light kview" role="radiogroup" aria-label="Scorecard layout">
          {VIEWS.map(([v, l, ic]) => (
            <button key={v} role="radio" aria-checked={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)} title={l}>
              <Icon n={ic} size={13} /><span>{l}</span>
            </button>
          ))}
        </div>
      </div>
      {view !== 'detailed' ? (
        <div className="ktab-wrap scroll">
          {(() => {
            const rm = buildRows(ctx, rows, ps), sel = (k: string) => setKpi(kpi === k ? null : k);
            if (view === 'status') return <StatusList rows={rm} sel={kpi} onSel={sel} base={base} />;
            if (view === 'tiles') return <TileGrid rows={rm} sel={kpi} onSel={sel} base={base} />;
            return <LeanTable rows={rm} sel={kpi} onSel={sel} base={base} />;
          })()}
        </div>
      ) : (
      <div className="ktab-wrap scroll">
        <table className="ktab">
          <colgroup>
            <col className="c-name" /><col className="c-unit" /><col className="c-val" /><col className="c-val" /><col className="c-trail" /><col className="c-st" />
          </colgroup>
          <thead>
            <tr>
              <th>KPI</th>
              <th className="ctr">Unit</th>
              <th className="num">{mixed ? 'Formulation' : 'Actual'}</th>
              <th className="num">{mixed ? 'API' : base ? 'Baseline' : 'Target'}</th>
              <th className="ctr">Quarterly trail</th>
              <th className="ctr">Status</th>
            </tr>
          </thead>
          {GRP_ORDER.map((gid, gi) => {
            const sub = byG[gid];
            if (!sub?.length) return null;
            sub.sort((x, y) => KORD[x.k.id] - KORD[y.k.id]);
            const cnt = { red: 0, amber: 0, green: 0 };
            sub.forEach((r) => cnt[r.b]++);
            const isClosed = !!closed[gid];
            return (
              <tbody key={gid} className={isClosed ? 'closed' : ''}>
                <tr className="grp">
                  <td colSpan={6}>
                    <button className="grp-btn" onClick={() => setClosed({ ...closed, [gid]: !isClosed })} aria-expanded={!isClosed}>
                      <Icon n="down" size={13} className="grp-chev" />
                      <span className="grp-n">{GRP[gid]}</span>
                      <span className="grp-c">
                        {cnt.red > 0 && <span className="dotc red">{cnt.red}</span>}
                        {cnt.amber > 0 && <span className="dotc amber">{cnt.amber}</span>}
                        {cnt.green > 0 && <span className="dotc green">{cnt.green}</span>}
                      </span>
                    </button>
                  </td>
                </tr>
                {!isClosed && sub.map((r) => {
                  const K = r.k, rp = relPs(ctx, K.id, ps), tr = trend(ctx, K.id, rp), cells = trail(ctx, K.id, rp);
                  const tone = r.v.fav ? 'green' : r.b;
                  return (
                    <tr key={K.id} className={'krow' + (kpi === K.id ? ' on' : '')} tabIndex={0}
                      onClick={() => setKpi(kpi === K.id ? null : K.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpi(kpi === K.id ? null : K.id); } }}
                      title={K.n}>
                      <td>
                        <span className="kname">
                          <span className={'kic b-' + r.b}><Icon n={K.ic} size={13} /></span>
                          <span className="kn">{K.s}</span>
                        </span>
                      </td>
                      <td className="ctr kunit">{unitCell(K, mixed, solo)}</td>
                      {mixed ? (
                        <>
                          <td className="num">{platVal(ctx, K, fP, 'formulation')}</td>
                          <td className="num">{platVal(ctx, K, aP, 'api')}</td>
                        </>
                      ) : (
                        <>
                          <td className="num">{K.vm === 'cur' ? <Val n={fmtN(K.id, r.a, solo)} tone={tone} /> : <Val n={fmtN(K.id, r.a, solo)} v={r.v.txt} tone={tone} />}</td>
                          <td className="num"><Val n={fmtN(K.id, r.t, solo)} muted /></td>
                        </>
                      )}
                      <td className="ctr">
                        <span className="trail">
                          {cells.map((c) => (
                            <span key={c.q} className={`tc b-${c.b}${c.strong ? ' strong' : ''}${c.now ? ' now' : ''}`}
                              title={`${c.q} (${c.label})${c.part ? ', partial' : ''} · ${bLab(c.b)}`}>{c.q}</span>
                          ))}
                        </span>
                      </td>
                      <td className="ctr">
                        <span className="kst">
                          <span className={'trend ' + tr} title={tr === 'bad' ? 'Gap widening over the period' : tr === 'good' ? 'Gap narrowing over the period' : 'No change'}>
                            {tr === 'flat' ? '→' : tr === 'bad' ? '↑' : '↓'}
                          </span>
                          <span className={'pill b-' + r.b}>{bLab(r.b)}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
      )}
      <div className="kleg">
        <span><i className="sw bg-red" />Adverse</span>
        <span><i className="sw bg-green" />Favourable</span>
        {view === 'detailed'
          ? <span><i className="sw tc-key" />Quarterly trail, darker is worse</span>
          : <span className="kleg-tol">
              <span className="tol key" aria-hidden="true">
                <span className="tol-z z-red" style={{ left: 0, width: '13%' }} /><span className="tol-z z-amber" style={{ left: '13%', width: '24%' }} />
                <span className="tol-z z-green" style={{ left: '37%', width: '63%' }} /><span className="tol-lim" style={{ left: '13%' }} /><span className="tol-lim" style={{ left: '37%' }} />
                <span className="tol-fill bg-amber" style={{ left: '28%', width: '22%' }} /><span className="tol-tgt" /><span className="tol-pin p-amber" style={{ left: '28%' }} />
              </span>
              <b>Line</b> = target · dot = actual · ticks = the KPI's own monitor and intervene limits
            </span>}
        <span className="kleg-r">{periodLabel(ctx)}</span>
      </div>
    </section>
  );
}
