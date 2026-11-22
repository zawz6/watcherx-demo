import { Fragment } from 'react';

const RANGE = /(\d{1,2}:\d{2}(?:[–-]\d{1,2}:\d{2})?)/g;

/** Keeps times and time ranges left-to-right inside Arabic text so "22:00–06:00" doesn't flip. */
export function T({ children }: { children: string }) {
  return (
    <>
      {children.split(RANGE).map((part, i) =>
        i % 2 === 1 ? (
          <bdi key={i} dir="ltr" className="num">
            {part}
          </bdi>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
