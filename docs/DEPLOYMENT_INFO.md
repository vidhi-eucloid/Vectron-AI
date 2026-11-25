# plant-health-cockpit (Vectron Cockpit) - Deployment Info

Snapshot taken: 16 Nov 2026 (UTC). Workspace: https://adb-842962623037618.18.azuredatabricks.net

## 1. App

| Field | Value |
| --- | --- |
| App name | plant-health-cockpit |
| URL | https://plant-health-cockpit-842962623037618.18.azure.databricksapps.com |
| Status | RUNNING, compute ACTIVE, size MEDIUM |
| Active deployment | 01f1e1a966e91b0db413cd89ab32bdc3 (16 Nov 2026 10:35 UTC, SUCCEEDED) |
| Source code path | /Workspace/Users/nishant.kumar@eucloid.com/vectron-cockpit-wo-nm |
| Previous source (prebuilt, rollback) | /Workspace/Users/nishant.kumar@eucloid.com/vectron-cockpit-deploy |
| Original source | /Workspace/Users/nishant.kumar@eucloid.com/new UI cockpit/vectron-cockpit (1) |
| Service principal | app-3mq7yx plant-health-cockpit (client id 7b639ac2-12ca-4a8e-8568-3550f8b1b13d, SP id 143757187035292) |
| OAuth app client id | 112ece52-4e87-4ee1-9fdc-19b81e2ec636 |
| User API scopes | sql, genie, model-serving, catalog.catalogs:read, catalog.schemas:read, catalog.tables:read |
| Created | 24 Sep 2026 by nishant.kumar@eucloid.com |

## 2. Architecture

Browser (React 18 + Vite build in dist/) -> Express server (server/index.js, Node >= 22.9) -> Supervisor Agent serving endpoint -> Genie sub-agents -> SQL on mnk_prod.gen_ai

* The server proxies chat questions to the supervisor so tokens never reach the browser.
* Auth: app service principal via OAuth M2M (DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET injected by Databricks Apps). User-on-behalf-of auth is not possible: endpoint inference needs scope `model-serving-inference`, which is not available as an Apps scope.
* Build runs on the platform: `npm install` then `npm run build` (`tsc -b && vite build`), then `node server/index.js`.

## 3. app.yaml (current)

```yaml
command: ['node', 'server/index.js']
env:
  - name: DATABRICKS_ENDPOINT_URL
    value: 'https://adb-842962623037618.18.azuredatabricks.net/serving-endpoints/mas-a4f8104c-endpoint/invocations'
  - name: AGENT_PAYLOAD
    value: 'responses'
  - name: AGENT_STREAM
    value: 'false'
  - name: AGENT_TIMEOUT
    value: '300'
```

Other supported env vars (server/index.js): AGENT_CONTEXT (default false), AGENT_LOG_CONTENT (default true), DATABRICKS_TOKEN (PAT, local dev only).

## 4. Supervisor Agent

| Field | Value |
| --- | --- |
| Name | Mankind Pharma Operations Supervisor |
| Resource | supervisor-agents/a4f8104c-5e46-41f8-9fb8-a347f1723944 |
| Endpoint | mas-a4f8104c-endpoint (previously mas-0efb9cb4-endpoint) |
| Sub-agents | AGENT_1 (Operations Insights), AGENT2 (API Production / KSM / OPEX detail), AGENT5 (COGM), MNK_AGENT3_IQVIA (market data) |
| Request | POST /serving-endpoints/mas-a4f8104c-endpoint/invocations, body {"input": [{"role": "user", "content": "..."}]} |
| Response | output[] items: message, function_call (sub-agent), mcp_approval_request (sandbox tool). Walk back for the last message with text > 20 chars that is not a <name>...</name> routing tag. |
| Inference tables | Not enabled (no request/response capture) |

Full current instructions: see SUPERVISOR_INSTRUCTIONS.md. On 16 Nov 2026 a "## Files and Excel Output" section was appended; delete that section to revert.

## 5. Permissions (service principal)

* CAN_QUERY / CAN_MANAGE on the supervisor serving endpoint
* CAN_USE on SQL warehouse efc9fed520454af6
* CAN_MANAGE on Genie AGENT_1 space 01f1b0d9428a10bc90ed3b5f8208a981
* USE CATALOG mnk_prod, USE SCHEMA + SELECT on mnk_prod.gen_ai

## 6. Features added on 16 Nov 2026

1. Longer agent time limit: AGENT_TIMEOUT=300 s (default was 120 s).
2. Agent-built Excel downloads:
   * Contract: agent replies with a fenced block tagged `xlsx` containing JSON `{"filename": "x.xlsx", "sheets": [{"name": "S", "rows": [[headers...], [values...]]}]}`.
   * server/index.js: detects file requests (xlsx, excel, spreadsheet, workbook, csv, download; or "go ahead" after the agent offered an Excel file), appends the format rule to the question, retries once if the agent stops on the sandbox tool, and logs question / file name / answer previews.
   * src/lib/excel.ts: extractFileBlocks() and downloadWorkbook() turn the block into a real .xlsx (numbers stay numeric, YYYY-MM-DD becomes dates, sheet names sanitised).
   * src/components/Answer.tsx: file card with "Download .xlsx"; error card for invalid data; Genie tables with single-dash separators now render as tables.
   * src/api/agent.ts: if the reply stops on a tool step, shows the sub-agent tables instead of "no answer text".
3. Existing: attach Excel/CSV (read in browser, sent as CSV text); per-table Excel export button.

## 7. Root cause of the earlier "no answer text" error

The supervisor tried to build the Excel file with its `sandbox` MCP tool. The reply ended with an `mcp_approval_request` that the app does not handle, so no final answer text and no file. Even if approved, the file would stay inside the sandbox and could not be downloaded.

## 8. Deployment history

| Deployment ID | Created (UTC) | Source | Status |
| --- | --- | --- | --- |
| 01f1e1a966e91b0db413cd89ab32bdc3 | 2026-11-16 10:35 | vectron-cockpit-wo-nm | SUCCEEDED (Excel downloads) |
| 01f1e1a39c31108b9a5418e86341fda8 | 2026-11-16 09:53 | vectron-cockpit-wo-nm | SUCCEEDED (AGENT_TIMEOUT=300) |
| 01f1e1a2aad2110283a6fc3e82372186 | 2026-11-16 09:46 | vectron-cockpit-wo-nm | SUCCEEDED (first source build) |
| 01f1c71dc06b1abf8965f2104ca0e4c2 | 2026-10-13 15:50 | vectron-cockpit-deploy | SUCCEEDED |
| 01f1c71b7d3f126d80b2004cd18f17d4 | 2026-10-13 15:33 | vectron-cockpit-deploy | SUCCEEDED |
| 01f1c7191dc216e785faacc3dcc0c6a0 | 2026-10-13 15:16 | vectron-cockpit-deploy | SUCCEEDED |
| 01f1c7187ded1677b2e84e94c4a76e1a | 2026-10-13 15:12 | vectron-cockpit-deploy | SUCCEEDED |
| 01f1c717ecca1048858f2c7129ae5fc4 | 2026-10-13 15:08 | vectron-cockpit-deploy | SUCCEEDED |
| 01f1c7171c02132f88c342f248f2295a | 2026-10-13 15:02 | vectron-cockpit-deploy | SUCCEEDED |
| 01f1c704a52817c689b77e872d1d484e | 2026-10-13 12:50 | vectron-cockpit-deploy | SUCCEEDED |
| 01f1c7047256178397aae9e73346e9fe | 2026-10-13 12:48 | vectron-cockpit-deploy | FAILED (app crashed) |
| 01f1c704350b13beada304ca940a0171 | 2026-10-13 12:47 | vectron-cockpit-deploy | FAILED (app crashed) |
| 01f1c703bdd819669ac85f8547ae9caf | 2026-10-13 12:43 | vectron-cockpit-deploy | FAILED (build error) |
| 01f1c22455281b9ebf3ae694d337acb9 | 2026-10-07 07:54 | plant-health-cockpit (Streamlit) | SUCCEEDED |
| 01f1c221a64712f28231c97e102afd57 | 2026-10-07 07:35 | plant-health-cockpit (Streamlit) | SUCCEEDED |

Older Streamlit deployments omitted.

## 9. How to redeploy / roll back

```
databricks apps get plant-health-cockpit --output JSON
databricks apps deploy plant-health-cockpit --source-code-path /Workspace/Users/nishant.kumar@eucloid.com/vectron-cockpit-wo-nm
# roll back to the prebuilt October version
databricks apps deploy plant-health-cockpit --source-code-path /Workspace/Users/nishant.kumar@eucloid.com/vectron-cockpit-deploy
```
Only deploy when `apps get` shows status RUNNING and no pending_deployment.

## 10. Known issues / follow-ups

* npm audit: 4 vulnerabilities (2 moderate, 2 high) in dependencies.
* AGENT5 month labelling was inconsistent in one test (months 1-10 labelled under 2026); check the COGM Genie space.
* Request logging for the supervisor endpoint (inference tables) is not enabled.
* The `xlsx` package is downloaded from cdn.sheetjs.com at build time; builds fail if that site is unreachable.
