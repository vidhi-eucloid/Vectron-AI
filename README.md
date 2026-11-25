# Vectron AI — Manufacturing Performance Cockpit (React)

React + TypeScript rebuild of `vectron-cockpit-v14.7.html`, with a refreshed design on the same navy / violet / blue palette, and the Ask Vectron dock rebuilt as a real chat wired to the Databricks supervisor agent.

## Run it

Requires Node 22.9+.

```bash
npm install
cp .env.example .env      # add DATABRICKS_TOKEN to talk to the real agent
npm run dev               # web on :5173, API proxy on :8787
```

Without a token, the dock runs in **preview mode**: it answers from the local insight engine, the way the prototype did, and the header says so.

Production build:

```bash
npm run build && npm start   # Express serves /dist and /api on :8787
```

## How it's put together

```
src/
  engine/          pure TypeScript, no React
    data.ts        plants, KPI definitions, mock numbers (swap for Databricks SQL later)
    content.ts     causes, actions, KPI links, agent prompt backlog, programme data, Hindi strings
    engine.ts      period roll-ups, RAG bands, Plant Health Index, contribution analysis
    drill.ts       sub-level detail tables (GL, product, block, customer, utility, PR…)
    insight.ts     builds the Brief and the KPI Drill objects the UI renders
    programs.ts    Kaizen / LSS / RISE / OMP answers
  components/      TopBar, Rail, HealthHero, KpiTable, InsightPanel, InsightViews, AskDock, Modals
  api/agent.ts     chat client: streaming (SSE) + JSON, Responses or chat-completions shape
  lib/             store (React context), speech (TTS + dictation), exporters (PNG/PDF/PPTX), icons
server/index.js    Express: /api/agent proxy (holds the token) + static hosting
app.yaml           Databricks Apps manifest
```

The insight engine returns plain objects, so the panel, the chat, narration and every export are generated from the same data and always agree.

## Supervisor agent

The browser never talks to Databricks directly. It calls `POST /api/agent` on the Express server, which adds auth and forwards to `DATABRICKS_ENDPOINT_URL`.

**Request sent to the endpoint** (same as the team's app):
```json
{ "input": [ {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."} ] }
```
The last 8 turns of the conversation are sent, so follow-up questions work.

**Reading the answer** — `extractAnswer()` in `src/api/agent.ts` mirrors the team's Python `extract_answer()`: walk `output[]` in reverse, take the last `type: "message"` item whose text is longer than 20 characters and isn't a `<name>…</name>` routing tag. Falls back to `choices[0].message.content`, then `text`.

**Auth** — two options, the server picks whichever is set:
- **Databricks Apps (recommended, same as the team's app):** service-principal OAuth. `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET` are injected by the Apps runtime; the server exchanges them at `<host>/oidc/v1/token` for a short-lived token and refreshes it before expiry. No token in code or config.
- **Local laptop:** set `DATABRICKS_TOKEN` (a personal access token) in `.env`.

**Answers in the chat** render as text and tables. Any table with numeric columns gets a Table / Chart toggle — line chart when the first column is months/quarters/FY, bar chart otherwise. Questions containing "trend", "compare", "chart" or "graph" open on the chart. Each table has a copy button (pastes straight into Excel).

**Suggested questions** are in `SUGGESTIONS` at the top of `src/components/AskDock.tsx` (taken from the team's Genie app).

**Preview mode** — with no credentials the chat still works, answering from the dashboard's sample data in the same text + table format, clearly labelled as a preview.

Settings in `.env`:
| Variable | Default | Meaning |
|---|---|---|
| `AGENT_PAYLOAD` | `responses` | `responses` sends `{input}`; `chat` sends `{messages}` |
| `AGENT_STREAM` | `false` | ask the endpoint for a streamed reply (the team's app doesn't stream) |
| `AGENT_CONTEXT` | `false` | prefix the dashboard filters to each question |
| `AGENT_TIMEOUT` | `120` | seconds before giving up |

The server logs each call's duration (`[agent] answered in 4210 ms`), and the chat shows it under each answer — useful for latency tuning.

## Deploy to Databricks Apps

```bash
npm run build
databricks apps deploy <app-name> --source-code-path /Workspace/Users/<you>/vectron-cockpit
```

Upload the project including `dist/` (Apps runs `node server/index.js` per `app.yaml` and installs from `package.json`). The server listens on `DATABRICKS_APP_PORT` automatically.

## What changed from v14.7

- Larger, readable type scale (Manrope, tabular numbers); sentence-case labels instead of tiny all-caps.
- Plant Health Index promoted to a full-width hero with a dial, per-group meters and status split.
- KPI scorecard: four layouts (By status is the default; also Table, Tiles, Detailed), remembered per user.
- Tolerance bar: dark line = target, dot = actual, ticks = the KPI's own monitor/intervene limits from the original tolerance column. It adds no new figures, and the dot's zone always matches the status label (checked across 15,444 KPI/scope/period combinations).
- KPI drill-down now shows the sub-level detail table (GL / product / block / customer…), the volume-vs-OPEx split for conversion cost, and a proper monthly trend chart.
- Ask Vectron: a plain chat — text, tables and charts — with the team's Genie starter questions, conversation history, stop, retry, new chat, dictation, read-aloud, and a preview mode when the agent is offline.
- Exports rebuilt from the insight objects (no DOM scraping); PDF/PPTX/PNG all match the screen.

All figures remain hypothetical, as in the prototype.
