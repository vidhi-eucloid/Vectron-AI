import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CURM, type Ctx } from '../engine/engine';

export type Lang = 'en' | 'hi';
interface Store {
  ctx: Ctx;
  setCtx: (patch: Partial<Ctx>) => void;
  kpi: string | null;
  setKpi: (k: string | null) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}
const C = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ctx, set] = useState<Ctx>({ type: 'all', plant: 'all', year: 0, m0: 0, m1: CURM, basis: 'target' });
  const [kpi, setKpi] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [toastMsg, setToast] = useState<string | null>(null);
  const timer = useRef<number>();
  const setCtx = useCallback((patch: Partial<Ctx>) => set((c) => ({ ...c, ...patch })), []);
  const toast = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);
  const v = useMemo(() => ({ ctx, setCtx, kpi, setKpi, lang, setLang, toast, toastMsg }), [ctx, setCtx, kpi, lang, toast, toastMsg]);
  return <C.Provider value={v}>{children}</C.Provider>;
}
export function useStore() {
  const s = useContext(C);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
