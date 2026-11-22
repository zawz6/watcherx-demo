import type { IncType, Level, ShiftKey } from './types';

export const TYPE_ORDER: IncType[] = ['theft', 'breakin', 'scrap', 'damage'];
export const TYPE_SHORT: Record<IncType, string> = { theft: 'سرقة', breakin: 'اقتحام', scrap: 'سكراب', damage: 'إتلاف' };
export const TYPE_FULL: Record<IncType, string> = {
  theft: 'سرقة الكيابل والمعادن',
  breakin: 'اقتحام المواقع الخالية أو قيد الإنشاء',
  scrap: 'أحواش ومستودعات السكراب المخالفة',
  damage: 'إتلاف ممتلكات «مدن»',
};
export const LEVEL_AR: Record<Level, string> = { 1: 'منخفض جداً', 2: 'منخفض', 3: 'متوسط', 4: 'مرتفع', 5: 'حرج' };
export const SHIFT_AR: Record<ShiftKey, string> = { morning: 'الصباحية', evening: 'المسائية', night: 'الليلية' };
export const SHIFT_HOURS: Record<ShiftKey, string> = { morning: '06:00–14:00', evening: '14:00–22:00', night: '22:00–06:00' };

export const zoneLabel = (id: string) => `المنطقة ${parseInt(id.slice(1), 10)}`;
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const num = (x: number, digits = 1) => x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
// wrapped in a bidi isolate so the sign stays attached to the number inside Arabic text
export const signed = (x: number, digits = 0, suffix = '') => `\u2066${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(digits)}${suffix}\u2069`;
