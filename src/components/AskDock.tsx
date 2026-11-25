/* Ask Vectron — a plain chat with the Databricks supervisor agent.
   Answers render as text, tables, and a chart toggle when a table has numbers. */
import { useEffect, useRef, useState } from 'react';
import { agentStatus, askAgent, type ChatTurn } from '../api/agent';
import { periodLabel, scopeLabel } from '../engine/engine';
import { previewAnswer } from '../engine/preview';
import { Icon } from '../lib/icons';
import { ACCEPT, EXCEL_ASK, readSpreadsheet, withAttachment, type Attachment } from '../lib/excel';
import { deleteChats, listChats, loadChat, newChatId, pruneOld, renameChat, saveChat, type ChatMeta } from '../lib/history';
import { dictate, speak, stopSpeaking, useSpeaking } from '../lib/speech';
import { useStore } from '../lib/store';
import { Answer } from './Answer';
import { HistoryPanel } from './HistoryPanel';

/* Starter questions — taken from the team's Genie app. Edit freely. */
export const SUGGESTIONS = [
  { ic: 'pkg', q: 'What is the COGS trend for FY26?' },
  { ic: 'stack', q: 'Compare plant-wise production output' },
  { ic: 'plug', q: 'Power rate vs budget for Unit-1' },
  { ic: 'rupee', q: 'OPEx budget vs actual for FY26 YTD' },
];

type Msg =
  | { id: number; role: 'user'; text: string; content: string; file?: Attachment; excel?: boolean }
  // source: the latest file attached in this conversation, used to build Excel downloads on top of it
  | { id: number; role: 'assistant'; text: string; q: string; file?: Attachment; source?: Attachment; excel?: boolean; pending: boolean; started: number; error?: string; ms?: number; preview?: boolean };
let uid = 1;

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const plainText = (t: string) => t.replace(/```xlsx[\s\S]*?(```|$)/gi, ' An Excel file is attached. ').replace(/\|[^\n]*\n?/g, ' ').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();

function Mark({ size = 28 }: { size?: number }) {
  return <span className="vx-mark" style={{ width: size, height: size }}><Icon n="spark" size={Math.round(size * 0.5)} sw={2.1} /></span>;
}

function Thinking({ since }: { since: number }) {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS(Math.floor((performance.now() - since) / 1000)), 500); return () => clearInterval(t); }, [since]);
  return <div className="vx-thinking" aria-live="polite"><span className="vx-shimmer">Thinking</span>{s >= 2 && <span className="vx-secs">{s}s</span>}</div>;
}

export function AskDock({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const { ctx, lang, setLang, toast } = useStore();
  const [max, setMax] = useState(false);
  const [menu, setMenu] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [live, setLive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const stopMic = useRef<(() => void) | null>(null);
  const abort = useRef<AbortController | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [asExcel, setAsExcel] = useState(false);
  // question history, saved in this browser (lib/history.ts)
  const [user, setUser] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [histOpen, setHistOpen] = useState(false);
  const [histErr, setHistErr] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const loaded = useRef<Msg[] | null>(null); // msgs just loaded from history: not re-saved until something changes
  // full view opens with the history sidebar showing; the small window keeps it closed so the chat stays visible
  useEffect(() => { setHistOpen(max); }, [max]);
  const speaking = useSpeaking();

  useEffect(() => {
    agentStatus().then((s) => {
      setLive(!!s.agentConfigured);
      // the server passes on the signed-in email from Databricks Apps; locally there is none
      setUser(String(s.user || 'local').toLowerCase());
    });
  }, []);

  const refreshHistory = async (u = user) => {
    if (!u) return;
    try { setChats(await listChats(u)); setHistErr(null); }
    catch (e: any) { setHistErr(e?.message || 'Chat history is not available in this browser.'); }
  };
  // on start: remove chats older than the keep period, then load this user's list
  useEffect(() => {
    if (!user) return;
    pruneOld().catch(() => {}).finally(() => refreshHistory(user));
  }, [user]);

  // save the open chat after each answer (never while an answer is still coming in)
  useEffect(() => {
    const id = chatIdRef.current;
    if (!user || !id || !msgs.length || msgs === loaded.current || msgs.some((m) => m.role === 'assistant' && m.pending)) return;
    const t = setTimeout(() => {
      const users = msgs.filter((m): m is Extract<Msg, { role: 'user' }> => m.role === 'user');
      const now = Date.now();
      saveChat({ id, user, title: (users[0]?.text || 'New chat').replace(/\s+/g, ' ').slice(0, 80), createdAt: now, updatedAt: now, questions: users.length, hasFile: users.some((m) => !!m.file) }, msgs)
        .then(() => refreshHistory())
        .catch((e) => setHistErr(e?.message || 'This chat could not be saved in the browser.'));
    }, 250);
    return () => clearTimeout(t);
  }, [msgs, user]);
  useEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight, behavior: 'smooth' }); }, [msgs]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 220); }, [open]);
  useEffect(() => { if (!speaking) setSpeakingId(null); }, [speaking]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) { if (menu) setMenu(false); else if (histOpen && !max) setHistOpen(false); else setOpen(false); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(!open); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, setOpen, menu, histOpen, max]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const patch = (id: number, p: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === id ? ({ ...x, ...p } as Msg) : x)));

  async function attach(file?: File | null) {
    if (!file) return;
    setReading(true);
    try {
      setAttachment(await readSpreadsheet(file));
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e: any) {
      toast(e?.message || 'Could not read that file');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function ask(raw: string, file: Attachment | null = attachment, excel = asExcel) {
    const q = raw.trim() || (file ? (excel ? 'Give me this file back as Excel.' : 'Summarize the key points in the attached file.') : '');
    if (!q || busy || reading) return;
    setInput('');
    setAttachment(null);
    setAsExcel(false);
    const source = file || [...msgs].reverse().find((m) => m.role === 'user' && m.file)?.file;
    if (!chatIdRef.current) { chatIdRef.current = newChatId(); setChatId(chatIdRef.current); }
    // the file text stays in the user turn it was sent with, so follow-up questions still have it
    const history: ChatTurn[] = msgs
      .filter((m) => m.role === 'user' || (!m.error && !m.pending && !m.preview))
      .map((m) => ({ role: m.role, content: m.role === 'user' ? m.content : m.text }));
    // the Excel request goes in the typed part, before the attached sheet, so the server spots it
    const typed = excel ? q + EXCEL_ASK : q;
    const content = file ? withAttachment(typed, file) : typed;
    const started = performance.now();
    const a: Msg = { id: uid++, role: 'assistant', text: '', q, file: file || undefined, source: source || undefined, excel, pending: true, started };
    setMsgs((m) => [...m, { id: uid++, role: 'user', text: q, content, file: file || undefined, excel }, a]);
    setBusy(true);

    if (!live) {
      await new Promise((r) => setTimeout(r, 600));
      patch(a.id, { text: previewAnswer(ctx, q), pending: false, preview: true } as Partial<Msg>);
      setBusy(false);
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const text = await askAgent({
        messages: [...history, { role: 'user', content }], signal: ctrl.signal,
        onText: (t) => patch(a.id, { text: t } as Partial<Msg>),
      });
      patch(a.id, { text, pending: false, ms: performance.now() - started } as Partial<Msg>);
    } catch (e: any) {
      patch(a.id, { pending: false, error: e?.name === 'AbortError' ? 'You stopped this answer.' : e?.message || 'The agent could not answer.' } as Partial<Msg>);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  const newChat = () => { abort.current?.abort(); chatIdRef.current = null; setChatId(null); loaded.current = null; setMsgs([]); setAttachment(null); setAsExcel(false); stopSpeaking(); setTimeout(() => inputRef.current?.focus(), 50); };
  async function openChat(id: string) {
    if (busy) return;
    if (id === chatIdRef.current) { if (!max) setHistOpen(false); return; }
    try {
      const saved = await loadChat<Msg>(id);
      if (!saved) { toast('That chat is no longer saved'); refreshHistory(); return; }
      const restored = saved.map((m) => (m.role === 'assistant' && m.pending ? { ...m, pending: false, error: m.error || 'This answer did not finish.' } : m)) as Msg[];
      uid = Math.max(uid, ...restored.map((m) => m.id)) + 1;
      stopSpeaking();
      chatIdRef.current = id; setChatId(id);
      loaded.current = restored;
      setMsgs(restored); setAttachment(null); setAsExcel(false); setInput('');
      if (!max) setHistOpen(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e: any) { toast(e?.message || 'That chat could not be opened'); }
  }
  async function removeChats(ids: string[]) {
    try {
      await deleteChats(ids);
      if (chatIdRef.current && ids.includes(chatIdRef.current)) newChat();
      refreshHistory();
    } catch (e: any) { toast(e?.message || 'Could not delete'); }
  }
  async function rename(id: string, title: string) {
    try { await renameChat(id, title); refreshHistory(); } catch (e: any) { toast(e?.message || 'Could not rename'); }
  }

  const readAloud = (m: Msg) => {
    if (speakingId === m.id) { stopSpeaking(); return; }
    if (speak(plainText(m.text), lang)) setSpeakingId(m.id); else toast('Read-aloud is not supported in this browser');
  };
  const copy = (m: Msg) => { navigator.clipboard?.writeText(m.text); toast('Answer copied'); };
  const mic = () => {
    if (listening) { stopMic.current?.(); return; }
    const stop = dictate(lang, (t) => setInput(t), () => { setListening(false); stopMic.current = null; });
    if (!stop) { toast('Voice input is not supported in this browser'); return; }
    stopMic.current = stop;
    setListening(true);
  };
  const status = live === null ? 'Connecting' : live ? 'Connected' : 'Preview mode';

  return (
    <>
      <button className={'vx-launch' + (open ? ' hidden' : '')} onClick={() => setOpen(true)} aria-label="Ask Vectron (Ctrl+K)">
        <Mark size={26} />
        <span>Ask Vectron</span>
        <kbd>Ctrl K</kbd>
      </button>
      {max && open && <div className="vx-scrim" onClick={() => setMax(false)} />}

      <section className={'vx' + (open ? ' open' : '') + (max ? ' max' : '')} role="dialog" aria-label="Ask Vectron" aria-hidden={!open}>
        <header className="vx-h">
          <Mark />
          <div className="vx-title">
            <h3>Vectron Assistant</h3>
            <p><i className={'vx-dot ' + (live ? 'on' : live === false ? 'off' : '')} />{status}<span className="vx-sep" />{scopeLabel(ctx)}<span className="vx-per"> · {periodLabel(ctx)}</span></p>
          </div>
          <div className="vx-actions">
            <button className={'vx-ib' + (histOpen ? ' on' : '')} onClick={() => { if (!histOpen) refreshHistory(); setHistOpen(!histOpen); }} title="Chat history" aria-label="Chat history" aria-expanded={histOpen}><Icon n="history" size={16} /></button>
            <button className="vx-ib" onClick={newChat} disabled={!msgs.length} title="New conversation" aria-label="New conversation"><Icon n="plus" size={16} /></button>
            <div className="rel">
              <button className={'vx-ib' + (menu ? ' on' : '')} onClick={(e) => { e.stopPropagation(); setMenu(!menu); }} title="Settings" aria-label="Settings" aria-expanded={menu}>
                <Icon n="gear" size={15} />
              </button>
              {menu && (
                <div className="vx-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="vx-menu-h">Read answers aloud in</div>
                  {(['en', 'hi'] as const).map((l) => (
                    <button key={l} className={lang === l ? 'on' : ''} onClick={() => { setLang(l); setMenu(false); }}>
                      <span lang={l}>{l === 'en' ? 'English' : 'हिंदी'}</span>{lang === l && <Icon n="check" size={14} />}
                    </button>
                  ))}
                  <div className="vx-menu-sep" />
                  <div className="vx-menu-note">{live ? 'Answers come from the Databricks supervisor agent.' : 'The agent isn\'t connected, so answers use the dashboard\'s sample data.'}</div>
                </div>
              )}
            </div>
            <button className="vx-ib" onClick={() => setMax(!max)} title={max ? 'Exit full view' : 'Full view'} aria-label={max ? 'Exit full view' : 'Full view'}><Icon n={max ? 'min' : 'max'} size={15} /></button>
            <button className="vx-ib" onClick={() => setOpen(false)} title="Close (Esc)" aria-label="Close"><Icon n="close" size={16} /></button>
          </div>
        </header>

        <div className={'vx-wrap' + (histOpen ? ' hist' : '')}>
        {histOpen && (
          <HistoryPanel chats={chats} current={chatId} disabled={busy} error={histErr}
            onOpen={openChat} onNew={() => { newChat(); if (!max) setHistOpen(false); }}
            onRename={rename} onDelete={(id) => removeChats([id])} onClearAll={() => removeChats(chats.map((c) => c.id))}
            onClose={() => setHistOpen(false)} />
        )}
        <div className="vx-main">
        <div className="vx-body scroll" ref={body}>
          {msgs.length === 0 ? (
            <div className="vx-empty">
              {/* <Mark size={40} /> */}
              <h4>{greeting()}</h4>
              <p>Ask about cost, output, yield, utilities or supply chain. Answers come back as text, tables or charts.</p>
              <div className="vx-sugg">
                {SUGGESTIONS.map((s) => (
                  <button key={s.q} onClick={() => ask(s.q)}>
                    <Icon n={s.ic} size={15} />
                    <span>{s.q}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="vx-thread">
              {msgs.map((m) => m.role === 'user' ? (
                <div key={m.id} className="vx-u">
                  {m.file && <span className="vx-file sent" title={m.file.name}><Icon n="sheet" size={14} /><b>{m.file.name}</b><em>{m.file.summary}</em></span>}
                  <p>{m.text}</p>
                  {m.excel && <span className="vx-xltag"><Icon n="sheet" size={12} />Excel file requested</span>}
                </div>
              ) : (
                <article key={m.id} className="vx-a">
                  <Mark size={24} />
                  <div className="vx-a-body">
                    {m.pending && !m.text && <Thinking since={m.started} />}
                    {m.text && <Answer text={m.text} question={m.q} source={m.source} />}
                    {m.error && (
                      <div className="vx-err">
                        <Icon n="info" size={14} /><span>{m.error}</span>
                        <button onClick={() => ask(m.q, m.file || null, !!m.excel)}>Retry</button>
                      </div>
                    )}
                    {!m.pending && m.text && (
                      <div className="vx-meta">
                        <button onClick={() => copy(m)} title="Copy answer"><Icon n="copy" size={13} />Copy</button>
                        <button onClick={() => readAloud(m)} title="Read aloud"><Icon n={speakingId === m.id ? 'stop' : 'speaker'} size={13} />{speakingId === m.id ? 'Stop' : 'Listen'}</button>
                        {m.ms != null && <span>{(m.ms / 1000).toFixed(1)}s</span>}
                        {m.preview && <span className="vx-tag">Sample data</span>}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="vx-f">
          {msgs.length > 0 && (
            <div className="vx-chips" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map((s) => (
                <button key={s.q} type="button" onClick={() => ask(s.q)} disabled={busy} title={s.q}>
                  <Icon n={s.ic} size={13} /><span>{s.q}</span>
                </button>
              ))}
            </div>
          )}
          <form className={'vx-comp' + (listening ? ' rec' : '') + (dragOver ? ' drop' : '')} onSubmit={(e) => { e.preventDefault(); ask(input); }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              if (e.dataTransfer.files.length > 1) { toast('Attach one file at a time'); return; }
              attach(e.dataTransfer.files?.[0]);
            }}>
            {/* one file per question: attaching again replaces it */}
            {(attachment || reading) && (
              <div className="vx-file">
                <Icon n="sheet" size={14} />
                {reading ? <b>Reading file…</b> : <><b title={attachment!.name}>{attachment!.name}</b><em>{attachment!.summary}</em></>}
                {attachment && <button type="button" onClick={() => setAttachment(null)} title="Remove file" aria-label="Remove file"><Icon n="close" size={12} /></button>}
              </div>
            )}
            <textarea ref={inputRef} rows={1} value={input} placeholder={listening ? 'Listening…' : asExcel ? 'What should the Excel file contain?' : attachment ? 'Ask about this file' : 'Ask about plant performance'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }} aria-label="Your question" />
            <div className="vx-comp-r">
              <button type="button" className={'vx-xl' + (asExcel ? ' on' : '')} onClick={() => setAsExcel(!asExcel)} aria-pressed={asExcel}
                title={asExcel ? 'The answer will come back as an Excel file' : 'Get the answer back as an Excel file'}>
                <Icon n="sheet" size={14} />Excel
              </button>
              <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => attach(e.target.files?.[0])} />
              <button type="button" className="vx-mic" onClick={() => fileRef.current?.click()} disabled={reading || busy} title="Attach Excel or CSV" aria-label="Attach Excel or CSV">
                <Icon n="attach" size={16} />
              </button>
              <button type="button" className={'vx-mic' + (listening ? ' on' : '')} onClick={mic} title={listening ? 'Stop dictation' : 'Dictate'} aria-label={listening ? 'Stop dictation' : 'Dictate'}>
                <Icon n="mic" size={16} />
              </button>
              {busy && live
                ? <button type="button" className="vx-send stop" onClick={() => abort.current?.abort()} title="Stop" aria-label="Stop"><Icon n="stop" size={12} /></button>
                : <button type="submit" className="vx-send" disabled={(!input.trim() && !attachment) || busy || reading} title="Send" aria-label="Send"><Icon n="arrowUp" size={16} sw={2.4} /></button>}
            </div>
          </form>
          <p className="vx-disc">AI-generated answers can be wrong. Check key figures before sharing.</p>
        </footer>
        </div>
        </div>
      </section>
    </>
  );
}