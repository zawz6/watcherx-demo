import BrandCard from '@/components/BrandCard';

export default function EndCard() {
  return (
    <BrandCard>
      <p className="display" style={{ color: 'var(--ink)' }}>نرى الخطر قبل وقوعه</p>
      <p className="h3">فريق WatcherX · agentX الرياض</p>
      <p className="label muted">بيانات افتراضية لأغراض العرض</p>
    </BrandCard>
  );
}
