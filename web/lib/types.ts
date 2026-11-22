export type Level = 1 | 2 | 3 | 4 | 5;
export type IncType = 'theft' | 'breakin' | 'scrap' | 'damage';
export type ShiftKey = 'morning' | 'evening' | 'night';
export type Lonlat = [number, number];

export interface Zone {
  id: string;
  num: number;
  h3: string;
  center: Lonlat;
  site_status: string;
  site_type: string;
  site_summary_ar: string;
  lighting_ok: boolean;
  broken_poles: number;
  fence_ok: boolean;
  dist_scrap_m: number;
  near_main_road: boolean;
  north: boolean;
  closed_since?: string;
  light_fault_since?: string;
}

export interface ForecastZone {
  id: string;
  risk: number;
  score: number;
  level: Level;
  by_type: Record<IncType, number>;
  reasons_ar: string[];
}

export interface NextShift {
  generated_at: string;
  default_shift: ShiftKey;
  cuts: number[];
  shifts: Record<ShiftKey, { date: string; label_ar: string; zones: ForecastZone[] }>;
}

export interface Forecast7Zone {
  id: string;
  avg_risk: number;
  level: Level;
  risk: number[];
  levels: Level[];
  change_pct: number;
  trend: 'rising' | 'falling' | 'flat';
  reasons_ar: string[];
}

export interface Forecast7 {
  generated_at: string;
  steps: { date: string; shift: ShiftKey }[];
  zones: Forecast7Zone[];
  city_daily: { date: string; label_ar: string; expected_incidents: number }[];
  rising_top5: { id: string; change_pct: number }[];
}

export interface Incident {
  id: string;
  type: IncType;
  zone: string;
  ts: string;
  shift: ShiftKey;
  source: string;
  note_ar: string;
}

export interface Segment {
  zone: string;
  start: string;
  end: string;
  level: Level;
}
export interface Car {
  id: string;
  segments: Segment[];
  path: Lonlat[];
}
export interface Kpis {
  coverage_high_risk_pct: number;
  avg_response_min: number;
  p90_response_min: number;
}
export interface PatternWarning {
  zone: string;
  car: string;
  time: string;
  nights: number;
  text_ar: string;
  alternatives: { time: string; variant: string }[];
}
export interface Plan {
  shift: string;
  cars: Car[];
  kpis: Kpis;
  pattern_warnings?: PatternWarning[];
  baseline_kpis?: Kpis;
  compare_with?: Kpis;
  lost_visits?: { zone: string; level: Level }[];
  slower_zones?: { zone: string; from_min: number; to_min: number }[];
  settings?: Record<string, unknown>;
}
export interface PlanVariants {
  four_cars: Plan;
  alternatives: { id: string; zone: string; plan: Plan }[];
  edit_options: { id: string; zone: string; from_car: string; to_car: string; label_ar: string; plan: Plan }[];
}

export interface RiskUpdate {
  zone: string;
  before: number;
  after: number;
  level_before: Level;
  level_after: Level;
}
export interface AlertEvent {
  id: string;
  time: string;
  zone: string;
  type: IncType;
  title_ar: string;
  toast_ar: string;
  note_ar: string;
  risk_updates: RiskUpdate[];
  suggestion: {
    car: string;
    car_num: number;
    eta_min: number;
    from: string;
    to: string;
    title_ar: string;
    reasons_ar: string[];
    impact_ar: string;
  };
  kpis_before: Kpis;
  kpis_after: Kpis;
  plan_after: Plan;
}

export interface Hotspot {
  id: string;
  zone: string;
  weeks_flagged: number;
  incidents_4w: number;
  weekly: number[];
  main_type: IncType;
  cause_ar: string;
  site_summary_ar: string;
  level_now: Level;
  level_after: Level;
  center: Lonlat;
  fix: { kind: string; text_ar: string; effect_ar: string; approved_ar: string };
}

export interface WeekKpi {
  label_ar: string;
  incidents: Record<'total' | IncType, number>;
  resp_current: number;
  resp_watcherx: number;
  p90_current: number;
  p90_watcherx: number;
  coverage_current: number;
  coverage_watcherx: number;
  approval_rate: number;
}
export interface KpiFile {
  weeks: WeekKpi[];
  tiles: {
    avg_response_min: { value: number; current_plan: number; change_pct: number };
    coverage_high_risk_pct: { value: number; current_plan: number; change_pts: number };
    incidents_30d: { value: number; previous: number; change_pct: number };
    approval_rate: { value: number; previous: number; change_pts: number };
  };
}
export interface Metrics {
  method: string;
  test_window: string;
  test_incidents: number;
  hit_rate_top10_model: number;
  hit_rate_top10_baseline: number;
  label_ar: string;
}

export interface Brief {
  title_ar: string;
  range_ar: string;
  author_ar: string;
  headline: { label_ar: string; value: number; unit_ar: string; delta_ar: string; good: boolean }[];
  intro_ar: string;
  changed_ar: string[];
  worked_ar: string[];
  decisions: { id: string; hotspot: string; text_ar: string; effect_ar: string }[];
}

export type Attachment =
  | { type: 'none' }
  | { type: 'plan_compare'; variant: string }
  | { type: 'zone_reasons'; zone: string; by_type: Record<IncType, number>; level: Level }
  | { type: 'zone_list'; zones: { zone: string; level: Level; in_plan: boolean }[] }
  | { type: 'scenario'; zone: string; before: number; after: number }
  | { type: 'table'; rows: { label_ar: string; now: number; prev: number }[] };

export interface ChatItem {
  q: string;
  keywords: string[];
  trace: { label: string; ms: number }[];
  answer_md: string;
  attachment: Attachment;
}

export interface Meta {
  city: { name_ar: string; center: Lonlat; zoom: number };
  cities_soon_ar: string[];
  last_update_ar: string;
  shift_chip_ar: string;
  live_alert_count: number;
}
