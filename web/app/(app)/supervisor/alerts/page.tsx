'use client';
import { IconBell, IconPlayerPlay } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type Focus, type Pulse, type Route } from '@/components/MapView';
import { T } from '@/components/T';
import { RiskBadge, Skeleton, SuggestionCard } from '@/components/widgets';
import { useJson } from '@/lib/data';
import { jitter } from '@/lib/geo';
import { zoneLabel } from '@/lib/labels';
import { useDemo } from '@/lib/state';
import type { AlertEvent, Level, NextShift, Plan, Zone } from '@/lib/types';

export default function AlertsPage() {
  const zones = useJson<Zone[]>('zones');
  const fc = useJson<NextShift>('forecast_next_shift');
  const boundary = useJson<GeoJSON.Feature<GeoJSON.Polygon>>('boundary');
  const proposed = useJson<Plan>('plan_proposed');
  const alertsFile = useJson<{ events: AlertEvent[] }>('alerts');
  const { fired, fireNext, alerts, decideAlert } = useDemo();
  const [toast, setToast] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const events = alertsFile?.events ?? [];
  const byId = useMemo(() => Object.fromEntries((zones ?? []).map((z) => [z.id, z])), [zones]);

  const trigger = useCallback(() => {
    if (!events.length) return;
    const id = fireNext(events.map((e) => e.id));
    const ev = events.find((e) => e.id === id);
    if (!ev || !byId[ev.zone]) return;
    setToast(ev.toast_ar);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6500);
    setPulse({ center: byId[ev.zone].center, t0: performance.now() });
    setFocus({ center: byId[ev.zone].center, zoom: 14.2, nonce: Date.now() });
    setOpened(ev.id);
  }, [events, byId, fireNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'n' || e.key === 'N') trigger();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trigger]);

  const firedEvents = fired.map((id) => events.find((e) => e.id === id)).filter((e): e is AlertEvent => !!e);

  // risk levels: the forecast plus every update the agent made after a new report
  const levels = useMemo(() => {
    const base: Record<string, Level> = Object.fromEntries((fc?.shifts.night.zones ?? []).map((z) => [z.id, z.level]));
    for (const ev of firedEvents) for (const u of ev.risk_updates) base[u.zone] = u.level_after;
    return base;
  }, [fc, firedEvents]);

  // routes: the proposed plan; an approved suggestion swaps in that car's new route
  const routes: Route[] = useMemo(() => {
    const cars = (proposed?.cars ?? []).map((c) => {
      let path = c.path;
      for (const ev of firedEvents) {
        if (alerts[ev.id]?.status === 'approved' && ev.suggestion.car === c.id) {
          path = ev.plan_after.cars.find((x) => x.id === c.id)?.path ?? path;
        }
      }
      const moved = firedEvents.some((ev) => alerts[ev.id]?.status === 'approved' && ev.suggestion.car === c.id);
      return { id: c.id, label: c.id.slice(1), path, mode: moved ? ('selected' as const) : ('normal' as const) };
    });
    return cars;
  }, [proposed, firedEvents, alerts]);

  const dots = firedEvents.filter((e) => byId[e.zone]).map((e) => jitter(byId[e.zone].center, e.id));
  const latestPending = firedEvents.length && alerts[firedEvents[firedEvents.length - 1].id]?.status === 'pending';

  return (
    <div className="flex h-full">
      <aside className="flex w-[460px] shrink-0 flex-col border-e border-line bg-surface">
        <div className="flex items-start justify-between gap-3 p-4">
          <div>
            <h1 className="h2">التنبيهات المباشرة</h1>
            <p className="small muted">يحدّث الوكيل التوقعات عند كل بلاغ جديد ويقترح تغييراً.</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={trigger} disabled={fired.length >= events.length} title="اختصار: N">
            <IconPlayerPlay size={16} stroke={1.5} />
            محاكاة بلاغ جديد
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-auto px-4 pb-4">
          {!alertsFile && <Skeleton h={160} />}
          {alertsFile && firedEvents.length === 0 && (
            <div className="card grid place-items-center gap-2 py-10 text-center">
              <IconBell size={32} stroke={1.5} color="var(--ink-muted)" />
              <p className="body muted">لا توجد تنبيهات جديدة في هذه الوردية.</p>
            </div>
          )}
          {[...firedEvents].reverse().map((ev) => {
            const d = alerts[ev.id] ?? { status: 'pending' as const };
            const s = ev.suggestion;
            return (
              <div key={ev.id} className="flex flex-col gap-2">
                <button
                  className="card text-start"
                  style={{ padding: 'var(--space-3)', borderColor: opened === ev.id ? 'var(--alert)' : undefined }}
                  onClick={() => {
                    setOpened(ev.id);
                    byId[ev.zone] && setFocus({ center: byId[ev.zone].center, zoom: 14.4, nonce: Date.now() });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="chip chip-alert code">{ev.time}</span>
                    <span className="h3 flex-1">{ev.title_ar}</span>
                    <span className="code muted">{ev.zone}</span>
                  </div>
                  <div className="small muted mt-1">
                    {zoneLabel(ev.zone)} · {ev.note_ar}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {ev.risk_updates.slice(0, 1).map((u) => (
                      <span key={u.zone} className="label muted flex items-center gap-1.5">
                        الخطورة قبل <RiskBadge level={u.level_before} compact /> بعد <RiskBadge level={u.level_after} compact />
                      </span>
                    ))}
                    <span className="label muted num">{ev.risk_updates.length - 1} مناطق مجاورة تحدّثت</span>
                  </div>
                </button>
                <SuggestionCard
                  title={s.title_ar}
                  window={`${s.from}–${s.to}`}
                  reasons={s.reasons_ar}
                  impact={s.impact_ar}
                  decision={d}
                  onApprove={() => decideAlert(ev.id, 'approved')}
                  onReject={() => decideAlert(ev.id, 'rejected')}
                  approveLabel="اعتماد"
                />
              </div>
            );
          })}
        </div>
      </aside>

      <section className="relative min-w-0 flex-1">
        {zones && boundary && fc ? (
          <MapView
            zones={zones}
            levels={levels}
            boundary={boundary}
            routes={routes}
            incidents={dots}
            pulses={pulse && latestPending ? [pulse] : []}
            focus={focus}
            fillTransition={900}
          >
            {toast && (
              <div className="rise absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-[10px] border px-4 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--alert)' }} role="alert">
                <span className="body flex items-center gap-2">
                  <IconBell size={20} stroke={1.5} color="var(--alert)" />
                  <T>{toast}</T>
                </span>
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
