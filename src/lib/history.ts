/* Chat history, saved in this browser with IndexedDB.
   - Nothing is sent to a server or database: history stays in the browser it was created in,
     and clearing browser data removes it.
   - Chats are kept per user (the email Databricks Apps sends with each request), so two people
     sharing a browser do not see each other's chats.
   - Chats with no activity for KEEP_DAYS are deleted when the app opens.
   Two stores: "meta" holds the small list entries, "chats" holds the full messages (including any
   attached Excel file), so the history list opens fast without loading every conversation. */

export const KEEP_DAYS = 7;
const DB_NAME = 'vectron-history';
const DAY = 24 * 60 * 60 * 1000;

export interface ChatMeta {
  id: string;
  user: string;
  title: string;
  /** true once the user renamed the chat, so the title stops following the first question */
  renamed?: boolean;
  createdAt: number;
  updatedAt: number;
  questions: number;
  hasFile: boolean;
}
interface ChatRecord<M> { id: string; msgs: M[] }

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('This browser cannot save chat history.'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        const meta = d.createObjectStore('meta', { keyPath: 'id' });
        meta.createIndex('user', 'user');
        d.createObjectStore('chats', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Chat history is not available in this browser.'));
      req.onblocked = () => reject(new Error('Close other tabs of this app and reload to enable chat history.'));
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error || new Error('Saving chat history was cancelled.'));
});
const result = <T>(req: IDBRequest<T>) => new Promise<T>((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const newChatId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** All chats of this user, newest first. */
export async function listChats(user: string): Promise<ChatMeta[]> {
  const d = await db();
  const rows = await result(d.transaction('meta').objectStore('meta').index('user').getAll(user) as IDBRequest<ChatMeta[]>);
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadChat<M>(id: string): Promise<M[] | null> {
  const d = await db();
  const rec = await result(d.transaction('chats').objectStore('chats').get(id) as IDBRequest<ChatRecord<M> | undefined>);
  return rec?.msgs ?? null;
}

/** Saves the full chat. Keeps a title the user gave it. */
export async function saveChat<M>(meta: Omit<ChatMeta, 'renamed'>, msgs: M[]) {
  const d = await db();
  const tx = d.transaction(['meta', 'chats'], 'readwrite');
  const metaStore = tx.objectStore('meta');
  const old = await result(metaStore.get(meta.id) as IDBRequest<ChatMeta | undefined>);
  metaStore.put({ ...meta, title: old?.renamed ? old.title : meta.title, renamed: old?.renamed, createdAt: old?.createdAt ?? meta.createdAt });
  tx.objectStore('chats').put({ id: meta.id, msgs });
  await done(tx);
}

export async function renameChat(id: string, title: string) {
  const d = await db();
  const tx = d.transaction('meta', 'readwrite');
  const store = tx.objectStore('meta');
  const old = await result(store.get(id) as IDBRequest<ChatMeta | undefined>);
  if (old) store.put({ ...old, title: title.trim().slice(0, 120) || old.title, renamed: true });
  await done(tx);
}

export async function deleteChats(ids: string[]) {
  if (!ids.length) return;
  const d = await db();
  const tx = d.transaction(['meta', 'chats'], 'readwrite');
  for (const id of ids) { tx.objectStore('meta').delete(id); tx.objectStore('chats').delete(id); }
  await done(tx);
}

/** Deletes chats with no activity for KEEP_DAYS (all users in this browser). Returns how many went. */
export async function pruneOld(now = Date.now()) {
  const d = await db();
  const all = await result(d.transaction('meta').objectStore('meta').getAll() as IDBRequest<ChatMeta[]>);
  const old = all.filter((c) => now - c.updatedAt > KEEP_DAYS * DAY).map((c) => c.id);
  await deleteChats(old);
  return old.length;
}

/** "Today", "Yesterday" or "Previous 7 days", for grouping the list. */
export function dayGroup(ts: number, now = Date.now()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (ts >= +start) return 'Today';
  if (ts >= +start - DAY) return 'Yesterday';
  return `Previous ${KEEP_DAYS} days`;
}
