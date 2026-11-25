export interface ChatTurn { role: 'user' | 'assistant'; content: string }
export interface AskOpts {
  messages: ChatTurn[];
  signal?: AbortSignal;
  onText?: (fullText: string) => void;   
}

let health: Promise<{ agentConfigured: boolean; user?: string | null }> | null = null;
export function agentStatus() {
  if (!health) {
    health = fetch('/api/health')
      .then((r) => (r.ok ? r.json() : { agentConfigured: false }))
      .catch(() => ({ agentConfigured: false }));
  }
  return health;
}

const ROUTING_TAG = /^\s*<name>[\s\S]*<\/name>\s*$/;
const usable = (t: string) => t.trim().length > 20 && !ROUTING_TAG.test(t);
const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : (c as any)?.text || '')).join('');
  return '';
};

const HAS_FILE = /```xlsx/i;
const HAS_TABLE = /\|[^\n]*\n\s*\|?\s*:?-+/;

export function extractAnswer(j: any): string {
  if (Array.isArray(j?.output)) {
    // every usable text message, oldest first (sub-agent results included)
    const texts: string[] = [];
    for (const it of j.output) {
      if (it?.type !== 'message') continue;
      const parts = Array.isArray(it.content) ? it.content : [it.content];
      for (const p of parts) { const t = textOf([p]); if (usable(t)) texts.push(t.trim()); }
    }
    const last = texts[texts.length - 1] || '';
    const tail = j.output[j.output.length - 1];
    const stuck = tail && (tail.type === 'mcp_approval_request' || tail.type === 'function_call');
    // the workbook block may sit in an earlier message than the closing sentence
    if (last && !HAS_FILE.test(last)) {
      const file = [...texts].reverse().find((t) => HAS_FILE.test(t));
      if (file) return `${file}\n\n${last}`;
    }
    // the agent stopped on a tool step it could not finish: show the data its sub-agents returned
    if (stuck && !HAS_FILE.test(last)) {
      const data = texts.filter((t) => HAS_TABLE.test(t) && t !== last);
      const note = '_The agent tried to use a tool this app cannot run, so the answer stopped early. The data it collected is shown above; use the Excel button on a table, or ask again._';
      if (data.length || last) return [...data, last, note].filter(Boolean).join('\n\n');
    }
    if (last) return last;
  }
  const c = j?.choices?.[0]?.message?.content;
  if (c) return textOf(c).trim();
  if (typeof j?.text === 'string') return j.text.trim();
  return '';
}

export async function askAgent(o: AskOpts): Promise<string> {
  const r = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: o.messages }),
    signal: o.signal,
  });
  if (!r.ok) {
    let msg = `The agent request failed (${r.status}).`;
    try { const j = await r.json(); msg = j.error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream') || !r.body) {
    const j = await r.json();
    const text = extractAnswer(j);
    if (!text) throw new Error('The agent replied, but the reply had no answer text.');
    return text;
  }

  const items: Record<string, string> = {};
  const order: string[] = [];
  let chat = '';
  const current = () => {
    for (let i = order.length - 1; i >= 0; i--) if (usable(items[order[i]])) return items[order[i]];
    return chat;
  };
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const data = s.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let ev: any;
      try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === 'response.output_text.delta') {
        const id = ev.item_id || 'main';
        if (!(id in items)) { items[id] = ''; order.push(id); }
        items[id] += ev.delta || '';
      } else if (ev.type === 'response.output_item.done' && ev.item?.type === 'message') {
        const id = ev.item.id || 'main';
        if (!(id in items)) order.push(id);
        items[id] = textOf(ev.item.content) || items[id] || '';
      } else if (ev.choices?.[0]?.delta) {
        chat += textOf(ev.choices[0].delta.content);
      }
      o.onText?.(current());
    }
  }
  return current();
}
