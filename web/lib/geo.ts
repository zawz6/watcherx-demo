import type { Lonlat } from './types';

/** Deterministic small offset so incident dots in one zone don't stack. */
export function jitter(center: Lonlat, key: string): Lonlat {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = (h % 360) * (Math.PI / 180);
  const r = 0.0007 + ((h >> 8) % 100) / 100000;
  return [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r * 0.9];
}
