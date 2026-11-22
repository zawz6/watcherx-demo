import BrandCard from '@/components/BrandCard';

export default function TitleCard() {
  return (
    <BrandCard>
      <p className="display" style={{ color: 'var(--ink)' }}>نرى الخطر قبل وقوعه</p>
      <p className="h3 muted">وكيل ذكي للتنبؤ بالحوادث الأمنية وتخطيط الدوريات في المدن الصناعية</p>
    </BrandCard>
  );
}
