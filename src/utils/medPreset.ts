/**
 * 약 봉투에 적힌 대로 고르기: "하루 3번, 식후 30분" → 아침·점심·저녁 시간 채우기 (순수 함수).
 * ⚠ 앱이 복용법을 정하거나 권하지 않는다. 사용자가 봉투에 적힌 대로 고른 것을 시간으로 옮길 뿐.
 */
import type { DoseSlot } from '@/types/domain';
import { shiftTimeOfDay } from './date';

export type FixedSlot = Exclude<DoseSlot, 'custom'>;
export type TimesPerDay = '1' | '2' | '3';
export type MealTiming = 'before30' | 'right_after' | 'after30';

export const timesPerDayLabel: Record<TimesPerDay, string> = { '1': '하루 1번', '2': '하루 2번', '3': '하루 3번' };
export const mealTimingLabel: Record<MealTiming, string> = {
  before30: '식사 전 30분',
  right_after: '식사 바로 뒤',
  after30: '식사 후 30분',
};

/** 하루 몇 번 → 어느 때 (봉투에 따로 적혀 있으면 아래 '언제 드세요'에서 바꿀 수 있음) */
export const slotsForTimesPerDay: Record<TimesPerDay, FixedSlot[]> = {
  '1': ['morning'],
  '2': ['morning', 'evening'],
  '3': ['morning', 'noon', 'evening'],
};

/** 식사 시각 기준 (아침 7:30, 점심 12:00, 저녁 6:00) */
const MEAL_TIME: Record<Exclude<FixedSlot, 'bedtime'>, string> = { morning: '07:30', noon: '12:00', evening: '18:00' };
const MEAL_OFFSET: Record<MealTiming, number> = { before30: -30, right_after: 0, after30: 30 };

export function mealSlotTime(slot: FixedSlot, meal: MealTiming): string | null {
  if (slot === 'bedtime') return null; // 자기 전은 식사와 관계없음
  return shiftTimeOfDay(MEAL_TIME[slot], MEAL_OFFSET[meal]);
}

/**
 * 고른 대로 시간표 만들기. 이미 고른 '자기 전'은 그대로 둔다.
 * timesPerDay가 없으면 지금 골라진 아침·점심·저녁의 시간만 식사 기준으로 바꾼다.
 */
export function applyEnvelope(
  current: Partial<Record<FixedSlot, string>>,
  timesPerDay: TimesPerDay | null,
  meal: MealTiming | null,
): Partial<Record<FixedSlot, string>> {
  const m = meal ?? 'after30';
  const next: Partial<Record<FixedSlot, string>> = {};
  const slots: FixedSlot[] = timesPerDay
    ? slotsForTimesPerDay[timesPerDay]
    : (['morning', 'noon', 'evening'] as FixedSlot[]).filter((s) => current[s]);
  for (const s of slots) next[s] = meal ? mealSlotTime(s, m)! : (current[s] ?? mealSlotTime(s, m)!);
  if (current.bedtime) next.bedtime = current.bedtime;
  return next;
}

/** 메모에 남길 글: "하루 3번 · 식사 후 30분" */
export function envelopeMemo(timesPerDay: TimesPerDay | null, meal: MealTiming | null): string {
  return [timesPerDay ? timesPerDayLabel[timesPerDay] : null, meal ? mealTimingLabel[meal] : null].filter(Boolean).join(' · ');
}
