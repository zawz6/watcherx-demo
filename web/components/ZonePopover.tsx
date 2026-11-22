'use client';
import { IconX } from '@tabler/icons-react';
import { TYPE_ORDER, TYPE_SHORT, zoneLabel } from '@/lib/labels';
import type { ForecastZone, Incident, Zone } from '@/lib/types';
import { ProbBar, RiskBadge } from './widgets';

export default function ZonePopover({
  zone,
  forecast,
  incidents,
  onClose,
  extra,
}: {
  zone: Zone;
  forecast: ForecastZone;
  incidents: Incident[];
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const last3 = incidents
    .filter((i) => i.zone === zone.id)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 3);
  const max = Math.max(...TYPE_ORDER.map((t) => forecast.by_type[t]), 0.001);
  return (
    <div className="map-overlay rise flex w-[340px] flex-col gap-3 p-4" role="dialog" aria-label={zoneLabel(zone.id)}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="h3">{zoneLabel(zone.id)}</h3>
            <span className="code muted">{zone.id}</span>
          </div>
          <div className="small muted">{zone.site_summary_ar}</div>
        </div>
        <button className="btn btn-text btn-sm" onClick={onClose} aria-label="إغلاق">
          <IconX size={18} stroke={1.5} />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <RiskBadge level={forecast.level} />
        <span className="label muted">
          مؤشر الخطورة <span className="num" style={{ color: 'var(--ink)' }}>{forecast.score}</span> / 100
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="label muted">احتمال كل نوع في هذه الوردية</div>
        {TYPE_ORDER.map((t) => (
          <ProbBar key={t} label={TYPE_SHORT[t]} value={forecast.by_type[t]} max={max} />
        ))}
      </div>
      <div>
        <div className="label muted mb-1">الأسباب</div>
        <ul className="small flex list-disc flex-col gap-0.5 ps-5">
          {forecast.reasons_ar.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      {extra}
      <div>
        <div className="label muted mb-1">آخر البلاغات</div>
        {last3.length === 0 ? (
          <div className="small muted">لا بلاغات مسجلة.</div>
        ) : (
          <ul className="small flex flex-col gap-0.5">
            {last3.map((i) => (
              <li key={i.id} className="flex gap-2">
                <span className="code muted">{i.ts.slice(5, 10)}</span>
                <span>{i.note_ar}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
