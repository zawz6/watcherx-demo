'use client';
import {
  IconBellRinging,
  IconCalendarStats,
  IconChartLine,
  IconChevronDown,
  IconFileText,
  IconFlame,
  IconMap2,
  IconMessageChatbot,
  IconRefresh,
  IconRoute,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useJson } from '@/lib/data';
import { useDemo } from '@/lib/state';
import type { Meta } from '@/lib/types';
import { T } from './T';

type Role = 'supervisor' | 'manager';
const ICON = { stroke: 1.5, size: 22 };

const NAV: Record<Role, { href: string; label: string; icon: ReactNode; badge?: boolean }[]> = {
  supervisor: [
    { href: '/supervisor/map/', label: 'خريطة الوردية', icon: <IconMap2 {...ICON} /> },
    { href: '/supervisor/plan/', label: 'خطة الدوريات', icon: <IconRoute {...ICON} /> },
    { href: '/supervisor/alerts/', label: 'التنبيهات المباشرة', icon: <IconBellRinging {...ICON} />, badge: true },
    { href: '/supervisor/ask/', label: 'اسأل الوكيل', icon: <IconMessageChatbot {...ICON} /> },
  ],
  manager: [
    { href: '/manager/forecast/', label: 'خريطة المخاطر 7 أيام', icon: <IconCalendarStats {...ICON} /> },
    { href: '/manager/performance/', label: 'الأداء', icon: <IconChartLine {...ICON} /> },
    { href: '/manager/hotspots/', label: 'البؤر المتكررة', icon: <IconFlame {...ICON} /> },
    { href: '/manager/brief/', label: 'الملخص الأسبوعي', icon: <IconFileText {...ICON} /> },
    { href: '/manager/ask/', label: 'اسأل الوكيل', icon: <IconMessageChatbot {...ICON} /> },
  ],
};
const ROLE_LABEL: Record<Role, string> = { supervisor: 'مشرف غرفة العمليات', manager: 'مدير أمن المدينة' };

function CitySwitcher({ meta }: { meta: Meta | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button className="btn btn-outline" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {meta?.city.name_ar ?? 'المدينة الصناعية الثانية بالرياض'}
        <IconChevronDown size={18} stroke={1.5} />
      </button>
      {open && (
        <ul role="listbox" className="map-overlay absolute z-50 mt-1 w-[320px] p-1 start-0">
          <li role="option" aria-selected className="flex items-center justify-between rounded-[6px] bg-raised px-3 py-2 text-beacon">
            المدينة الصناعية الثانية بالرياض
          </li>
          {(meta?.cities_soon_ar ?? []).map((c) => (
            <li key={c} role="option" aria-disabled className="flex items-center justify-between px-3 py-2 text-muted">
              {c}
              <span className="chip chip-outline">قريباً</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const role: Role = path.startsWith('/manager') ? 'manager' : 'supervisor';
  const meta = useJson<Meta>('meta');
  const { reset, resetKey, fired, alerts } = useDemo();
  const pending = fired.filter((id) => alerts[id]?.status === 'pending').length;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-6 border-b border-line bg-surface px-4" style={{ height: 'var(--header-h)' }}>
        <Link href="/supervisor/map/" aria-label="WatcherX">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/watcherx-lockup-on-dark.svg" alt="WatcherX" style={{ height: 28 }} />
        </Link>
        <CitySwitcher meta={meta} />
        <div className="ms-auto flex items-center gap-3">
          <span className="chip chip-outline"><T>{meta?.shift_chip_ar ?? 'الوردية الليلية · 22:00–06:00'}</T></span>
          <span className="label muted">
            آخر تحديث <span className="code">{meta?.last_update_ar ?? '21:40'}</span>
          </span>
          <span className="chip chip-patrol" title="كل البيانات في هذا العرض افتراضية">
            بيانات افتراضية
          </span>
          <div className="seg" role="group" aria-label="الدور">
            {(Object.keys(NAV) as Role[]).map((r) => (
              <Link
                key={r}
                href={NAV[r][0].href}
                aria-pressed={role === r}
                className="rounded-[4px] px-3 py-1 label no-underline"
                style={{ background: role === r ? 'var(--surface-raised)' : 'transparent', color: role === r ? 'var(--beacon)' : 'var(--ink-muted)' }}
              >
                {ROLE_LABEL[r]}
              </Link>
            ))}
          </div>
          <button className="btn btn-text btn-sm" onClick={reset} title="إعادة العرض إلى حالته الأولى">
            <IconRefresh size={18} stroke={1.5} />
            إعادة العرض
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="shrink-0 border-e border-line bg-surface p-3" style={{ width: 'var(--sidebar-w)' }} aria-label="التنقل">
          <div className="label muted px-3 pb-2 pt-1">{ROLE_LABEL[role]}</div>
          <ul className="flex flex-col gap-1">
            {NAV[role].map((n) => {
              const active = path === n.href || path === n.href.slice(0, -1);
              return (
                <li key={n.href}>
                  <Link href={n.href} className="nav-item" aria-current={active ? 'page' : undefined}>
                    {n.icon}
                    <span className="flex-1">{n.label}</span>
                    {n.badge && pending > 0 && <span className="chip chip-beacon num">{pending}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main key={resetKey} className="min-w-0 flex-1 overflow-auto bg-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
