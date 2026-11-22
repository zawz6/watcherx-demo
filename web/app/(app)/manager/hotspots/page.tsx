'use client';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import ZoneThumb from '@/components/ZoneThumb';
import { AgentAvatar, PageHeader, RiskBadge, Skeleton } from '@/components/widgets';
import { useJson } from '@/lib/data';
import { TYPE_FULL, zoneLabel } from '@/lib/labels';
import { useDemo } from '@/lib/state';
import type { Hotspot, NextShift, Zone } from '@/lib/types';

export default function HotspotsPage() {
  const hs = useJson<Hotspot[]>('hotspots');
  const zones = useJson<Zone[]>('zones');
  const fc = useJson<NextShift>('forecast_next_shift');
  const { hotspots, decideHotspot } = useDemo();

  const levelByH3 = useMemo(() => {
    const lv = Object.fromEntries((fc?.shifts.night.zones ?? []).map((z) => [z.id, z.level]));
    return Object.fromEntries((zones ?? []).map((z) => [z.h3, lv[z.id]]));
  }, [zones, fc]);
  const h3Of = useMemo(() => Object.fromEntries((zones ?? []).map((z) => [z.id, z.h3])), [zones]);

  return (
    <div className="pb-8">
      <PageHeader title="البؤر المتكررة" sub="مناطق تكررت فيها البلاغات في 3 من آخر 4 أسابيع، مع إجراء دائم مقترح لكل منها." />
      <div className="grid grid-cols-2 gap-4 px-6">
        {!hs && <Skeleton h={260} />}
        {hs?.map((h) => {
          const d = hotspots[h.id] ?? { status: 'pending' as const };
          return (
            <article key={h.id} className="card flex flex-col gap-3" style={{ opacity: d.status === 'rejected' ? 0.6 : 1 }}>
              <div className="flex gap-4">
                {h3Of[h.zone] && <ZoneThumb h3={h3Of[h.zone]} levelByH3={levelByH3} />}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="h3">{zoneLabel(h.zone)}</h2>
                    <span className="code muted">{h.zone}</span>
                    <span className="chip chip-outline ms-auto num">{h.weeks_flagged} من 4 أسابيع</span>
                  </div>
                  <div className="small muted">{h.site_summary_ar}</div>
                  <div className="flex items-center gap-2 small">
                    <RiskBadge level={h.level_now} compact /> <span className="muted">←</span> <RiskBadge level={h.level_after} compact />
                    <span className="label muted">بعد الإجراء</span>
                  </div>
                  <div className="label muted">{TYPE_FULL[h.main_type]}</div>
                  <div className="label muted">البلاغات الأسبوعية (آخر 12 أسبوعاً)</div>
                  <div style={{ height: 44 }} dir="ltr" aria-label="البلاغات الأسبوعية">
                    <ResponsiveContainer>
                      <BarChart data={h.weekly.map((n, i) => ({ i, n }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                        <XAxis dataKey="i" hide />
                        <Tooltip cursor={{ fill: 'var(--surface-raised)' }} contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 6 }} formatter={(v) => [v, 'بلاغات']} labelFormatter={() => ''} />
                        <Bar dataKey="n" fill="var(--beacon)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="small"><span className="muted">السبب الرئيسي: </span>{h.cause_ar}</div>
              <div className="card-flat flex flex-col gap-1.5">
                <div className="flex items-center gap-2 label muted"><AgentAvatar size={20} /> إجراء مقترح</div>
                <div className="body">{h.fix.text_ar}.</div>
                <div className="small muted">{h.fix.effect_ar}.</div>
              </div>
              {d.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button className="btn btn-primary" onClick={() => decideHotspot(h.id, 'approved')}>اعتماد</button>
                  <button className="btn btn-text" onClick={() => decideHotspot(h.id, 'rejected')}>رفض</button>
                </div>
              )}
              {d.status === 'approved' && <span className="chip chip-patrol self-start"><IconCheck size={14} stroke={1.5} /> {h.fix.approved_ar} <span className="code">{d.at}</span></span>}
              {d.status === 'rejected' && <span className="chip chip-outline self-start"><IconX size={14} stroke={1.5} /> مرفوض</span>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
