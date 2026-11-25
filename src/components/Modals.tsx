import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { az, cz, HIK, HIM, HIP, hiNum } from '../engine/content';
import { KPIS, PLANTS } from '../engine/data';
import { band, fmtU, headline, periodLabel, RANK, scopeLabel, vari } from '../engine/engine';
import { buildBrief, buildDrill } from '../engine/insight';
import { docText, dl, pdfBlob, toDoc } from '../lib/exporters';
import { Icon } from '../lib/icons';
import { speak, stopSpeaking, useSpeaking } from '../lib/speech';
import { useStore } from '../lib/store';

function Modal({ open, onClose, icon, title, sub, children, foot }: { open: boolean; onClose: () => void; icon: string; title: string; sub: string; children: ReactNode; foot: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <span className="modal-ic"><Icon n={icon} size={16} /></span>
          <div><h3>{title}</h3><p>{sub}</p></div>
          <button className="xbtn" onClick={onClose} aria-label="Close"><Icon n="close" size={15} /></button>
        </div>
        <div className="modal-b">{children}</div>
        <div className="modal-f">{foot}</div>
      </div>
    </div>
  );
}
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function SendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ctx, kpi, toast } = useStore();
  const [to, setTo] = useState(''), [note, setNote] = useState('');
  const send = () => {
    if (!emailOk(to)) { toast('Enter a valid email address'); return; }
    const view = kpi ? buildDrill(ctx, kpi) : buildBrief(ctx);
    const d = toDoc(view, scopeLabel(ctx), periodLabel(ctx));
    dl(pdfBlob(d), 'vectron-insight.pdf');
    const subj = `Vectron AI | ${d.title} - ${d.scope} - ${d.period}`;
    const body = (note ? note + '\n\n' : '') + docText(d);
    onClose();
    toast(`Outlook draft opened for ${to}. Attach the downloaded PDF.`);
    setTimeout(() => { window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body.slice(0, 1700))}`; }, 250);
  };
  return (
    <Modal open={open} onClose={onClose} icon="mail" title="Email this insight" sub="Opens an Outlook draft with the summary"
      foot={<><span className="modal-note">The PDF one-pager downloads too, ready to attach.</span><button className="btn p" onClick={send}>Open in Outlook</button></>}>
      <label className="fld"><span>Recipient</span><input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@mankindpharma.com" autoFocus /></label>
      <label className="fld"><span>Note (optional)</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sharing this week's view…" /></label>
    </Modal>
  );
}

type SubLang = 'en' | 'hi' | 'both';
export function SubscribeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ctx, lang, toast } = useStore();
  const [email, setEmail] = useState('');
  const [scope, setScope] = useState('all');
  const [sl, setSl] = useState<SubLang>(lang);
  const [freq, setFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [picked, setPicked] = useState<string[]>(KPIS.map((k) => k.id));
  const speaking = useSpeaking();
  useEffect(() => { if (open) setSl(lang); else stopSpeaking(); }, [open, lang]);

  const ps = useMemo(() => scope === 'all' ? PLANTS : scope === 'formulation' || scope === 'api' ? PLANTS.filter((p) => p.p === scope) : PLANTS.filter((p) => p.id === scope), [scope]);
  const sName = scope === 'all' ? 'the network' : scope === 'formulation' ? 'the Formulation plants' : scope === 'api' ? 'the API plants' : PLANTS.find((p) => p.id === scope)!.n;
  const sNameHi = scope === 'all' ? 'पूरे नेटवर्क' : scope === 'formulation' ? 'फॉर्मुलेशन प्लांट्स' : scope === 'api' ? 'ए पी आई प्लांट्स' : HIP[scope];

  function script(l: 'en' | 'hi') {
    const ks = KPIS.filter((k) => picked.includes(k.id));
    if (!ks.length) return null;
    const rs = ks.map((K) => { const h = headline(ctx, K.id, ps); return { k: K, a: h.a, t: h.t, plat: h.plat, b: band(K.id, h.a, h.t), v: vari(K.id, h.a, h.t) }; });
    const flag = rs.filter((r) => r.b !== 'green').sort((a, b) => RANK[a.b] - RANK[b.b] || Math.abs(b.v.raw) - Math.abs(a.v.raw));
    const good = rs.length - flag.length;
    if (l === 'hi') {
      const ph = { daily: 'रोज़ाना', weekly: 'साप्ताहिक', monthly: 'मासिक' }[freq];
      let t = `नमस्ते। यह आपकी ${ph} वेक्ट्रॉन ब्रीफिंग है, ${sNameHi} के लिए, ${ks.length} के पी आई पर, ${HIM[ctx.m0]} से ${HIM[ctx.m1]}। ${ks.length} में से ${good} के पी आई प्लान पर हैं। `;
      if (!flag.length) return t + 'कुछ भी एस्केलेट करने लायक नहीं है।';
      const w = flag[0];
      return t + `सबसे पहले ध्यान ${HIK[w.k.id] || w.k.s} पर चाहिए, जो ${hiNum(w.v.txt)} है। वजह। ${cz(w.k.id)} सुझाई गई कार्रवाई। ${az(w.k.id)}`;
    }
    let e = `Welcome to your ${freq} Vectron briefing for ${sName}, covering ${ks.length} KPIs, ${periodLabel(ctx)}. ${good} of ${ks.length} KPIs are on plan. `;
    if (!flag.length) return e + 'Nothing in your selection needs escalation this period.';
    const w = flag[0];
    e += `${w.k.n} needs attention first, at ${fmtU(w.k.id, w.a, w.plat)} against ${fmtU(w.k.id, w.t, w.plat)}, a variance of ${w.v.txt}. The reason. ${cz(w.k.id)} `;
    if (flag.length > 1) e += `Also outside tolerance: ${flag.slice(1, 3).map((r) => `${r.k.s} at ${r.v.txt}`).join(', ')}. `;
    return e + 'Recommended actions. ' + flag.slice(0, 3).map((r, i) => `Number ${i + 1}. ${az(r.k.id)}`).join(' ');
  }
  const play = () => {
    if (speaking) { stopSpeaking(); return; }
    const first = sl === 'both' ? 'en' : sl, t = script(first);
    if (!t) { toast('Select at least one KPI'); return; }
    if (sl === 'both') speak(t, 'en', () => { const h = script('hi'); if (h) speak(h, 'hi'); });
    else speak(t, first);
  };
  const download = () => {
    const t = sl === 'both' ? `${script('en')}\n\n${'='.repeat(45)}\n\n${script('hi')}` : script(sl);
    if (!t || t.startsWith('null')) { toast('Select at least one KPI'); return; }
    const head = `VECTRON AI - ${freq.toUpperCase()} BRIEFING\nScope: ${sName}\nPeriod: ${periodLabel(ctx)}\nLanguage: ${sl}\nKPIs: ${picked.length}\nGenerated: ${new Date().toLocaleString('en-IN')}\n\n${'='.repeat(45)}\n\n`;
    dl(new Blob(['﻿' + head + t.replace(/\. /g, '.\n\n').replace(/। /g, '।\n\n')], { type: 'text/plain;charset=utf-8' }), `vectron-briefing-${sl}.txt`);
    toast('Briefing script downloaded');
  };
  const subscribe = () => {
    if (!emailOk(email)) { toast('Enter a valid email address'); return; }
    if (!picked.length) { toast('Select at least one KPI'); return; }
    onClose();
    toast(`Subscribed: ${freq} ${sl === 'both' ? 'English + Hindi' : sl === 'hi' ? 'Hindi' : 'English'} briefing on ${picked.length} KPIs to ${email}`);
  };
  const Seg = <T extends string>({ v, set, opts }: { v: T; set: (x: T) => void; opts: [T, string][] }) => (
    <div className="seg seg-light">{opts.map(([k, l]) => <button key={k} className={v === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}</div>
  );

  return (
    <Modal open={open} onClose={onClose} icon="sub" title="Subscribe to the performance bulletin" sub="A short audio briefing on the KPIs you choose"
      foot={<>
        <button className="btn s" onClick={play}><Icon n={speaking ? 'stop' : 'speaker'} size={14} />{speaking ? 'Stop' : 'Play sample'}</button>
        <button className="btn s" onClick={download}><Icon n="doc" size={14} />Download script</button>
        <button className="btn p" onClick={subscribe}>Subscribe</button>
      </>}>
      <label className="fld"><span>Delivery email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mankindpharma.com" /></label>
      <label className="fld"><span>Plants</span>
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">All plants</option><option value="formulation">All Formulation</option><option value="api">All API</option>
          {PLANTS.map((p) => <option key={p.id} value={p.id}>{p.n}</option>)}
        </select>
      </label>
      <div className="fld-row">
        <div className="fld"><span>Language</span><Seg v={sl} set={setSl} opts={[['en', 'English'], ['hi', 'हिंदी'], ['both', 'Both']]} /></div>
        <div className="fld"><span>How often</span><Seg v={freq} set={setFreq} opts={[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]} /></div>
      </div>
      <div className="fld">
        <span>KPIs <em>{picked.length} of {KPIS.length}</em>
          <button className="linkb" onClick={() => setPicked(picked.length === KPIS.length ? [] : KPIS.map((k) => k.id))}>{picked.length === KPIS.length ? 'Clear all' : 'Select all'}</button>
        </span>
        <div className="kpick">
          {KPIS.map((k) => (
            <label key={k.id} className="kck">
              <input type="checkbox" checked={picked.includes(k.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, k.id] : picked.filter((x) => x !== k.id))} />
              {k.s}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
