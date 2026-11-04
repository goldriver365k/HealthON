/**
 * 기록 요약 계산. 평균·최저·최고·기록한 날 수만 계산한다.
 * ⚠ "정상/높음/위험" 같은 판정은 하지 않는다 (docs/MASTER_PLAN.md H-2 M3).
 */
import type { Measurement, MeasurementKind } from '@/types/domain';
import { addDays, startOfDay, toDateKey } from './date';

export interface SeriesSummary {
  average: number;
  min: number;
  max: number;
}

export interface PeriodSummary {
  kind: MeasurementKind;
  days: number;
  count: number;
  daysRecorded: number;
  /** bp: 위 숫자, glucose: 혈당, weight: 체중 */
  primary: SeriesSummary | null;
  /** bp만: 아래 숫자 */
  secondary: SeriesSummary | null;
}

function summarize(values: number[], decimals = 0): SeriesSummary | null {
  if (values.length === 0) return null;
  const f = 10 ** decimals;
  const round = (n: number) => Math.round(n * f) / f;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    average: round(sum / values.length),
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
  };
}

/** 오늘 포함 최근 N일 기록 */
export function filterRecentDays<T extends Measurement>(items: T[], days: number, now: Date = new Date()): T[] {
  const from = addDays(startOfDay(now), -(days - 1)).getTime();
  const to = addDays(startOfDay(now), 1).getTime();
  return items.filter((m) => {
    const t = new Date(m.measuredAt).getTime();
    return t >= from && t < to;
  });
}

export function summarizePeriod(
  all: Measurement[],
  kind: MeasurementKind,
  days: number,
  now: Date = new Date(),
): PeriodSummary {
  const items = filterRecentDays(
    all.filter((m) => m.kind === kind),
    days,
    now,
  );
  const daysRecorded = new Set(items.map((m) => toDateKey(new Date(m.measuredAt)))).size;
  let primary: SeriesSummary | null = null;
  let secondary: SeriesSummary | null = null;

  if (kind === 'bp') {
    const bp = items.filter((m) => m.kind === 'bp');
    primary = summarize(bp.map((m) => m.systolic));
    secondary = summarize(bp.map((m) => m.diastolic));
  } else if (kind === 'glucose') {
    primary = summarize(items.filter((m) => m.kind === 'glucose').map((m) => m.glucoseMgdl));
  } else {
    primary = summarize(
      items.filter((m) => m.kind === 'weight').map((m) => m.weightKg),
      1,
    );
  }

  return { kind, days, count: items.length, daysRecorded, primary, secondary };
}

/** 하루별 대표값(그날 첫 기록 아님, 평균) — 단순 막대용 */
export function dailyValues(
  all: Measurement[],
  kind: MeasurementKind,
  days: number,
  now: Date = new Date(),
): { dateKey: string; value: number | null }[] {
  const result: { dateKey: string; value: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(startOfDay(now), -i);
    const key = toDateKey(day);
    const vals = all
      .filter((m) => m.kind === kind && toDateKey(new Date(m.measuredAt)) === key)
      .map((m) => (m.kind === 'bp' ? m.systolic : m.kind === 'glucose' ? m.glucoseMgdl : m.weightKg));
    result.push({
      dateKey: key,
      value: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
    });
  }
  return result;
}
