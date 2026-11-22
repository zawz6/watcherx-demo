'use client';
import { IconCheck } from '@tabler/icons-react';
import { AgentAvatar, Skeleton } from '@/components/widgets';
import { useJson } from '@/lib/data';
import { useDemo } from '@/lib/state';
import type { Brief } from '@/lib/types';

export default function BriefPage() {
  const b = useJson<Brief>('weekly_brief');
  const { hotspots, decideHotspot } = useDemo();
  if (!b) return <div className="mx-auto max-w-[820px] p-8"><Skeleton h={300} /></div>;

  return (
    <article className="mx-auto max-w-[820px] px-6 py-8">
      <header className="mb-6 flex items-center gap-3">
        <AgentAvatar size={40} />
        <div>
          <div className="label muted">{b.author_ar}</div>
          <h1 className="h2">{b.title_ar}</h1>
        </div>
      </header>
      <p className="body muted mb-4">{b.intro_ar}</p>

      <div className="mb-8 grid grid-cols-3 gap-4">
        {b.headline.map((h, i) => (
          <div key={h.label_ar} className="card">
            <div className="label muted">{h.label_ar}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="metric num" style={{ color: i === 1 ? 'var(--beacon)' : 'var(--ink)' }}>
                {h.value}
                {h.unit_ar === '%' ? '%' : ''}
              </span>
              {h.unit_ar !== '%' && <span className="small muted">{h.unit_ar}</span>}
            </div>
            <span className={`chip ${h.good ? 'chip-patrol' : 'chip-alert'} mt-2 num`} style={{ whiteSpace: 'normal' }}>{h.delta_ar}</span>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <h2 className="h3 mb-2">ما الذي تغيّر</h2>
        <ul className="body flex list-disc flex-col gap-2 ps-6">{b.changed_ar.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
      <section className="mb-6">
        <h2 className="h3 mb-2">ما الذي نجح</h2>
        <ul className="body flex list-disc flex-col gap-2 ps-6">{b.worked_ar.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
      <section>
        <h2 className="h3 mb-2">قرارات مطلوبة منك</h2>
        <div className="flex flex-col gap-3">
          {b.decisions.map((d) => {
            const st = hotspots[d.hotspot] ?? { status: 'pending' as const };
            return (
              <div key={d.id} className="card flex items-center gap-4">
                <div className="flex-1">
                  <div className="body">{d.text_ar}.</div>
                  <div className="small muted">{d.effect_ar}.</div>
                </div>
                {st.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={() => decideHotspot(d.hotspot, 'approved')}>اعتماد</button>
                    <button className="btn btn-text" onClick={() => decideHotspot(d.hotspot, 'rejected')}>رفض</button>
                  </div>
                ) : st.status === 'approved' ? (
                  <span className="chip chip-patrol"><IconCheck size={14} stroke={1.5} /> معتمد <span className="code">{st.at}</span></span>
                ) : (
                  <span className="chip chip-outline">مرفوض</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </article>
  );
}
