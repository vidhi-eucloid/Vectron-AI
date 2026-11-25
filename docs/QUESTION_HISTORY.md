# Question history (POC: browser storage)

Chats are saved in the user's browser with IndexedDB. No database, no agent or Genie changes.

## What users get

- History button in the chat header. In the normal chat window the list slides over the chat; in full view it shows as a sidebar.
- Past chats grouped as Today, Yesterday and Previous 7 days, titled by the first question.
- New chat, rename, delete (with confirmation) and clear all.
- Clicking a past chat reopens it with full context, so follow-ups and Excel downloads (including attached files) work as before.

## How it works

- `src/lib/history.ts`: IndexedDB storage (database `vectron-history`). The `meta` store holds the list entries; the `chats` store holds the full messages, including any attached Excel file.
- Chats save automatically after each answer; answers still in progress are not saved.
- Chats with no activity for 7 days are deleted when the app opens (`KEEP_DAYS` in `history.ts`).
- Each person's history is kept separate on a shared browser using the signed-in email. `server/index.js` returns it from the `X-Forwarded-Email` header in `/api/health`; locally there is no email, so history is saved under "local".
- If the browser blocks storage (some private modes), chat works as normal and the history panel says history isn't available.

## Files

| File | Change |
| --- | --- |
| `src/lib/history.ts` (new) | IndexedDB save, load, list, rename, delete, 7-day cleanup |
| `src/components/HistoryPanel.tsx` (new) | The history list UI |
| `src/components/AskDock.tsx` | History button, auto-save, reopen, new chat, rename and delete wiring |
| `src/lib/icons.tsx` | `history`, `pencil`, `trash` icons |
| `src/styles/chat.css` | History panel styles |
| `src/api/agent.ts` | Health response type includes `user` |
| `server/index.js` | `/api/health` also returns the signed-in email (a few lines) |

## Limits (agreed for the POC)

- History stays in the browser it was created in. It does not move to another browser or computer.
- Clearing browser data or using incognito removes it.
