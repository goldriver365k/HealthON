/// <reference types="jest" />
import {
  addDays,
  combineDateAndTime,
  formatLongDate,
  formatRelativeDate,
  formatShortDate,
  formatTimeOfDay,
  shiftTimeOfDay,
  toDateKey,
} from '../date';
import { eulReul } from '../labels';
import { checkPhone } from '../phone';
import { dailyValues, filterRecentDays, summarizePeriod } from '../stats';
import { checkText, parseDecimalInRange, parseIntInRange, RECHECK_MESSAGE } from '../validate';
import type { Measurement } from '@/types/domain';

describe('날짜 표시', () => {
  const d = new Date(2026, 10, 4, 8, 5); // 2026-11-04 수요일 08:05

  it('한국어 긴 날짜', () => expect(formatLongDate(d)).toBe('11월 4일 수요일'));
  it('짧은 날짜', () => expect(formatShortDate(d)).toBe('11/4(수)'));
  it('날짜 키', () => expect(toDateKey(d)).toBe('2026-11-04'));
  it('오전/오후 시각', () => {
    expect(formatTimeOfDay('08:05')).toBe('오전 8:05');
    expect(formatTimeOfDay('00:30')).toBe('오전 12:30');
    expect(formatTimeOfDay('12:00')).toBe('오후 12:00');
    expect(formatTimeOfDay('18:30')).toBe('오후 6:30');
  });
  it('오늘/어제/내일', () => {
    expect(formatRelativeDate(d, d)).toBe('오늘');
    expect(formatRelativeDate(addDays(d, -1), d)).toBe('어제');
    expect(formatRelativeDate(addDays(d, 1), d)).toBe('내일');
    expect(formatRelativeDate(addDays(d, 3), d)).toBe('11/7(토)');
  });
  it('시각 이동은 하루 안에서 순환', () => {
    expect(shiftTimeOfDay('23:45', 30)).toBe('00:15');
    expect(shiftTimeOfDay('00:10', -30)).toBe('23:40');
  });
  it('날짜 + 시각 합치기', () => {
    const c = combineDateAndTime(d, '21:30');
    expect([c.getHours(), c.getMinutes(), c.getDate()]).toEqual([21, 30, 4]);
  });
});

describe('입력 실수 검사 (건강 판정 아님)', () => {
  it('정상 범위 숫자 통과', () => expect(parseIntInRange('128', 'systolic')).toEqual({ ok: true, value: 128 }));
  it('불가능한 숫자는 다시 확인 안내', () =>
    expect(parseIntInRange('400', 'systolic')).toEqual({ ok: false, message: RECHECK_MESSAGE }));
  it('글자 섞이면 안내', () => expect(parseIntInRange('12a', 'glucose')).toMatchObject({ ok: false }));
  it('빈 칸: 필수면 안내, 선택이면 null', () => {
    expect(parseIntInRange('', 'pulse')).toMatchObject({ ok: false });
    expect(parseIntInRange('', 'pulse', false)).toBeNull();
  });
  it('체중 소수점 한 자리', () => {
    expect(parseDecimalInRange('62.5', 'weight')).toEqual({ ok: true, value: 62.5 });
    expect(parseDecimalInRange('62,5', 'weight')).toEqual({ ok: true, value: 62.5 });
    expect(parseDecimalInRange('62.55', 'weight')).toMatchObject({ ok: false });
  });
  it('글자 입력: 받침에 맞는 조사', () => {
    expect(checkText('', '약 이름', 40)).toBe('약 이름을 적어 주세요');
    expect(checkText('', '관계', 10)).toBe('관계를 적어 주세요');
    expect(checkText('가'.repeat(41), '약 이름', 40)).toBe('40자까지 적을 수 있어요');
  });
  it('전화번호', () => {
    expect(checkPhone('010-1234-5678')).toBeNull();
    expect(checkPhone('119')).not.toBeNull();
  });
  it('조사 붙이기', () => {
    expect(eulReul('관절약')).toBe('관절약을');
    expect(eulReul('영양제')).toBe('영양제를');
    expect(eulReul('Vitamin')).toBe('Vitamin을(를)');
  });
});

describe('기록 요약 (평균·최저·최고·기록한 날만)', () => {
  const now = new Date(2026, 10, 4, 20, 0);
  const at = (daysAgo: number, h = 8) => new Date(2026, 10, 4 - daysAgo, h, 0).toISOString();
  const data: Measurement[] = [
    { id: '1', kind: 'bp', systolic: 120, diastolic: 80, measuredAt: at(0), source: 'real' },
    { id: '2', kind: 'bp', systolic: 130, diastolic: 84, measuredAt: at(0, 20), source: 'real' },
    { id: '3', kind: 'bp', systolic: 140, diastolic: 90, measuredAt: at(6), source: 'real' },
    { id: '4', kind: 'bp', systolic: 150, diastolic: 95, measuredAt: at(7), source: 'real' }, // 7일 밖
    { id: '5', kind: 'weight', weightKg: 62.4, measuredAt: at(1), source: 'real' },
    { id: '6', kind: 'weight', weightKg: 62.7, measuredAt: at(2), source: 'real' },
  ];

  it('최근 7일 = 오늘 포함 7일', () => expect(filterRecentDays(data, 7, now).map((m) => m.id)).toEqual(['1', '2', '3', '5', '6']));
  it('혈압 7일 요약', () => {
    const s = summarizePeriod(data, 'bp', 7, now);
    expect(s.count).toBe(3);
    expect(s.daysRecorded).toBe(2);
    expect(s.primary).toEqual({ average: 130, min: 120, max: 140 });
    expect(s.secondary).toEqual({ average: 85, min: 80, max: 90 });
  });
  it('체중은 소수점 한 자리', () => expect(summarizePeriod(data, 'weight', 7, now).primary).toEqual({ average: 62.6, min: 62.4, max: 62.7 }));
  it('기록 없으면 요약 없음', () => expect(summarizePeriod(data, 'glucose', 7, now).primary).toBeNull());
  it('하루별 평균 (막대용)', () => {
    const v = dailyValues(data, 'bp', 7, now);
    expect(v).toHaveLength(7);
    expect(v[6]).toEqual({ dateKey: '2026-11-04', value: 125 });
    expect(v[5].value).toBeNull();
  });
});
