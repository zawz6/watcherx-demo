'use client';
import { useEffect, useState } from 'react';

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function load<T>(name: string): Promise<T> {
  if (cache.has(name)) return Promise.resolve(cache.get(name) as T);
  let p = inflight.get(name);
  if (!p) {
    p = fetch(`/data/${name}.json`)
      .then((r) => r.json())
      .then((j) => {
        cache.set(name, j);
        return j;
      });
    inflight.set(name, p);
  }
  return p as Promise<T>;
}

/** Fetch one generated JSON file from /data. Returns null until it has loaded. */
export function useJson<T>(name: string): T | null {
  const [data, setData] = useState<T | null>((cache.get(name) as T) ?? null);
  useEffect(() => {
    let live = true;
    load<T>(name).then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [name]);
  return data;
}
