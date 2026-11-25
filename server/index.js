// Vectron cockpit API server.
// - Proxies chat questions to the Databricks supervisor agent so the token never reaches the browser.
// - Serves the built React app from /dist in production (Databricks Apps or any Node host).
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// chat turns can carry the full text of an attached spreadsheet, so allow a larger body
app.use(express.json({ limit: '25mb' }));
app.use((err, _req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The attached sheet is too large to send. Attach a smaller extract.' });
  next(err);
});

const ENDPOINT = process.env.DATABRICKS_ENDPOINT_URL || '';
const PAYLOAD = (process.env.AGENT_PAYLOAD || 'responses').toLowerCase();
const STREAM = String(process.env.AGENT_STREAM ?? 'false') === 'true';
// Off by default: the question goes to the agent exactly as typed, like the team's Genie app.
const ADD_CONTEXT = String(process.env.AGENT_CONTEXT ?? 'false') === 'true';
const TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT || 120) * 1000;
const PORT = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 8787);
// log question / attachment / answer previews so sessions can be reviewed in the app logs
const LOG_CONTENT = String(process.env.AGENT_LOG_CONTENT ?? 'true') === 'true';

/* ---------- Excel replies ----------
   The supervisor cannot attach files, and its sandbox tool needs an approval this app does not
   handle. So when the user asks for a file, the latest question carries a format rule: reply with
   a ```xlsx JSON block, which the browser turns into a real .xlsx download. */
// bare "sheet" is left out on purpose so finance questions like "balance sheet" are not affected
const FILE_INTENT = /\b(xlsx|xls|excel|spread\s?sheet|workbook|csv|download(able)?)\b/i;
const XLSX_HINT = `

[Output format for files] The user wants a downloadable Excel file. You cannot create or attach files, and you must NOT use the sandbox or any code tool to build one. Instead, after a short explanation, output exactly one fenced code block with the language tag xlsx containing JSON in this shape:
\`\`\`xlsx
{"filename": "name.xlsx", "sheets": [{"name": "Sheet1", "rows": [["Header A", "Header B"], ["text", 123.45]]}]}
\`\`\`
Rules: the first row of each sheet is the header; numbers are plain JSON numbers (no thousands separators, currency or units); dates are "YYYY-MM-DD"; sheet names are at most 31 characters; include every row the user asked for and never truncate with "...". If the user attached a spreadsheet and wants it updated or combined, include its original sheet(s) with all rows plus the new or changed data (as extra columns or a separate sheet). The app turns this block into the .xlsx download, so do not say you cannot create files.`;
const SANDBOX_RETRY = '\n\nYour previous attempt tried to use the sandbox/code tool, which is not available in this app. Do not call it. Return the data in the xlsx block now.';

const textOfItem = (it) => (Array.isArray(it?.content) ? it.content.map((c) => (typeof c === 'string' ? c : c?.text || '')).join('') : typeof it?.content === 'string' ? it.content : '');
const replyHasFile = (j) => Array.isArray(j?.output) && j.output.some((it) => it?.type === 'message' && /```xlsx/i.test(textOfItem(it)));
const replyStuck = (j) => {
  const out = Array.isArray(j?.output) ? j.output : [];
  return out.some((it) => it?.type === 'mcp_approval_request') || ['function_call', 'mcp_approval_request'].includes(out[out.length - 1]?.type);
};
function wantsFile(turns) {
  const last = turns[turns.length - 1]?.content || '';
  // only the typed question, not the attached CSV (which always contains the word "sheet")
  const typed = last.split('\n\nUse the data from the attached spreadsheet')[0];
  if (FILE_INTENT.test(typed)) return true;
  // follow-ups such as "go ahead" right after the agent offered an Excel file
  const prev = [...turns].reverse().find((t) => t.role === 'assistant')?.content || '';
  return /\b(xlsx|excel)\b/i.test(prev) && /\b(go ahead|yes|ok(ay)?|sure|do it|give|send|link|proceed)\b/i.test(typed);
}
const preview = (s, n) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

/* ---------- auth: PAT, or OAuth M2M with the app's service principal ---------- */
let cached = { token: '', exp: 0 };
async function getToken() {
  if (process.env.DATABRICKS_TOKEN) return process.env.DATABRICKS_TOKEN;
  const id = process.env.DATABRICKS_CLIENT_ID, secret = process.env.DATABRICKS_CLIENT_SECRET;
  let host = process.env.DATABRICKS_HOST || (ENDPOINT ? new URL(ENDPOINT).origin : '');
  if (!id || !secret || !host) return '';
  if (!host.startsWith('http')) host = 'https://' + host;
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const r = await fetch(host.replace(/\/$/, '') + '/oidc/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
    },
    body: 'grant_type=client_credentials&scope=all-apis',
  });
  if (!r.ok) throw new Error('OAuth token request failed (' + r.status + ')');
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}
const configured = () =>
  !!ENDPOINT && !!(process.env.DATABRICKS_TOKEN || (process.env.DATABRICKS_CLIENT_ID && process.env.DATABRICKS_CLIENT_SECRET));

app.get('/api/health', (req, res) => {
  // user: the signed-in email Databricks Apps adds to each request (none when running locally).
  // The browser uses it to keep each person's saved chat history separate on a shared browser.
  res.json({ ok: true, agentConfigured: configured(), payload: PAYLOAD, stream: STREAM, user: req.get('x-forwarded-email') || null });
});

/* ---------- agent proxy ----------
   Body from the browser: { messages: [{role:'user'|'assistant', content:string}], context?: string }
   Sent to Databricks:    { input: [{role, content}, ...] }   (or { messages } if AGENT_PAYLOAD=chat)
   With AGENT_CONTEXT=true the dashboard filters are prefixed to the latest question. */
app.post('/api/agent', async (req, res) => {
  if (!configured()) return res.status(503).json({ error: 'Agent endpoint is not configured on the server. Set DATABRICKS_ENDPOINT_URL and DATABRICKS_TOKEN.' });
  const msgs = Array.isArray(req.body?.messages) ? req.body.messages.slice(-8) : [];
  if (!msgs.length) return res.status(400).json({ error: 'No question was sent.' });
  const ctx = typeof req.body?.context === 'string' ? req.body.context.trim() : '';
  const turns = msgs.map((m, i) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: ADD_CONTEXT && i === msgs.length - 1 && ctx ? `[Dashboard context: ${ctx}]\n\n${m.content}` : String(m.content || ''),
  }));
  const fileAsk = wantsFile(turns);
  if (fileAsk) turns[turns.length - 1] = { ...turns[turns.length - 1], content: turns[turns.length - 1].content + XLSX_HINT };
  const body = PAYLOAD === 'chat' ? { messages: turns } : { input: turns };
  if (STREAM) body.stream = true;
  if (LOG_CONTENT) {
    const q = msgs[msgs.length - 1]?.content || '';
    const att = /attached spreadsheet "([^"]+)"/.exec(q)?.[1];
    console.log(`[agent] Q: ${preview(q.split('\n\nUse the data from the attached spreadsheet')[0], 400)}${att ? ` | file: ${att} (${q.length} chars)` : ''}${fileAsk ? ' | xlsx requested' : ''}`);
  }

  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, TIMEOUT_MS);
  // the browser closed the connection (user pressed Stop) — stop paying for the agent call
  res.on('close', () => { if (!res.writableFinished) ctrl.abort(); });
  const t0 = Date.now();
  try {
    const token = await getToken();
    const call = (b) => fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(b),
      signal: ctrl.signal,
    });
    const up = await call(body);
    if (!up.ok) {
      const txt = await up.text();
      // the sheet plus history did not fit the model's context window
      if (/context.{0,20}(length|window|limit)|too many tokens|maximum.{0,20}tokens|prompt is too long/i.test(txt))
        return res.status(413).json({ error: 'The attached sheet is too large for the model to read. Attach a smaller extract or start a new conversation.', detail: txt.slice(0, 2000) });
      return res.status(up.status).json({ error: `Agent returned ${up.status}`, detail: txt.slice(0, 2000) });
    }
    const ct = up.headers.get('content-type') || '';
    if (ct.includes('text/event-stream') && up.body) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      const reader = up.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      console.log(`[agent] streamed in ${Date.now() - t0} ms`);
      return res.end();
    }
    let json = await up.json();
    // the agent went for its sandbox tool instead of the xlsx block: ask once more without it
    if (fileAsk && PAYLOAD !== 'chat' && replyStuck(json) && !replyHasFile(json)) {
      console.log(`[agent] reply stopped on a tool step after ${Date.now() - t0} ms; retrying with xlsx-only instruction`);
      const retry = { ...body, input: turns.map((t, i) => (i === turns.length - 1 ? { ...t, content: t.content + SANDBOX_RETRY } : t)) };
      const up2 = await call(retry);
      if (up2.ok) { const j2 = await up2.json(); if (replyHasFile(j2) || !replyStuck(j2)) json = j2; }
    }
    console.log(`[agent] answered in ${Date.now() - t0} ms${fileAsk ? ` | xlsx block: ${replyHasFile(json) ? 'yes' : 'no'}` : ''}`);
    if (LOG_CONTENT && Array.isArray(json?.output)) {
      const msgsOut = json.output.filter((it) => it?.type === 'message').map(textOfItem).filter((t) => t.trim().length > 20 && !/^\s*<name>/.test(t));
      console.log(`[agent] A: ${preview(msgsOut[msgsOut.length - 1], 600)} | items: ${json.output.map((it) => it?.type === 'function_call' ? `call:${it.name}` : it?.type).join(',')}`);
    }
    res.json(json);
  } catch (e) {
    if (!res.headersSent) res.status(timedOut ? 504 : 502).json({ error: timedOut ? `The agent did not answer within ${TIMEOUT_MS / 1000}s.` : String(e?.message || e) });
    else res.end();
  } finally {
    clearTimeout(timer);
  }
});

/* ---------- static app ---------- */
const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res, next) => res.sendFile(path.join(dist, 'index.html'), (err) => err && next()));

app.listen(PORT, () => console.log(`Vectron API on :${PORT} · agent ${configured() ? 'configured' : 'NOT configured (mock answers in UI)'}`));
