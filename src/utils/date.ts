/**
 * 한국어 날짜·시각 표시 도구. 외부 날짜 라이브러리 없이 작성.
 * 모든 계산은 기기 현지 시간 기준.
 */
import type { DateKey, TimeOfDay } from '@/types/domain';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' */
export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → 그날 0시 Date */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function weekdayName(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

/** "11월 4일 수요일" */
export function formatLongDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${weekdayName(d)}요일`;
}

/** "11/4(수)" */
export function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdayName(d)})`;
}

/** "오늘", "어제", "내일" 또는 "11/4(수)" */
export function formatRelativeDate(d: Date, now: Date = new Date()): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return '오늘';
  if (diff === -1) return '어제';
  if (diff === 1) return '내일';
  return formatShortDate(d);
}

/** "오전 8:05", "오후 2:30" */
export function formatTime(d: Date): string {
  return formatTimeOfDay(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

/** 'HH:MM' → "오전 8:05" */
export function formatTimeOfDay(t: TimeOfDay): string {
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${pad(m)}`;
}

/** Date → 'HH:MM' */
export function toTimeOfDay(d: Date): TimeOfDay {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'HH:MM' 에 분 더하기 (하루 안에서 순환) */
export function shiftTimeOfDay(t: TimeOfDay, minutes: number): TimeOfDay {
  const [h, m] = t.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** 특정 날짜에 'HH:MM' 시각을 붙인 Date */
export function combineDateAndTime(day: Date, t: TimeOfDay): Date {
  const [h, m] = t.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}
