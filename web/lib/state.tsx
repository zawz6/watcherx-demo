'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type Status = 'pending' | 'approved' | 'rejected';
export interface Decision {
  status: Status;
  at?: string;
}
type Pattern = 'open' | 'applied' | 'ignored';

interface DemoState {
  resetKey: number;
  reset: () => void;
  stamp: () => string;
  plan: Decision;
  decidePlan: (s: Status) => void;
  activePlan: string;
  setActivePlan: (id: string) => void;
  pattern: Record<string, Pattern>;
  setPattern: (zone: string, p: Pattern) => void;
  fired: string[];
  fireNext: (all: string[]) => string | null;
  alerts: Record<string, Decision>;
  decideAlert: (id: string, s: Status) => void;
  hotspots: Record<string, Decision>;
  decideHotspot: (id: string, s: Status) => void;
}

const Ctx = createContext<DemoState | null>(null);
const START_MIN = 21 * 60 + 43;

export function DemoProvider({ children }: { children: ReactNode }) {
  const [resetKey, setResetKey] = useState(0);
  const [plan, setPlan] = useState<Decision>({ status: 'pending' });
  const [activePlan, setActivePlan] = useState('proposed');
  const [pattern, setPatternState] = useState<Record<string, Pattern>>({});
  const [fired, setFired] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Record<string, Decision>>({});
  const [hotspots, setHotspots] = useState<Record<string, Decision>>({});
  const clock = useRef(START_MIN);

  const stamp = useCallback(() => {
    clock.current += 1;
    const m = clock.current % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }, []);

  const reset = useCallback(() => {
    clock.current = START_MIN;
    setPlan({ status: 'pending' });
    setActivePlan('proposed');
    setPatternState({});
    setFired([]);
    setAlerts({});
    setHotspots({});
    setResetKey((k) => k + 1);
  }, []);

  const value = useMemo<DemoState>(
    () => ({
      resetKey,
      reset,
      stamp,
      plan,
      decidePlan: (s) => setPlan({ status: s, at: s === 'approved' ? stamp() : undefined }),
      activePlan,
      setActivePlan,
      pattern,
      setPattern: (zone, p) => setPatternState((o) => ({ ...o, [zone]: p })),
      fired,
      fireNext: (all) => {
        const next = all.find((id) => !fired.includes(id));
        if (!next) return null;
        setFired((f) => [...f, next]);
        setAlerts((a) => ({ ...a, [next]: { status: 'pending' } }));
        return next;
      },
      alerts,
      decideAlert: (id, s) => setAlerts((a) => ({ ...a, [id]: { status: s, at: s === 'approved' ? stamp() : undefined } })),
      hotspots,
      decideHotspot: (id, s) => setHotspots((h) => ({ ...h, [id]: { status: s, at: s === 'approved' ? stamp() : undefined } })),
    }),
    [resetKey, reset, stamp, plan, activePlan, pattern, fired, alerts, hotspots],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo outside DemoProvider');
  return v;
}
