'use client';
import dynamic from 'next/dynamic';

export const MapView = dynamic(() => import('./RiskMap'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center small muted" style={{ background: 'var(--bg-deep)' }}>
      جارٍ تحميل الخريطة…
    </div>
  ),
});
export type { Route, Pulse, Focus } from './RiskMap';
