'use client';
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { MapView, type Route } from '@/components/MapView';
import { T } from '@/components/T';
import { AgentTrace, KpiTile, RiskBadge, Skeleton } from '@/components/widgets';
import { useJson } from '@/lib/data';
import { num, signed, zoneLabel } from '@/lib/labels';
import { useDemo } from '@/lib/state';
import type { NextShift, Plan, PlanVariants, Zone } from '@/lib/types';

const TRACE = [
  { label: 'جلب التوقعات', ms: 412 },
  { label: 'تخطيط الدوريات', ms: 538 },
  { label: 'محاكاة الخطة', ms: 361 },
  { label: 'فحص الأنماط', ms: 297 },
];

export default function PlanPage() {
  const zones = useJson<Zone[]>('zones');
  const fc = useJson<NextShift>('forecast_next_shift');
  const boundary = useJson<GeoJSON.Feature<GeoJSON.Polygon>>('boundary');
  const proposed = useJson<Plan>('plan_proposed');
  const variants = useJson<PlanVariants>('plan_variants');
  const { plan: decision, decidePlan, activePlan, setActivePlan, pattern, setPattern } = useDemo();
  const [car, setCar] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  const plan: Plan | null = useMemo(() => {
    if (!proposed || !variants) return null;
    if (activePlan === 'proposed') return proposed;
    return (
      variants.alternatives.find((a) => a.id === activePlan)?.plan ??
      variants.edit_options.find((e) => e.id === activePlan)?.plan ??
      proposed
    );
  }, [proposed, variants, activePlan]);

  const levels = useMemo(() => Object.fromEntries((fc?.shifts.night.zones ?? []).map((z) => [z.id, z.level])), [fc]);
  const byId = useMemo(() => Object.fromEntries((zones ?? []).map((z) => [z.id, z])), [zones]);
  const routes: Route[] = (plan?.cars ?? []).map((c) => ({
    id: c.id,
    label: c.id.slice(1),
    path: c.path,
    mode: car ? (car === c.id ? 'selected' : 'dim') : 'normal',
  }));

  const warning = proposed?.pattern_warnings?.[0];
  const showWarning = !!warning && activePlan === 'proposed' && !pattern[warning.zone];
  const base = proposed?.baseline_kpis;
  const k = plan?.kpis;

  return (
    <div className="flex h-full">
      <aside className="flex w-[460px] shrink-0 flex-col border-e border-line bg-surface">
        <div className="flex-1 space-y-4 overflow-auto p-4">
          <div>
            <h1 className="h2">خطة الدوريات المقترحة</h1>
            <p className="small muted">
              <T>الوردية الليلية 22:00–06:00 · 6 دوريات</T>
            </p>
          </div>
          <AgentTrace steps={TRACE} />

          {k && base ? (
            <div className="grid grid-cols-3 gap-2">
              <KpiTile
                label="تغطية المناطق عالية الخطورة"
                value={`${k.coverage_high_risk_pct.toFixed(0)}%`}
                compare={`${signed(k.coverage_high_risk_pct - base.coverage_high_risk_pct)} نقطة`}
                good={k.coverage_high_risk_pct >= base.coverage_high_risk_pct}
                accent
              />
              <KpiTile
                label="متوسط زمن الاستجابة"
                value={num(k.avg_response_min)}
                unit="دقيقة"
                compare={`${signed(k.avg_response_min - base.avg_response_min, 1)} دقيقة (${signed(((k.avg_response_min - base.avg_response_min) / base.avg_response_min) * 100, 0, '%')})`}
                good={k.avg_response_min <= base.avg_response_min}
              />
              <KpiTile
                label="زمن الاستجابة لأسوأ 10%"
                value={num(k.p90_response_min)}
                unit="دقيقة"
                compare={`${signed(k.p90_response_min - base.p90_response_min, 1)} دقيقة (${signed(((k.p90_response_min - base.p90_response_min) / base.p90_response_min) * 100, 0, '%')})`}
                good={k.p90_response_min <= base.p90_response_min}
              />
            </div>
          ) : (
            <Skeleton h={120} />
          )}
          <p className="label muted">المقارنة مع الخطة الحالية (دوريات ثابتة على الطرق الرئيسية). أرقام توضيحية على بيانات افتراضية.</p>

          {showWarning && warning && (
            <div className="card rise flex flex-col gap-2" style={{ borderColor: 'var(--beacon)' }}>
              <div className="flex items-center gap-2">
                <IconAlertTriangle size={22} stroke={1.5} color="var(--beacon)" />
                <span className="h3">تنبيه نمط متكرر</span>
              </div>
              <p className="small">
                <T>{`${warning.text_ar} بديلان بنفس التغطية: ${warning.alternatives.map((a) => a.time).join(' أو ')}.`}</T>
              </p>
              <div className="flex flex-wrap gap-2">
                {warning.alternatives.map((a) => (
                  <button
                    key={a.variant}
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setActivePlan(a.variant);
                      setPattern(warning.zone, 'applied');
                    }}
                  >
                    تطبيق البديل <span className="code">{a.time}</span>
                  </button>
                ))}
                <button className="btn btn-text btn-sm" onClick={() => setPattern(warning.zone, 'ignored')}>
                  تجاهل
                </button>
              </div>
            </div>
          )}
          {warning && pattern[warning.zone] === 'applied' && (
            <div className="chip chip-patrol">
              <IconCheck size={14} stroke={1.5} /> طُبّق البديل لـ {zoneLabel(warning.zone)}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="h3">الخطة لكل دورية</h2>
            {(plan?.cars ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setCar((cur) => (cur === c.id ? null : c.id))}
                className="card text-start"
                style={{ borderColor: car === c.id ? 'var(--patrol)' : undefined, padding: 'var(--space-3)' }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="chip chip-patrol code">{c.id}</span>
                  <span className="body font-semibold">الدورية {c.id.slice(1)}</span>
                </div>
                <ol className="flex flex-col gap-1">
                  {c.segments.map((s) => (
                    <li key={s.zone + s.start} className="flex items-center gap-2 small">
                      <RiskBadge level={s.level} compact />
                      <span>{zoneLabel(s.zone)}</span>
                      <span className="muted">
                        (<T>{`${s.start}–${s.end}`}</T>)
                      </span>
                    </li>
                  ))}
                </ol>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-line bg-surface p-4">
          {decision.status === 'pending' ? (
            <div className="flex items-center gap-2">
              <button className="btn btn-primary flex-1" onClick={() => decidePlan('approved')}>
                اعتماد الخطة
              </button>
              <button className="btn btn-outline" onClick={() => setDrawer(true)}>
                تعديل
              </button>
              <button className="btn btn-text" onClick={() => decidePlan('rejected')}>
                رفض
              </button>
            </div>
          ) : decision.status === 'approved' ? (
            <div className="chip chip-patrol">
              <IconCheck size={14} stroke={1.5} /> الخطة معتمدة <span className="code">{decision.at}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="chip chip-outline">
                <IconX size={14} stroke={1.5} /> الخطة مرفوضة
              </span>
              <button className="btn btn-text btn-sm" onClick={() => decidePlan('pending')}>
                تراجع
              </button>
            </div>
          )}
        </div>
      </aside>

      <section className="relative min-w-0 flex-1">
        {zones && boundary && fc ? (
          <MapView zones={zones} levels={levels} boundary={boundary} routes={routes} selectedId={null}>
            {drawer && variants && (
              <div className="map-overlay rise absolute right-4 top-4 z-20 flex w-[380px] flex-col gap-3 p-4" role="dialog" aria-label="تعديل الخطة">
                <div className="flex items-center">
                  <h3 className="h3 flex-1">تعديل الخطة</h3>
                  <button className="btn btn-text btn-sm" onClick={() => setDrawer(false)} aria-label="إغلاق">
                    <IconX size={18} stroke={1.5} />
                  </button>
                </div>
                <p className="small muted">انقل منطقة بين الدوريات، وتُحسب المؤشرات من جديد.</p>
                {variants.edit_options.map((o) => (
                  <button
                    key={o.id}
                    className="card-flat text-start"
                    style={{ outline: activePlan === o.id ? '1px solid var(--beacon)' : 'none' }}
                    onClick={() => setActivePlan(o.id)}
                  >
                    <div className="body">{o.label_ar}</div>
                    <div className="label muted num">
                      تغطية {o.plan.kpis.coverage_high_risk_pct.toFixed(0)}% · استجابة {num(o.plan.kpis.avg_response_min)} دقيقة
                    </div>
                  </button>
                ))}
                <div className="flex gap-2">
                  <button className="btn btn-outline btn-sm" onClick={() => setActivePlan('proposed')}>
                    العودة إلى المقترح الأصلي
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setDrawer(false)}>
                    تم
                  </button>
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
