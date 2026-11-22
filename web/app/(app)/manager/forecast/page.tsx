'use client';
import { IconArrowDownRight, IconArrowUpRight, IconMinus, IconPlayerPause, IconPlayerPlay, IconX } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MapView, type Focus } from '@/components/MapView';
import { RiskBadge, Skeleton } from '@/components/widgets';
import { useJson } from '@/lib/data';
import { SHIFT_AR, signed, zoneLabel } from '@/lib/labels';
import type { Forecast7, Level, Zone } from '@/lib/types';

const TREND = {
  rising: { icon: IconArrowUpRight, label: 'في ارتفاع', color: 'var(--alert)' },
  falling: { icon: IconArrowDownRight, label: 'في انخفاض', color: 'var(--patrol)' },
  flat: { icon: IconMinus, label: 'مستقر', color: 'var(--ink-muted)' },
} as const;

export default function ForecastPage() {
  const zones = useJson<Zone[]>('zones');
  const f = useJson<Forecast7>('forecast_7d');
  const boundary = useJson<GeoJSON.Feature<GeoJSON.Polygon>>('boundary');
  const [step, setStep] = useState(0); // 0 = 7-day average, 1..21 = one shift
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setStep((s) => (s >= 21 ? 1 : s + 1)), 900);
    return () => clearInterval(t);
  }, [playing]);

  const byId = useMemo(() => Object.fromEntries((zones ?? []).map((z) => [z.id, z])), [zones]);
  const fz = useMemo(() => Object.fromEntries((f?.zones ?? []).map((z) => [z.id, z])), [f]);
  const levels = useMemo(() => {
    const out: Record<string, Level> = {};
    for (const z of f?.zones ?? []) out[z.id] = step === 0 ? z.level : z.levels[step - 1];
    return out;
  }, [f, step]);
  const stepLabel = step === 0 || !f ? 'متوسط 7 أيام' : `${f.city_daily[Math.floor((step - 1) / 3)].label_ar} · ${SHIFT_AR[f.steps[step - 1].shift]}`;
  const selZ = sel ? fz[sel] : null;
  const T = selZ ? TREND[selZ.trend] : null;

  return (
    <div className="flex h-full">
      <aside className="flex w-[380px] shrink-0 flex-col gap-4 overflow-auto border-e border-line bg-surface p-4">
        <div>
          <h1 className="h2">خريطة المخاطر لـ 7 أيام</h1>
          <p className="small muted">من 22 إلى 28 نوفمبر، لكل وردية.</p>
        </div>
        <div>
          <h2 className="h3 mb-2">المناطق الأكثر ارتفاعاً هذا الأسبوع</h2>
          {!f && <Skeleton h={160} />}
          <ul className="flex flex-col gap-1">
            {f?.rising_top5.map((r, i) => (
              <li key={r.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-[6px] p-2 text-start hover:bg-raised"
                  onClick={() => {
                    setSel(r.id);
                    byId[r.id] && setFocus({ center: byId[r.id].center, zoom: 14.8, nonce: Date.now() });
                  }}
                >
                  <span className="code muted w-4">{i + 1}</span>
                  <span className="flex-1 body">{zoneLabel(r.id)}</span>
                  <RiskBadge level={fz[r.id]?.level ?? 1} compact />
                  <span className="chip chip-alert num">{signed(r.change_pct, 0, '%')}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="h3 mb-1">البلاغات المتوقعة في المدينة يومياً</h2>
          <div style={{ height: 190 }} dir="ltr">
            {f && (
              <ResponsiveContainer>
                <LineChart data={f.city_daily} margin={{ top: 8, right: 28, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label_ar" tick={{ fill: 'var(--ink-muted)', fontSize: 12 }} interval={1} stroke="var(--line-strong)" />
                  <YAxis tick={{ fill: 'var(--ink-muted)', fontSize: 12 }} stroke="var(--line-strong)" domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v) => Number(v).toFixed(1)} />
                  <Tooltip contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 6 }} labelStyle={{ color: 'var(--ink)' }} />
                  <Line type="monotone" dataKey="expected_incidents" name="بلاغات متوقعة" stroke="var(--beacon)" strokeWidth={2} dot={{ r: 3, fill: 'var(--beacon)' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="label muted">أرقام توضيحية على بيانات افتراضية</p>
        </div>
      </aside>

      <section className="relative min-w-0 flex-1">
        {zones && boundary && f ? (
          <MapView zones={zones} levels={levels} boundary={boundary} selectedId={sel} onSelect={setSel} focus={focus} fillTransition={400}>
            <div className="map-overlay absolute bottom-20 left-4 z-10 flex w-[560px] max-w-[calc(100%-32px)] items-center gap-3 px-3 py-2">
              <button className="btn btn-outline btn-sm" onClick={() => { setPlaying((p) => !p); if (step === 0) setStep(1); }} aria-label={playing ? 'إيقاف' : 'تشغيل'}>
                {playing ? <IconPlayerPause size={16} stroke={1.5} /> : <IconPlayerPlay size={16} stroke={1.5} />}
              </button>
              <input type="range" min={0} max={21} value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} className="flex-1 accent-[var(--beacon)]" aria-label="الوردية" />
              <span className="label w-44 text-end">{stepLabel}</span>
            </div>
            {selZ && sel && byId[sel] && T && (
              <div className="map-overlay rise absolute right-4 top-4 z-20 flex w-[320px] flex-col gap-3 p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <h3 className="h3">{zoneLabel(sel)} <span className="code muted">{sel}</span></h3>
                    <div className="small muted">{byId[sel].site_summary_ar}</div>
                  </div>
                  <button className="btn btn-text btn-sm" onClick={() => setSel(null)} aria-label="إغلاق"><IconX size={18} stroke={1.5} /></button>
                </div>
                <div className="flex items-center justify-between">
                  <RiskBadge level={selZ.level} />
                  <span className="label flex items-center gap-1" style={{ color: T.color }}>
                    <T.icon size={18} stroke={1.5} /> {T.label} <span className="num">{signed(selZ.change_pct, 0, '%')}</span>
                  </span>
                </div>
                <div>
                  <div className="label muted mb-1">الأسباب</div>
                  <ul className="small flex list-disc flex-col gap-0.5 ps-5">{selZ.reasons_ar.map((r) => <li key={r}>{r}</li>)}</ul>
                </div>
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
