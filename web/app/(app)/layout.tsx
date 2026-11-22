'use client';
import AppShell from '@/components/AppShell';
import { DemoProvider } from '@/lib/state';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <AppShell>{children}</AppShell>
    </DemoProvider>
  );
}
