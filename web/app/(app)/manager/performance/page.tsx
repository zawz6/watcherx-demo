'use client';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KpiTile, PageHeader, Skeleton } from '@/components/widgets';
import { useJson } from '@/lib/data';
import { TYPE_FULL, TYPE_ORDER, TYPE_SHORT, num, signed } from '@/lib/labels';
import type { KpiFile, Metrics } from '@/lib/types';

const AX = { fill: 'var(--ink-muted)', fontSize: 12 };
const TIP = { contentStyle: { background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 6 }, labelStyle: { color: 'var(--ink)' } };

export default function PerformancePage() {
  const k = useJson<KpiFile>('kpis');
  const m = useJson<Metrics>('metrics');
  const t = k?.tiles;
  const weeks = (k?.weeks ?? []).map((w) => ({ ...w, short: w.label_ar.split('–').pop()!.trim() }));

  return (
    <div className="pb-8">
      <PageHeader title="الأداء" sub="آخر 12 أسبوعاً. أرقام توضيحية على بيانات افتراضية." />
      <div className="space-y-4 px-6">
        {!t ? (
          <Skeleton h={120} />
        ) : (
          <div className="grid grid-cols-4 gap-4">
            <KpiTile label="متوسط زمن الاستجابة" value={num(t.avg_response_min.value)} unit="دقيقة" compare={`${signed(t.avg_response_min.change_pct, 0, '%')} عن الخطة الحالية`} good={t.avg_response_min.change_pct <= 0} />
            <KpiTile label="تغطية المناطق عالية الخطورة" value={`${t.coverage_high_risk_pct.value}%`} compare={`${signed(t.coverage_high_risk_pct.change_pts)} نقطة عن الخطة الحالية`} good={t.coverage_high_risk_pct.change_pts >= 0} />
            <KpiTile label="عدد البلاغات (آخر 30 يوماً)" value={t.incidents_30d.value} unit="بلاغ" compare={`${signed(t.incidents_30d.change_pct, 0, '%')} عن الشهر الماضي`} good={t.incidents_30d.change_pct <= 0} />
            <KpiTile label="نسبة اعتماد توصيات الوكيل" value={`${t.approval_rate.value}%`} compare={`${signed(t.approval_rate.change_pts)} نقطة عن الشهر الماضي`} good={t.approval_rate.change_pts >= 0} />
          </div>
        )}

        <div className="grid grid-cols-[1fr_420px] gap-4">
          <div className="card">
            <h2 className="h3">زمن الاستجابة الأسبوعي (دقيقة)</h2>
            <p className="label muted mb-2">إعادة تشغيل بلاغات كل أسبوع على الخطة الحالية وعلى خطة WatcherX</p>
            <div style={{ height: 280 }} dir="ltr">
              {k && (
                <ResponsiveContainer>
                  <LineChart data={weeks} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="short" tick={AX} interval={1} stroke="var(--line-strong)" />
                    <YAxis tick={AX} stroke="var(--line-strong)" domain={[0, 'dataMax + 1']} tickFormatter={(v) => Number(v).toFixed(0)} />
                    <Tooltip {...TIP} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Line type="monotone" dataKey="resp_current" name="الخطة الحالية" stroke="var(--ink-muted)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="resp_watcherx" name="خطة WatcherX" stroke="var(--patrol)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--patrol)' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card flex flex-col gap-3" style={{ borderColor: 'var(--beacon)' }}>
            <h2 className="h3">دقة التنبؤ</h2>
            {m ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="metric num" style={{ color: 'var(--beacon)' }}>{m.hit_rate_top10_model.toFixed(0)}%</span>
                  <span className="small muted">نسبة الإصابة</span>
                </div>
                <p className="body">
                  نسبة الإصابة: <strong className="num">{m.hit_rate_top10_model.toFixed(0)}%</strong> من البلاغات وقعت في أعلى 10% من المناطق خطورة، مقابل{' '}
                  <strong className="num">{m.hit_rate_top10_baseline.toFixed(0)}%</strong> لطريقة «بؤر الشهر الماضي».
                </p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2"><span className="label w-24">WatcherX</span><div className="h-2.5 flex-1 rounded-[3px] bg-raised"><div className="h-full rounded-[3px]" style={{ width: `${m.hit_rate_top10_model}%`, background: 'var(--beacon)' }} /></div></div>
                  <div className="flex items-center gap-2"><span className="label muted w-24">بؤر الشهر الماضي</span><div className="h-2.5 flex-1 rounded-[3px] bg-raised"><div className="h-full rounded-[3px]" style={{ width: `${m.hit_rate_top10_baseline}%`, background: 'var(--ink-muted)' }} /></div></div>
                </div>
                <p className="label muted num">فترة الاختبار {m.test_window.replace('..', ' – ')} · {m.test_incidents} بلاغاً</p>
                <span className="chip chip-outline self-start">أرقام توضيحية على بيانات افتراضية</span>
              </>
            ) : (
              <Skeleton h={160} />
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="h3 mb-2">البلاغات الأسبوعية حسب النوع</h2>
          <div className="grid grid-cols-4 gap-4">
            {TYPE_ORDER.map((ty) => (
              <div key={ty}>
                <div className="label muted">{TYPE_SHORT[ty]}</div>
                <div className="label muted mb-1 truncate" title={TYPE_FULL[ty]}>{TYPE_FULL[ty]}</div>
                <div style={{ height: 130 }} dir="ltr">
                  {k && (
                    <ResponsiveContainer>
                      <BarChart data={weeks.map((w) => ({ short: w.short, n: w.incidents[ty] }))} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                        <CartesianGrid stroke="var(--line)" vertical={false} />
                        <XAxis dataKey="short" tick={false} stroke="var(--line-strong)" />
                        <YAxis tick={AX} stroke="var(--line-strong)" allowDecimals={false} />
                        <Tooltip {...TIP} cursor={{ fill: 'var(--surface-raised)' }} />
                        <Bar dataKey="n" name="بلاغات" fill="var(--beacon)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
