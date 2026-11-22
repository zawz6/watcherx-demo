import type { ForecastZone, IncType, Level } from './types';

/** Zone levels for the map. For one incident type, re-cut that type's probabilities with the same 60/20/10/6/4% split. */
export function levelsFor(zones: ForecastZone[], type: IncType | 'all'): Record<string, Level> {
  if (type === 'all') return Object.fromEntries(zones.map((z) => [z.id, z.level]));
  const vals = zones.map((z) => z.by_type[type]).sort((a, b) => a - b);
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  const cuts = [q(0.6), q(0.8), q(0.9), q(0.96)];
  return Object.fromEntries(zones.map((z) => [z.id, (1 + cuts.filter((c) => z.by_type[type] >= c && c > 0).length) as Level]));
}

export function mainType(z: ForecastZone): IncType {
  return (Object.entries(z.by_type) as [IncType, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

export function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ٟـ]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}
