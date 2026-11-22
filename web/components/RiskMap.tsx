'use client';
import { PathStyleExtension } from '@deck.gl/extensions';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import MapGL, { NavigationControl, useControl, type MapRef } from 'react-map-gl/maplibre';
import { riskColor, token, withAlpha } from '@/lib/colors';
import type { Lonlat, Zone } from '@/lib/types';
import { RiskLegend } from './widgets';

maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
const STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export interface Route {
  id: string;
  label: string;
  path: Lonlat[];
  mode?: 'normal' | 'dim' | 'selected';
}
export interface Pulse {
  center: Lonlat;
  t0: number;
}
export interface Focus {
  center: Lonlat;
  zoom?: number;
  nonce: number;
}

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay({ ...props, interleaved: false }));
  overlay.setProps(props);
  return null;
}

export default function RiskMap({
  zones,
  levels,
  boundary,
  selectedId,
  onSelect,
  routes = [],
  incidents = [],
  pulses = [],
  focus,
  fillTransition = 0,
  legend = true,
  children,
}: {
  zones: Zone[];
  levels: Record<string, number>;
  boundary: GeoJSON.Feature<GeoJSON.Polygon>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  routes?: Route[];
  incidents?: Lonlat[];
  pulses?: Pulse[];
  focus?: Focus | null;
  fillTransition?: number;
  legend?: boolean;
  children?: ReactNode;
}) {
  const mapRef = useRef<MapRef>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const ring = boundary.geometry.coordinates[0] as Lonlat[];
  const bounds = useMemo(() => {
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ] as [Lonlat, Lonlat];
  }, [ring]);

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: focus.center, zoom: focus.zoom ?? 14.6, duration: 900 });
  }, [focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pulses.length) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pulses.length]);

  const layers = [
    new H3HexagonLayer<Zone>({
      id: 'zones',
      data: zones,
      getHexagon: (z) => z.h3,
      extruded: false,
      filled: true,
      stroked: true,
      pickable: true,
      getFillColor: (z) => riskColor(levels[z.id] ?? 1),
      getLineColor: (z) => (z.id === selectedId ? token('info') : z.id === hoverId ? token('ink') : token('line')),
      getLineWidth: (z) => (z.id === selectedId ? 2.5 : 1),
      lineWidthUnits: 'pixels',
      updateTriggers: { getFillColor: [levels], getLineColor: [selectedId, hoverId], getLineWidth: [selectedId] },
      transitions: fillTransition ? { getFillColor: fillTransition } : undefined,
      onHover: (i) => setHoverId(i.object ? (i.object as Zone).id : null),
    }),
    new PathLayer<{ p: Lonlat[] }>({
      id: 'boundary',
      data: [{ p: ring }],
      getPath: (d) => d.p,
      getColor: token('line-strong'),
      getWidth: 1.5,
      widthUnits: 'pixels',
      extensions: [new PathStyleExtension({ dash: true })],
      ...({ getDashArray: [6, 4], dashJustified: true } as object),
    }),
    new ScatterplotLayer<Lonlat>({
      id: 'incidents',
      data: incidents,
      getPosition: (d) => d,
      getRadius: 4,
      radiusUnits: 'pixels',
      getFillColor: token('alert'),
    }),
    new PathLayer<Route>({
      id: 'routes',
      data: routes,
      getPath: (r) => r.path,
      getColor: (r) => withAlpha(token('patrol'), r.mode === 'dim' ? 0.4 : 1),
      getWidth: (r) => (r.mode === 'selected' ? 5 : 3),
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      updateTriggers: { getColor: [routes.map((r) => r.mode).join()], getWidth: [routes.map((r) => r.mode).join()] },
    }),
    new ScatterplotLayer<Route>({
      id: 'cars',
      data: routes,
      getPosition: (r) => r.path[0],
      getRadius: 10,
      radiusUnits: 'pixels',
      getFillColor: (r) => withAlpha(token('patrol'), r.mode === 'dim' ? 0.55 : 1),
      getLineColor: token('bg'),
      stroked: true,
      lineWidthMinPixels: 2,
      updateTriggers: { getFillColor: [routes.map((r) => r.mode).join()] },
    }),
    new TextLayer<Route>({
      id: 'car-labels',
      data: routes,
      getPosition: (r) => r.path[0],
      getText: (r) => r.label,
      getSize: 12,
      sizeUnits: 'pixels',
      getColor: token('bg'),
      fontFamily: 'IBM Plex Mono, monospace',
      fontWeight: 600,
      background: false,
    }),
    new ScatterplotLayer<Pulse>({
      id: 'pulses',
      data: pulses,
      getPosition: (p) => p.center,
      stroked: true,
      filled: false,
      radiusUnits: 'meters',
      getRadius: (p) => 60 + 340 * (((now - p.t0) % 1600) / 1600),
      getLineColor: (p) => withAlpha(token('alert'), 1 - (((now - p.t0) % 1600) / 1600)),
      lineWidthUnits: 'pixels',
      getLineWidth: 3,
      updateTriggers: { getRadius: [now], getLineColor: [now] },
    }),
  ];

  return (
    <div className="relative h-full w-full" style={{ background: 'var(--bg-deep)' }}>
      <MapGL
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={STYLE}
        initialViewState={{ bounds, fitBoundsOptions: { padding: 48 } }}
        style={{ width: '100%', height: '100%' }}
        dragRotate={false}
        touchPitch={false}
        attributionControl={{ compact: true }}
      >
        <DeckOverlay
          layers={layers}
          onClick={(info) => {
            if (info.object && (info.layer?.id === 'zones')) onSelect?.((info.object as Zone).id);
            else if (!info.object) onSelect?.(null);
          }}
          getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
        />
        <NavigationControl position="top-left" showCompass={false} />
      </MapGL>
      {legend && <RiskLegend className="absolute bottom-6 left-4 z-10" />}
      {children}
    </div>
  );
}
