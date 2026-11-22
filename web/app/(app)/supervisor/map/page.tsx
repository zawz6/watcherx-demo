'use client';
import { useMemo, useState } from 'react';
import { MapView, type Focus } from '@/components/MapView';
import ZonePopover from '@/components/ZonePopover';
import { T } from '@/components/T';
import { RiskBadge, Skeleton } from '@/components/widgets';
import { useJson } from '@/lib/data';
import { jitter } from '@/lib/geo';
import { SHIFT_AR, TYPE_ORDER, TYPE_SHORT, zoneLabel } from '@/lib/labels';
import { levelsFor, mainType } from '@/lib/risk';
import type { IncType, Incident, NextShift, ShiftKey, Zone } from '@/lib/types';

export default function ShiftMapPage() {
  const zones = useJson<Zone[]>('zones');
  const fc = useJson<NextShift>('forecast_next_shift');
  const incidents = useJson<Incident[]>('incidents');
  const boundary = useJson<GeoJSON.Feature<GeoJSON.Polygon>>('boundary');
  const [shift, setShift] = useState<ShiftKey>('night');
  const [type, setType] = useState<IncType | 'all'>('all');
  const [showInc, setShowInc] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);

  const fz = fc?.shifts[shift].zones;
  const levels = useMemo(() => (fz ? levelsFor(fz, type) : {}), [fz, type]);
  const top10 = useMemo(() => {
    if (!fz) return [];
    const key = (z: (typeof fz)[number]) => (type === 'all' ? z.risk : z.by_type[type]);
    return [...fz].sort((a, b) => key(b) - key(a)).slice(0, 10);
  }, [fz, type]);
  const byId = useMemo(() => Object.fromEntries((zones ?? []).map((z) => [z.id, z])), [zones]);
  const dots = useMemo(() => {
    if (!showInc || !incidents || !zones) return [];
    return incidents
      .filter((i) => i.ts >= '2026-11-14' && (type === 'all' || i.type === type))
      .map((i) => jitter(byId[i.zone].center, i.id));
  }, [showInc, incidents, zones, byId, type]);

  const pick = (id: string) => {
    setSel(id);
    setFocus({ center: byId[id].center, zoom: 14.8, nonce: Date.now() });
  };
  const selForecast = fz?.find((z) => z.id === sel);

  return (
    <div className="flex h-full">
      <aside className="flex w-[360px] shrink-0 flex-col border-e border-line bg-surface">
        <div className="px-4 pb-2 pt-4">
          <h2 className="h3">أعلى 10 مناطق خطورة</h2>
          <p className="small muted"><T>{fc?.shifts[shift].label_ar ?? ''}</T></p>
        </div>
        <ol className="flex-1 overflow-auto px-2 pb-3">
          {!fz && Array.from({ length: 8 }).map((_, i) => <li key={i} className="p-2"><Skeleton h={52} /></li>)}
          {top10.map((z, i) => (
            <li key={z.id}>
              <button
                onClick={() => pick(z.id)}
                className="flex w-full items-start gap-3 rounded-[6px] p-2 text-start hover:bg-raised"
                style={{ background: sel === z.id ? 'var(--surface-raised)' : undefined }}
              >
                <span className="code muted mt-0.5 w-5">{i + 1}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2">
                    <span className="body font-semibold">{zoneLabel(z.id)}</span>
                    <span className="code muted">{z.id}</span>
                    <span className="chip chip-outline ms-auto">{TYPE_SHORT[mainType(z)]}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <RiskBadge level={z.level} compact />
                    <span className="small muted truncate">{z.reasons_ar[0]}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <section className="relative min-w-0 flex-1">
        {zones && boundary && fz ? (
          <MapView zones={zones} levels={levels} boundary={boundary} selectedId={sel} onSelect={setSel} incidents={dots} focus={focus}>
            <div className="absolute left-14 top-4 z-10 flex max-w-[calc(100%-420px)] flex-wrap items-center gap-2">
              <div className="seg" role="group" aria-label="الوردية">
                {(['morning', 'evening', 'night'] as ShiftKey[]).map((s) => (
                  <button key={s} aria-pressed={shift === s} onClick={() => setShift(s)}>
                    {SHIFT_AR[s]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 rounded-[6px] bg-surface p-1" role="group" aria-label="نوع البلاغ">
                {(['all', ...TYPE_ORDER] as const).map((t) => (
                  <button key={t} className="chip-btn" aria-pressed={type === t} onClick={() => setType(t)}>
                    {t === 'all' ? 'الكل' : TYPE_SHORT[t]}
                  </button>
                ))}
              </div>
              <button className="chip-btn bg-surface" aria-pressed={showInc} onClick={() => setShowInc((v) => !v)}>
                إظهار البلاغات السابقة
              </button>
            </div>
            {sel && selForecast && byId[sel] && incidents && (
              <div className="absolute right-4 top-4 z-20">
                <ZonePopover zone={byId[sel]} forecast={selForecast} incidents={incidents} onClose={() => setSel(null)} />
              </div>
            )}
          </MapView>
        ) : (
          <div className="grid h-full place-items-center small muted">جارٍ تحميل الخريطة…</div>
        )}
      </section>
    </div>
  );
}
