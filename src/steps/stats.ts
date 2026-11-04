/**
 * 걸음 수 묶어 보기 (순수 함수 — 단위 테스트 대상).
 * - 일별: 최근 14일 / 주별(월~일): 최근 8주 / 월별: 최근 6달
 * - 합계와 '기록이 있는 날' 기준 하루 평균만 낸다. 많다·적다 판정은 하지 않는다.
 */
import type { DailySteps } from '@/types/domain';
import { addDays, addMonths, formatShortDate, startOfDay, toDateKey } from '@/utils/date';

export type StepUnit = 'day' | 'week' | 'month';

export const STEP_UNIT_COUNT: Record<StepUnit, number> = { day: 14, week: 8, month: 6 };

export interface StepBucket {
  /** 묶음 시작 날짜 'YYYY-MM-DD' */
  key: string;
  /** 막대 아래 짧은 이름: 일별 '4', 주별 '11/2~', 월별 '11월' */
  short: string;
  /** 목록에 보일 이름: '11/4(수)', '11/2(월) ~ 11/8(일)', '2026년 11월' */
  label: string;
  total: number;
  /** 기록이 있는 날 수 */
  daysRecorded: number;
  /** 기록이 있는 날 기준 하루 평균 (기록 없으면 null) */
  average: number | null;
  hasSample: boolean;
}

/** 월요일 0시 */
export function startOfWeekMonday(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

/** 오래된 것 → 최근 순서 */
export function groupSteps(daily: DailySteps[], unit: StepUnit, now: Date = new Date(), count = STEP_UNIT_COUNT[unit]): StepBucket[] {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const buckets: StepBucket[] = [];
  const today = startOfDay(now);

  for (let i = count - 1; i >= 0; i--) {
    let start: Date;
    let end: Date; // 다음 묶음 시작 (포함 안 함)
    let short: string;
    let label: string;
    if (unit === 'day') {
      start = addDays(today, -i);
      end = addDays(start, 1);
      short = String(start.getDate());
      label = formatShortDate(start);
    } else if (unit === 'week') {
      start = addDays(startOfWeekMonday(today), -7 * i);
      end = addDays(start, 7);
      short = `${start.getMonth() + 1}/${start.getDate()}~`;
      label = `${formatShortDate(start)} ~ ${formatShortDate(addDays(end, -1))}`;
    } else {
      start = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -i);
      end = addMonths(start, 1);
      short = `${start.getMonth() + 1}월`;
      label = `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
    }
    let total = 0;
    let daysRecorded = 0;
    let hasSample = false;
    for (let d = start; d < end && d <= today; d = addDays(d, 1)) {
      const item = byDate.get(toDateKey(d));
      if (!item) continue;
      total += item.steps;
      daysRecorded += 1;
      if (item.source === 'sample') hasSample = true;
    }
    buckets.push({
      key: toDateKey(start),
      short,
      label,
      total,
      daysRecorded,
      average: daysRecorded ? Math.round(total / daysRecorded) : null,
      hasSample,
    });
  }
  return buckets;
}

/** 오늘 걸음 (기록 없으면 null) */
export function stepsOn(daily: DailySteps[], day: Date): DailySteps | null {
  const key = toDateKey(day);
  return daily.find((d) => d.date === key) ?? null;
}

/** 12345 → '12,345' */
export function formatSteps(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
