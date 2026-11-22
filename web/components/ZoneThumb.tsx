import { cellToBoundary, gridDisk } from 'h3-js';

/** Small SVG of a zone and its neighbours, filled by risk level. No map tiles needed. */
export default function ZoneThumb({ h3, levelByH3, size = 132 }: { h3: string; levelByH3: Record<string, number>; size?: number }) {
  const cells = gridDisk(h3, 1);
  const polys = cells.map((c) => ({ c, pts: cellToBoundary(c).map(([lat, lng]) => [lng * 0.91, -lat] as [number, number]) }));
  const xs = polys.flatMap((p) => p.pts.map((q) => q[0]));
  const ys = polys.flatMap((p) => p.pts.map((q) => q[1]));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = (size - 8) / Math.max(x1 - x0, y1 - y0);
  const P = (q: [number, number]) => `${((q[0] - x0) * s + 4).toFixed(1)},${((q[1] - y0) * s + 4).toFixed(1)}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="خريطة مصغرة للمنطقة">
      <rect width={size} height={size} rx="10" fill="var(--bg-deep)" />
      {polys.map(({ c, pts }) => {
        const lv = levelByH3[c];
        const me = c === h3;
        return (
          <polygon
            key={c}
            points={pts.map(P).join(' ')}
            fill={lv ? `var(--risk-${lv})` : 'none'}
            stroke={me ? 'var(--info)' : 'var(--line)'}
            strokeWidth={me ? 2.5 : 1}
          />
        );
      })}
    </svg>
  );
}
