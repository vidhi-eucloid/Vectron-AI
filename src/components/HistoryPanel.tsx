/* Past conversations for this user, saved in this browser (see lib/history.ts). */
import { useEffect, useRef, useState } from 'react';
import { dayGroup, KEEP_DAYS, type ChatMeta } from '../lib/history';
import { Icon } from '../lib/icons';

const time = (ts: number) => {
  const d = new Date(ts), today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

interface Props {
  chats: ChatMeta[];
  current: string | null;
  disabled: boolean;
  error: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function HistoryPanel({ chats, current, disabled, error, onOpen, onNew, onRename, onDelete, onClearAll, onClose }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null); // chat id, or 'all'
  const editRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) editRef.current?.select(); }, [editing]);
  useEffect(() => { if (!confirm) return; const t = setTimeout(() => setConfirm(null), 4000); return () => clearTimeout(t); }, [confirm]);

  const groups: [string, ChatMeta[]][] = [];
  for (const c of chats) {
    const g = dayGroup(c.updatedAt);
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(c); else groups.push([g, [c]]);
  }
  const saveRename = (id: string) => { if (draft.trim()) onRename(id, draft); setEditing(null); };

  return (
    <aside className="vx-hist" aria-label="Chat history">
      <div className="vx-hist-h">
        <button className="vx-hist-new" onClick={onNew} disabled={disabled}><Icon n="plus" size={14} />New chat</button>
        <button className="vx-ib vx-hist-x" onClick={onClose} title="Hide history" aria-label="Hide history"><Icon n="close" size={14} /></button>
      </div>

      <div className="vx-hist-list scroll">
        {error && <p className="vx-hist-empty">{error}</p>}
        {!error && !chats.length && <p className="vx-hist-empty">Your questions will appear here. They are saved in this browser for {KEEP_DAYS} days.</p>}
        {groups.map(([g, items]) => (
          <section key={g}>
            <h5>{g}</h5>
            <ul>
              {items.map((c) => (
                <li key={c.id} className={c.id === current ? 'on' : ''}>
                  {editing === c.id ? (
                    <input ref={editRef} className="vx-hist-edit" value={draft} maxLength={120} aria-label="Chat name"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(c.id); if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }}
                      onBlur={() => saveRename(c.id)} />
                  ) : (
                    <button className="vx-hist-item" onClick={() => onOpen(c.id)} disabled={disabled} aria-current={c.id === current ? 'true' : undefined} title={c.title}>
                      <span className="t">{c.hasFile && <Icon n="sheet" size={12} />}{c.title}</span>
                      <span className="m">{time(c.updatedAt)} · {c.questions} question{c.questions === 1 ? '' : 's'}</span>
                    </button>
                  )}
                  {editing !== c.id && (
                    <span className="vx-hist-act">
                      {confirm === c.id ? (
                        <button className="del" onClick={() => { onDelete(c.id); setConfirm(null); }}>Delete?</button>
                      ) : (
                        <>
                          <button onClick={() => { setDraft(c.title); setEditing(c.id); }} title="Rename" aria-label={`Rename ${c.title}`}><Icon n="pencil" size={12} /></button>
                          <button onClick={() => setConfirm(c.id)} disabled={disabled && c.id === current} title="Delete" aria-label={`Delete ${c.title}`}><Icon n="trash" size={12} /></button>
                        </>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="vx-hist-f">
        <span>Saved in this browser only · kept {KEEP_DAYS} days</span>
        {chats.length > 0 && (confirm === 'all'
          ? <button className="del" onClick={() => { onClearAll(); setConfirm(null); }} disabled={disabled}>Delete all?</button>
          : <button onClick={() => setConfirm('all')} disabled={disabled}>Clear all</button>)}
      </div>
    </aside>
  );
}
