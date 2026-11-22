'use client';
import { IconCheck, IconChevronDown, IconLoader2, IconX } from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import { LEVEL_AR } from '@/lib/labels';
import type { Level } from '@/lib/types';

const HEX = '12,1.5 21.5,7 21.5,17 12,22.5 2.5,17 2.5,7';

/** Hexagon-shaped risk chip. Levels 4-5 are solid fills; levels 1-3 are outline only. */
export function RiskBadge({ level, compact = false }: { level: Level; compact?: boolean }) {
  const solid = level >= 4;
  const textColor = level === 5 ? 'var(--on-risk-5)' : 'var(--on-beacon)';
  return (
    <span className="inline-flex items-center gap-1.5 label" style={{ color: 'var(--ink)' }}>
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
        <polygon points={HEX} fill={solid ? `var(--risk-${level})` : 'none'} stroke={solid ? 'none' : 'var(--beacon)'} strokeWidth="1.5" strokeLinejoin="round" />
        <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="600" fill={solid ? textColor : 'var(--ink)'} style={{ fontFamily: 'var(--font-sans)' }}>
          {level}
        </text>
      </svg>
      {!compact && LEVEL_AR[level]}
    </span>
  );
}

export function RiskLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`map-overlay flex items-center gap-3 px-3 py-2 ${className}`} aria-label="مستوى الخطورة">
      <span className="label muted">مستوى الخطورة</span>
      {([1, 2, 3, 4, 5] as Level[]).map((l) => (
        <span key={l} className="label flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-[3px]" style={{ background: `var(--risk-${l})`, outline: l <= 2 ? '1px solid var(--line-strong)' : 'none' }} />
          {LEVEL_AR[l]}
        </span>
      ))}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  unit,
  compare,
  good,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  compare?: string;
  good?: boolean;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-2" style={{ padding: 'var(--space-4)' }}>
      <div className="label muted">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="metric num" style={{ color: accent ? 'var(--beacon)' : 'var(--ink)' }}>
          {value}
        </span>
        {unit && <span className="small muted">{unit}</span>}
      </div>
      {compare && <span className={`chip ${good ? 'chip-patrol' : 'chip-alert'} num self-start`} style={{ whiteSpace: 'normal' }}>{compare}</span>}
      {hint && <div className="label muted">{hint}</div>}
    </div>
  );
}

export function AgentAvatar({ size = 32 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/watcherx-app-icon.svg" alt="" width={size} height={size} className="shrink-0" />;
}

export interface TraceStep {
  label: string;
  ms: number;
}

/** The tools the agent "called". Collapsible; steps can reveal one at a time (animate). */
export function AgentTrace({
  steps,
  defaultOpen = false,
  animate = false,
  onDone,
}: {
  steps: TraceStep[];
  defaultOpen?: boolean;
  animate?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen || animate);
  const [shown, setShown] = useState(animate ? 0 : steps.length);
  useEffect(() => {
    if (!animate) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      i += 1;
      setShown(i);
      if (i < steps.length) t = setTimeout(next, 300 + (steps[i - 1].ms % 200));
      else onDone?.();
    };
    t = setTimeout(next, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);
  const running = shown < steps.length;
  return (
    <div className="card-flat">
      <button className="flex w-full items-center gap-2 label" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="muted">أدوات الوكيل</span>
        {!open && (
          <span className="flex-1 truncate text-start small">
            {steps.slice(0, shown).map((s) => `${s.label} ✓`).join(' · ')}
          </span>
        )}
        {open && <span className="flex-1" />}
        <IconChevronDown size={16} stroke={1.5} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {steps.slice(0, shown + (running ? 1 : 0)).map((s, i) => {
            const done = i < shown;
            return (
              <li key={s.label} className="rise flex items-center gap-2 small">
                {done ? <IconCheck size={16} stroke={1.5} color="var(--patrol)" /> : <IconLoader2 size={16} stroke={1.5} className="animate-spin" color="var(--ink-muted)" />}
                <span style={{ color: done ? 'var(--ink)' : 'var(--ink-muted)' }}>{s.label}</span>
                {done && <span className="code muted ms-auto">{s.ms} ms</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type DecisionState = { status: 'pending' | 'approved' | 'rejected'; at?: string };

/** Agent suggestion: action, window, reasons, impact, and the three human decisions. */
export function SuggestionCard({
  title,
  window,
  reasons,
  impact,
  decision,
  onApprove,
  onEdit,
  onReject,
  approveLabel = 'اعتماد',
  approvedNote,
  children,
}: {
  title: string;
  window?: string;
  reasons: string[];
  impact?: string;
  decision: DecisionState;
  onApprove: () => void;
  onEdit?: () => void;
  onReject: () => void;
  approveLabel?: string;
  approvedNote?: string;
  children?: ReactNode;
}) {
  const rejected = decision.status === 'rejected';
  return (
    <div className="card rise flex flex-col gap-3" style={{ opacity: rejected ? 0.6 : 1 }}>
      <div className="flex items-start gap-3">
        <AgentAvatar />
        <div className="flex-1">
          <div className="h3">{title}</div>
          {window && (
            <div className="small muted mt-0.5">
              الفترة <span className="code">{window}</span>
            </div>
          )}
        </div>
        {decision.status === 'approved' && (
          <span className="chip chip-patrol">
            <IconCheck size={14} stroke={1.5} />
            {approvedNote ?? 'معتمد'} <span className="code">{decision.at}</span>
          </span>
        )}
        {rejected && (
          <span className="chip chip-outline">
            <IconX size={14} stroke={1.5} />
            مرفوض
          </span>
        )}
      </div>
      <div>
        <div className="label muted mb-1">الأسباب</div>
        <ul className="small flex list-disc flex-col gap-0.5 ps-5">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      {impact && <div className="small num" style={{ color: 'var(--ink)' }}>{impact}</div>}
      {children}
      {decision.status === 'pending' && (
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={onApprove}>
            {approveLabel}
          </button>
          {onEdit && (
            <button className="btn btn-outline" onClick={onEdit}>
              تعديل
            </button>
          )}
          <button className="btn btn-text" onClick={onReject}>
            رفض
          </button>
        </div>
      )}
    </div>
  );
}

export function ProbBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label muted w-14 shrink-0">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-[3px] bg-raised">
        <div className="h-full" style={{ width: `${Math.max(3, (value / max) * 100)}%`, background: 'var(--beacon)' }} />
      </div>
      <span className="label num w-12 text-end">{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

export function Skeleton({ h = 24, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} />;
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-6 pb-3 pt-5">
      <div>
        <h1 className="h2">{title}</h1>
        {sub && <p className="small muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
