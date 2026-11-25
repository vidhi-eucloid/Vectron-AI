import { useState } from 'react';
import { AskDock } from './components/AskDock';
import { HealthHero } from './components/HealthHero';
import { InsightPanel } from './components/InsightPanel';
import { KpiTable } from './components/KpiTable';
import { SendModal, SubscribeModal } from './components/Modals';
import { Rail } from './components/Rail';
import { TopBar } from './components/TopBar';
import { StoreProvider, useStore } from './lib/store';

function Shell() {
  const { toastMsg } = useStore();
  const [dock, setDock] = useState(false);
  const [modal, setModal] = useState<'send' | 'sub' | null>(null);
  return (
    <div className="shell">
      <TopBar />
      <Rail />
      <main className="main">
        <HealthHero />
        <div className="cols">
          <KpiTable />
          <InsightPanel onSend={() => setModal('send')} onSubscribe={() => setModal('sub')} />
        </div>
      </main>
      <AskDock open={dock} setOpen={setDock} />
      <SendModal open={modal === 'send'} onClose={() => setModal(null)} />
      <SubscribeModal open={modal === 'sub'} onClose={() => setModal(null)} />
      <div className={'toast' + (toastMsg ? ' show' : '')} role="status" aria-live="polite">{toastMsg}</div>
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
