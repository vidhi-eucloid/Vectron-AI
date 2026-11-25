import { useState } from 'react';
import { Icon } from '../lib/icons';
import { useStore } from '../lib/store';

const MODULES = [
  { id: 'ops', n: 'Operations Cockpit', ic: 'speed', on: true },
  { id: 'kaizen', n: 'Kaizen', ic: 'bulb' },
  { id: 'sixsigma', n: 'Six Sigma', ic: 'target' },
  { id: 'rise', n: 'RISE', ic: 'rise' },
  { id: 'bsc', n: 'Balanced Scorecard', ic: 'clip' },
  { id: 'tpm', n: 'TPM', ic: 'wrench' },
  { id: 'opexp', n: 'OPEx Programs', ic: 'rupee' },
  { id: 'reports', n: 'Reports', ic: 'doc' },
  { id: 'data', n: 'Data Library', ic: 'drum' },
  { id: 'admin', n: 'Settings', ic: 'gear' },
];

export function Rail() {
  const { toast } = useStore();
  const [mini, setMini] = useState(false);
  return (
    <aside className={'rail' + (mini ? ' mini' : '')}>
      <div className="rail-h">Control Tower</div>
      <nav>
        {MODULES.map((m) => (
          <button key={m.id} className={'rail-item' + (m.on ? ' on' : ' off')} aria-current={m.on ? 'page' : undefined}
            title={m.on ? m.n : `${m.n} — not part of this preview`}
            onClick={() => !m.on && toast(`${m.n} isn't part of this preview. The cockpit and Ask Vectron are live.`)}>
            <span className="rail-ic"><Icon n={m.ic} size={15} /></span>
            <span className="rail-l">{m.n}</span>
            {m.on ? <span className="rail-live" /> : <Icon n="lock" size={11} className="rail-lock" />}
          </button>
        ))}
      </nav>
      <button className="rail-col" onClick={() => setMini(!mini)} aria-label={mini ? 'Expand menu' : 'Collapse menu'}>
        <Icon n={mini ? 'expand' : 'collapse'} size={14} /><span className="rail-l">Collapse</span>
      </button>
    </aside>
  );
}
