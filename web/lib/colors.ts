// deck.gl needs numeric RGBA, so read the design tokens from CSS at runtime instead of hard-coding hex.
export type RGBA = [number, number, number, number];
const cache = new Map<string, RGBA>();

export function token(name: string): RGBA {
  const hit = cache.get(name);
  if (hit) return hit;
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  let c: RGBA = [255, 255, 255, 255];
  if (m) {
    const n = parseInt(m[1], 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) : 255];
  }
  cache.set(name, c);
  return c;
}

export const riskColor = (level: number): RGBA => token(`risk-${Math.min(5, Math.max(1, Math.round(level)))}`);
export const withAlpha = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], Math.round(a * 255)];
