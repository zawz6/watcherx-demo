'use client';
import { IconSend } from '@tabler/icons-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useJson } from '@/lib/data';
import { TYPE_ORDER, TYPE_SHORT, num, signed, zoneLabel } from '@/lib/labels';
import { normalizeAr } from '@/lib/risk';
import type { Attachment, ChatItem, PlanVariants } from '@/lib/types';
import { AgentAvatar, AgentTrace, ProbBar, RiskBadge } from './widgets';

interface Msg {
  id: number;
  role: 'user' | 'agent';
  text?: string;
  item?: ChatItem;
  phase?: 'typing' | 'trace' | 'done';
}

const FALLBACK = 'في هذا العرض التجريبي أستطيع الإجابة عن الأسئلة المقترحة.';
const WELCOME = 'مرحباً، أنا وكيل WatcherX. أجيب عن الخطورة والدوريات والأداء، وأعرض دائماً الأدوات التي استخدمتها. القرار يبقى لك.';

function Md({ text }: { text: string }) {
  const blocks: ({ type: 'p'; t: string } | { type: 'ul'; items: string[] })[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('- ')) {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'ul') last.items.push(line.slice(2));
      else blocks.push({ type: 'ul', items: [line.slice(2)] });
    } else blocks.push({ type: 'p', t: line });
  }
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
  return (
    <div className="md body">
      {blocks.map((b, i) =>
        b.type === 'p' ? (
          <p key={i}>{inline(b.t)}</p>
        ) : (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function CompareRow({ label, a, b, unit, lowerIsBetter }: { label: string; a: number; b: number; unit: string; lowerIsBetter: boolean }) {
  const diff = b - a;
  const good = lowerIsBetter ? diff <= 0 : diff >= 0;
  return (
    <tr className="border-t border-line">
      <td className="py-2 small">{label}</td>
      <td className="num small">{unit === '%' ? a.toFixed(0) : num(a)} {unit}</td>
      <td className="num small">{unit === '%' ? b.toFixed(0) : num(b)} {unit}</td>
      <td>
        <span className={`chip ${good ? 'chip-patrol' : 'chip-alert'} num`}>{signed(diff, unit === '%' ? 0 : 1)}</span>
      </td>
    </tr>
  );
}

function AttachmentView({ a }: { a: Attachment }) {
  const variants = useJson<PlanVariants>('plan_variants');
  if (a.type === 'none') return null;
  if (a.type === 'plan_compare') {
    const v = variants?.four_cars;
    if (!v?.compare_with) return null;
    return (
      <div className="card-flat mt-3">
        <table className="w-full text-start">
          <thead>
            <tr className="label muted text-start">
              <th className="text-start font-medium">المؤشر</th>
              <th className="text-start font-medium">6 دوريات</th>
              <th className="text-start font-medium">4 دوريات</th>
              <th className="text-start font-medium">الفرق</th>
            </tr>
          </thead>
          <tbody>
            <CompareRow label="تغطية المناطق عالية الخطورة" a={v.compare_with.coverage_high_risk_pct} b={v.kpis.coverage_high_risk_pct} unit="%" lowerIsBetter={false} />
            <CompareRow label="متوسط زمن الاستجابة" a={v.compare_with.avg_response_min} b={v.kpis.avg_response_min} unit="د" lowerIsBetter />
            <CompareRow label="زمن الاستجابة لأسوأ 10%" a={v.compare_with.p90_response_min} b={v.kpis.p90_response_min} unit="د" lowerIsBetter />
          </tbody>
        </table>
        <div className="label muted mt-2">أرقام توضيحية على بيانات افتراضية</div>
      </div>
    );
  }
  if (a.type === 'zone_reasons') {
    const max = Math.max(...TYPE_ORDER.map((t) => a.by_type[t]), 0.001);
    return (
      <div className="card-flat mt-3 flex flex-col gap-1.5">
        <div className="mb-1 flex items-center gap-2">
          <span className="body font-semibold">{zoneLabel(a.zone)}</span>
          <RiskBadge level={a.level} />
        </div>
        {TYPE_ORDER.map((t) => (
          <ProbBar key={t} label={TYPE_SHORT[t]} value={a.by_type[t]} max={max} />
        ))}
      </div>
    );
  }
  if (a.type === 'zone_list') {
    return (
      <ul className="card-flat mt-3 flex flex-col gap-1.5">
        {a.zones.map((z) => (
          <li key={z.zone} className="flex items-center gap-3 small">
            <RiskBadge level={z.level} compact />
            <span className="flex-1">{zoneLabel(z.zone)}</span>
            <span className={`chip ${z.in_plan ? 'chip-patrol' : 'chip-outline'}`}>{z.in_plan ? 'ضمن خطة الليلة' : 'خارج الخطة'}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (a.type === 'scenario') {
    const max = Math.max(a.before, a.after);
    return (
      <div className="card-flat mt-3 flex flex-col gap-1.5">
        <ProbBar label="الآن" value={a.before} max={max} />
        <ProbBar label="بعد الإصلاح" value={a.after} max={max} />
      </div>
    );
  }
  return (
    <div className="card-flat mt-3">
      <table className="w-full">
        <thead>
          <tr className="label muted">
            <th className="text-start font-medium">المؤشر</th>
            <th className="text-start font-medium">آخر 4 أسابيع</th>
            <th className="text-start font-medium">قبلها</th>
            <th className="text-start font-medium">التغير</th>
          </tr>
        </thead>
        <tbody>
          {a.rows.map((r) => {
            const lower = r.label_ar.includes('زمن');
            const diff = r.now - r.prev;
            const good = r.label_ar.includes('البلاغات') || lower ? diff <= 0 : diff >= 0;
            return (
              <tr key={r.label_ar} className="border-t border-line">
                <td className="py-2 small">{r.label_ar}</td>
                <td className="num small">{r.now}</td>
                <td className="num small muted">{r.prev}</td>
                <td>
                  <span className={`chip ${good ? 'chip-patrol' : 'chip-alert'} num`}>{signed(diff, Number.isInteger(diff) ? 0 : 1)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ChatPanel({ items, title }: { items: ChatItem[]; title: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: 'agent', text: WELCOME, phase: 'done' }]);
  const [input, setInput] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const busy = msgs.some((m) => m.phase && m.phase !== 'done');
  const seq = useRef(1);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs]);

  const match = (q: string): ChatItem | null => {
    const exact = items.find((i) => i.q === q);
    if (exact) return exact;
    const n = normalizeAr(q);
    let best: ChatItem | null = null;
    let bestScore = 0;
    for (const it of items) {
      const score = it.keywords.filter((k) => n.includes(normalizeAr(k))).length;
      if (score > bestScore) {
        best = it;
        bestScore = score;
      }
    }
    return bestScore >= 2 ? best : null;
  };

  const ask = (q: string) => {
    if (!q.trim() || busy) return;
    const item = match(q.trim());
    const id = seq.current++;
    setMsgs((m) => [...m, { id, role: 'user', text: q.trim() }, { id: id + 1000, role: 'agent', item: item ?? undefined, text: item ? undefined : FALLBACK, phase: 'typing' }]);
    setInput('');
    const aid = id + 1000;
    setTimeout(() => setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, phase: item ? 'trace' : 'done' } : x))), 650);
  };
  const finish = (aid: number) => setTimeout(() => setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, phase: 'done' } : x))), 350);

  return (
    <div className="mx-auto flex h-full max-w-[900px] flex-col px-6">
      <div className="pb-2 pt-5">
        <h1 className="h2">{title}</h1>
        <p className="small muted">اسأل بلغة عادية. كل إجابة تعرض الأدوات التي استخدمها الوكيل.</p>
      </div>
      <div className="flex-1 space-y-4 overflow-auto py-3">
        {msgs.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="rise flex justify-start">
              <div className="max-w-[75%] rounded-[10px] bg-raised px-4 py-2.5 body">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="rise flex items-start justify-end gap-3">
              <div className="max-w-[82%] flex-1 space-y-2" style={{ maxWidth: '82%' }}>
                {m.phase === 'typing' && (
                  <div className="card flex items-center gap-1.5 self-start" style={{ width: 'fit-content' }} aria-label="الوكيل يكتب">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                )}
                {m.item && m.phase !== 'typing' && (
                  <AgentTrace steps={m.item.trace} animate={m.phase === 'trace'} onDone={() => finish(m.id)} />
                )}
                {(m.phase === 'done' || (!m.item && m.phase !== 'typing')) && (
                  <div className="card rise">
                    <Md text={m.item ? m.item.answer_md : (m.text ?? '')} />
                    {m.item && <AttachmentView a={m.item.attachment} />}
                  </div>
                )}
              </div>
              <AgentAvatar />
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      <div className="space-y-2 pb-5">
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <button key={i.q} className="chip-btn" disabled={busy} onClick={() => ask(i.q)}>
              {i.q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب سؤالك هنا"
            aria-label="سؤال للوكيل"
            className="h-11 flex-1 rounded-[6px] border border-strong bg-raised px-3 body outline-none focus:border-info"
          />
          <button type="submit" className="btn btn-primary" style={{ height: 44 }} disabled={busy || !input.trim()}>
            <IconSend size={18} stroke={1.5} style={{ transform: 'scaleX(-1)' }} />
            إرسال
          </button>
        </form>
      </div>
    </div>
  );
}
