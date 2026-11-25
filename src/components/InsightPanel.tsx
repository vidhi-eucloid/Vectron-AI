import { useEffect, useMemo, useRef, useState } from 'react';
import { PBY } from '../engine/data';
import { periodLabel, scopeLabel } from '../engine/engine';
import { buildBrief, buildDrill, narration } from '../engine/insight';
import { exportPDF, exportPNG, exportPPTX, toDoc } from '../lib/exporters';
import { Icon } from '../lib/icons';
import { speak, stopSpeaking, ttsSupported, useSpeaking } from '../lib/speech';
import { useStore } from '../lib/store';
import { BriefView, DrillView } from './InsightViews';

export function usePlantFocus() {
  const { setCtx, setKpi } = useStore();
  return (id: string) => { setCtx({ plant: id, type: PBY[id].p }); };
}

export function InsightPanel({ onSend, onSubscribe }: { onSend: () => void; onSubscribe: () => void }) {
  const { ctx, kpi, setKpi, lang, setLang, toast } = useStore();
  const focusPlant = usePlantFocus();
  const view = useMemo(() => (kpi ? buildDrill(ctx, kpi) : buildBrief(ctx)), [ctx, kpi]);
  const speaking = useSpeaking();
  const [menu, setMenu] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [kpi, ctx]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const doExport = (kind: 'png' | 'pdf' | 'pptx') => {
    const d = toDoc(view, scopeLabel(ctx), periodLabel(ctx));
    try {
      if (kind === 'png') exportPNG(d); else if (kind === 'pdf') exportPDF(d); else exportPPTX(d);
      toast(kind === 'png' ? 'Image downloaded' : kind === 'pdf' ? 'PDF downloaded' : 'PowerPoint slide downloaded');
    } catch (e: any) { toast('Export failed: ' + e.message); }
  };
  const listen = () => {
    if (speaking) { stopSpeaking(); return; }
    if (!ttsSupported()) { toast('Voice narration is not supported in this browser'); return; }
    speak(narration(ctx, kpi, lang), lang);
  };

  return (
    <section className="panel ins-panel" aria-label="Vectron insights">
      <div className="ins-h">
        <span className="ins-mark"><Icon n="spark" size={14} /></span>
        <div className="ins-title">
          <h2>Vectron Insights</h2>
          <span>{kpi ? 'KPI deep dive' : 'Where to act this period'}</span>
        </div>
        <div className="ins-act">
          <div className="seg seg-glass" role="radiogroup" aria-label="Narration language">
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-checked={lang === 'en'} role="radio">EN</button>
            <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')} aria-checked={lang === 'hi'} role="radio" lang="hi">हिं</button>
          </div>
          <button className={'gbtn' + (speaking ? ' on' : '')} onClick={listen} title={speaking ? 'Stop narration' : 'Listen to this insight'}>
            <Icon n={speaking ? 'stop' : 'speaker'} size={14} /><span>{speaking ? 'Stop' : 'Listen'}</span>
          </button>
          <div className="rel">
            <button className="gbtn" onClick={(e) => { e.stopPropagation(); setMenu(!menu); }} aria-expanded={menu} title="Download this insight">
              <Icon n="export" size={14} /><span>Export</span>
            </button>
            {menu && (
              <div className="menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setMenu(false); doExport('png'); }}><Icon n="image" size={14} />Image (PNG)</button>
                <button onClick={() => { setMenu(false); doExport('pdf'); }}><Icon n="pdf" size={14} />PDF one-pager</button>
                <button onClick={() => { setMenu(false); doExport('pptx'); }}><Icon n="slide" size={14} />PowerPoint slide</button>
              </div>
            )}
          </div>
          <button className="gbtn icon-only" onClick={onSend} title="Email this insight" aria-label="Email this insight"><Icon n="mail" size={14} /></button>
          <button className="gbtn icon-only" onClick={onSubscribe} title="Subscribe to the audio bulletin" aria-label="Subscribe"><Icon n="sub" size={14} /></button>
        </div>
      </div>
      <div className="ins-body scroll" ref={body}>
        {view.kind === 'brief'
          ? <BriefView b={view} onKpi={setKpi} onPlant={focusPlant} />
          : <DrillView d={view} onBack={() => setKpi(null)} onKpi={setKpi} onPlant={focusPlant} />}
      </div>
    </section>
  );
}
