/* Alternative scorecard layouts: Lean table, By status, Tiles.
   All share one row model so numbers are identical across views. */
import { useState } from 'react';
import { GRP, GRPS, GRP_ORDER, KORD, type GroupId, type Plant, type Platform } from '../engine/data';
import {
  aggB, band, bLab, fmtN, plats, relPs, severity, tolPos, tolText, trail, trend, vari, type Band, type Ctx, type Row, type TrailCell,
} from '../engine/engine';
import { Icon } from '../lib/icons';

export type KView = 'lean' | 'status' | 'tiles' | 'detailed';

interface PlatVal { label: string; val: string; v: string; tone: Band | 'green'; b: Band }
export interface RowModel {
  id: string; name: string; full: string; unit: string; ic: string; g: GroupId;
  b: Band; tone: Band; val: string; tgt: string; v: string; fav: boolean; isCur: boolean;
  tol: { g: number; amber: number; red: number; rule: string; tgt: string };
  trail: TrailCell[]; trend: 'bad' | 'good' | 'flat';
  plat?: PlatVal[];         // mixed scope: one value per platform
  sev: number;
}

const shortU = (u: string) => u.replace('/pack', '/pk').replace('% fix|var', '% fixed / var');

export function buildRows(ctx: Ctx, rows: Row[], ps: Plant[]): RowModel[] {
  const mixed = plats(ps).length > 1, solo: Platform = plats(ps)[0] || 'formulation';
  const fP = ps.filter((p) => p.p === 'formulation'), aP = ps.filter((p) => p.p === 'api');
  return rows.map((r) => {
    const K = r.k, rp = relPs(ctx, K.id, ps);
    const pv = (list: Plant[], plat: Platform, label: string): PlatVal | null => {
      if (!list.length) return null;
      const x = aggB(ctx, K.id, list), b = band(K.id, x.a, x.t), v = vari(K.id, x.a, x.t);
      return { label, val: fmtN(K.id, x.a, plat), v: v.txt, tone: v.fav ? 'green' : b, b };
    };
    const unit = mixed && K.u.formulation !== K.u.api ? `${shortU(K.u.formulation)} · ${shortU(K.u.api)}` : shortU(K.u[mixed ? 'formulation' : solo]);
    const tp = tolPos(K, r.a, r.t);
    return {
      id: K.id, name: K.s, full: K.n, unit, ic: K.ic, g: K.g, b: r.b, tone: r.v.fav ? 'green' : r.b,
      val: fmtN(K.id, r.a, r.plat), tgt: fmtN(K.id, r.t, r.plat), v: r.v.txt, fav: r.v.fav, isCur: K.vm === 'cur',
      tol: { ...tp, rule: tolText(K), tgt: K.vm === 'cur' ? 'break-even (₹0)' : fmtN(K.id, r.t, r.plat) },
      trail: trail(ctx, K.id, rp), trend: trend(ctx, K.id, rp),
      plat: mixed ? ([pv(fP, 'formulation', 'Formulation'), pv(aP, 'api', 'API')].filter(Boolean) as PlatVal[]) : undefined,
      sev: severity(r),
    };
  });
}

/* ---------------- shared bits ---------------- */
/* Tolerance bar: target in the middle, the KPI's own amber/red limits marked on the
   adverse side. The pin's zone is the KPI's status — no extra numbers involved. */
function TolBar({ r }: { r: RowModel }) {
  const { g, amber, red } = r.tol;
  const span = red * 2;                                      // left half = up to twice the intervene limit
  const pos = (d: number) => 50 - (Math.max(-span, Math.min(span, d)) / span) * 50;
  const pin = Math.max(4, Math.min(96, pos(g))), am = pos(amber), rd = pos(red);
  const tone = g <= amber ? 'green' : r.b;
  const fill = { left: Math.min(pin, 50) + '%', width: Math.abs(pin - 50) + '%' };
  const tip = `${r.full}: ${r.val} vs target ${r.tol.tgt} (${r.v}). ${r.tol.rule}.`;
  return (
    <span className="tol" title={tip} aria-label={tip} role="img">
      <span className="tol-z z-red" style={{ left: 0, width: rd + '%' }} />
      <span className="tol-z z-amber" style={{ left: rd + '%', width: am - rd + '%' }} />
      <span className="tol-z z-green" style={{ left: am + '%', width: 100 - am + '%' }} />
      <span className="tol-lim" style={{ left: rd + '%' }} />
      {am < 50 && <span className="tol-lim" style={{ left: am + '%' }} />}
      <span className={'tol-fill bg-' + tone} style={fill} />
      <span className="tol-tgt" />
      {g > span && <span className="tol-over">‹</span>}
      <span className={'tol-pin p-' + tone} style={{ left: pin + '%' }} />
    </span>
  );
}
function Dots({ cells }: { cells: TrailCell[] }) {
  return (
    <span className="dots" aria-label={'Quarterly status: ' + cells.map((c) => `${c.q} ${bLab(c.b)}`).join(', ')}>
      {cells.map((c) => <i key={c.q} className={`d-${c.b}${c.now ? ' now' : ''}`} title={`${c.q} (${c.label}) · ${bLab(c.b)}`} />)}
    </span>
  );
}
const Status = ({ b }: { b: Band }) => <span className={'st st-' + b}><i />{bLab(b)}</span>;
const TrendG = ({ t }: { t: RowModel['trend'] }) => (
  <span className={'trend ' + t} title={t === 'bad' ? 'Gap widening' : t === 'good' ? 'Gap narrowing' : 'No change'}>{t === 'flat' ? '→' : t === 'bad' ? '↑' : '↓'}</span>
);

function ValueCell({ r, base }: { r: RowModel; base: boolean }) {
  if (r.plat) {
    return (
      <span className="lv2">
        {r.plat.map((p) => (
          <span key={p.label} className="lv2-r">
            <em>{p.label === 'Formulation' ? 'F' : 'API'}</em>
            <b>{p.val}</b>
            {!r.isCur && <span className={'tx-' + p.tone}>{p.v}</span>}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="lv">
      <b className={r.isCur ? 'tx-' + r.tone : ''}>{r.val}</b>
      {!r.isCur && <span>{base ? 'base' : 'target'} {r.tgt}</span>}
    </span>
  );
}

/* ---------------- 1. Lean table ---------------- */
export function LeanTable({ rows, sel, onSel, base }: { rows: RowModel[]; sel: string | null; onSel: (k: string) => void; base: boolean }) {
  const [closed, setClosed] = useState<Partial<Record<GroupId, boolean>>>({});
  return (
    <div className="lean">
      <div className="lean-h">
        <span>KPI</span><span className="r">Value</span><span className="ctr">vs {base ? 'baseline' : 'target'}</span><span className="ctr">Trail</span><span>Status</span>
      </div>
      {GRP_ORDER.map((g) => {
        const sub = rows.filter((r) => r.g === g).sort((a, b) => KORD[a.id] - KORD[b.id]);
        if (!sub.length) return null;
        const bad = sub.filter((r) => r.b !== 'green').length;
        return (
          <div key={g} className="lean-g">
            <button className="lean-gh" onClick={() => setClosed({ ...closed, [g]: !closed[g] })} aria-expanded={!closed[g]}>
              <Icon n="down" size={12} className={'grp-chev' + (closed[g] ? ' rot' : '')} />
              <b>{GRP[g]}</b>
              <span>{bad ? `${bad} of ${sub.length} need attention` : 'All on track'}</span>
            </button>
            {!closed[g] && sub.map((r) => (
              <button key={r.id} className={'lean-r' + (sel === r.id ? ' on' : '')} onClick={() => onSel(r.id)} title={r.full}>
                <span className="lean-n"><i className={'rail-b bg-' + r.b} /><span><b>{r.name}</b><small>{r.unit}</small></span></span>
                <span className="r"><ValueCell r={r} base={base} /></span>
                <span className="lean-m">
                  <TolBar r={r} />
                  <span className={'lean-v tx-' + r.tone}>{r.v}</span>
                </span>
                <span className="ctr"><Dots cells={r.trail} /></span>
                <span className="lean-s"><TrendG t={r.trend} /><Status b={r.b} /></span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- 2. By status (action list) ---------------- */
export function StatusList({ rows, sel, onSel, base }: { rows: RowModel[]; sel: string | null; onSel: (k: string) => void; base: boolean }) {
  const [openGreen, setOpenGreen] = useState(false);
  const sections: { b: Band; title: string; sub: string }[] = [
    { b: 'red', title: 'Intervene', sub: 'Past the red threshold' },
    { b: 'amber', title: 'Monitor', sub: 'Outside tolerance, not yet red' },
    { b: 'green', title: 'On track', sub: 'Within tolerance' },
  ];
  return (
    <div className="sl">
      <div className="sl-head" aria-hidden="true">
        <span>KPI</span><span className="r">Actual</span><span className="ctr">Position vs {base ? 'baseline' : 'target'}</span><span className="r">Trail</span>
      </div>
      {sections.map((s) => {
        const list = rows.filter((r) => r.b === s.b).sort((a, b) => b.sev - a.sev || KORD[a.id] - KORD[b.id]);
        if (!list.length) return null;
        const folded = s.b === 'green' && !openGreen;
        return (
          <section key={s.b} className={'sl-sec sl-' + s.b}>
            <header className="sl-h">
              <span className={'sl-count bg-' + s.b}>{list.length}</span>
              <b>{s.title}</b><span>{s.sub}</span>
              {s.b === 'green' && <button className="linkb" onClick={() => setOpenGreen(!openGreen)}>{openGreen ? 'Hide' : 'Show'}</button>}
            </header>
            {folded ? (
              <div className="sl-fold">{list.map((r) => <button key={r.id} className="chip-s" onClick={() => onSel(r.id)}>{r.name} <b className="tx-green">{r.v}</b></button>)}</div>
            ) : list.map((r) => (
              <button key={r.id} className={'sl-r' + (sel === r.id ? ' on' : '')} onClick={() => onSel(r.id)} title={r.full}>
                <span className="sl-n"><b>{r.name}</b><small>{GRPS[r.g]} · {r.unit}</small></span>
                <span className="r"><ValueCell r={r} base={base} /></span>
                <span className="sl-m"><TolBar r={r} />{!r.plat && <span className={'lean-v show tx-' + r.tone}>{r.v}</span>}</span>
                <span className="sl-t"><Dots cells={r.trail} /><TrendG t={r.trend} /></span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- 3. Tiles ---------------- */
function MiniTrail({ cells }: { cells: TrailCell[] }) {
  return <span className="mtrail">{cells.map((c) => <i key={c.q} className={`bg-${c.b}${c.strong ? ' strong' : ''}${c.now ? ' now' : ''}`} title={`${c.q} · ${bLab(c.b)}`} />)}</span>;
}
export function TileGrid({ rows, sel, onSel, base }: { rows: RowModel[]; sel: string | null; onSel: (k: string) => void; base: boolean }) {
  return (
    <div className="tg">
      {GRP_ORDER.map((g) => {
        const sub = rows.filter((r) => r.g === g).sort((a, b) => KORD[a.id] - KORD[b.id]);
        if (!sub.length) return null;
        return (
          <section key={g} className="tg-g">
            <h4>{GRP[g]}</h4>
            <div className="tg-grid">
              {sub.map((r) => (
                <button key={r.id} className={'kt kt-' + r.b + (sel === r.id ? ' on' : '')} onClick={() => onSel(r.id)} title={r.full}>
                  <span className="kt-top">
                    <span className="kt-ic"><Icon n={r.ic} size={13} /></span>
                    <span className="kt-n">{r.name}</span>
                    <span className={'kt-dot bg-' + r.b} title={bLab(r.b)} />
                  </span>
                  {r.plat ? (
                    <span className="kt-split">
                      {r.plat.map((p) => (
                        <span key={p.label}><em>{p.label}</em><b>{p.val}</b>{!r.isCur && <i className={'tx-' + p.tone}>{p.v}</i>}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="kt-v">
                      <b className={r.isCur ? 'tx-' + r.tone : ''}>{r.val}</b>
                      <small>{r.unit}</small>
                    </span>
                  )}
                  <span className="kt-f">
                    {!r.plat && !r.isCur ? <span className={'tx-' + r.tone}><strong>{r.v}</strong> vs {base ? 'base' : 'target'} {r.tgt}</span> : <span className="kt-u">{r.plat ? r.unit : ''}</span>}
                    <MiniTrail cells={r.trail} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
