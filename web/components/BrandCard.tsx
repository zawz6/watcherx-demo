/* Full-screen card for the first and last seconds of the demo video. */
export default function BrandCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid h-screen place-items-center" style={{ background: 'var(--bg-deep)' }}>
      <div className="flex flex-col items-center gap-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/watcherx-lockup-on-dark.svg" alt="WatcherX" style={{ height: 96 }} />
        {children}
      </div>
    </main>
  );
}
