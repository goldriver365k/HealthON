import type { DailySteps } from '@/types/domain';
import { toDateKey } from '@/utils/date';
import { formatSteps, groupSteps, startOfWeekMonday, stepsOn } from '../stats';

// 2026-11-04(수) 오후
const now = new Date(2026, 10, 4, 15, 0);
const d = (y: number, m: number, day: number, steps: number, source: 'real' | 'sample' = 'real'): DailySteps => ({
  date: toDateKey(new Date(y, m, day)),
  steps,
  source,
});

describe('만보기: 일별·주별·월별 묶기 (판정 없음)', () => {
  const data = [
    d(2026, 10, 4, 2000), // 오늘
    d(2026, 10, 3, 5000),
    d(2026, 10, 2, 7000), // 월요일
    d(2026, 10, 1, 4000), // 지난주 일요일
    d(2026, 9, 31, 3000, 'sample'),
    d(2026, 9, 1, 1000),
  ];

  it('일별: 오래된 날 → 오늘, 기록 없는 날은 0·평균 없음', () => {
    const b = groupSteps(data, 'day', now, 3);
    expect(b.map((x) => x.short)).toEqual(['2', '3', '4']);
    expect(b.map((x) => x.total)).toEqual([7000, 5000, 2000]);
    expect(groupSteps(data, 'day', now, 14)[0]).toMatchObject({ total: 0, average: null, daysRecorded: 0 });
  });

  it('주별: 월요일 시작, 이번 주는 오늘까지', () => {
    expect(toDateKey(startOfWeekMonday(now))).toBe('2026-11-02');
    expect(toDateKey(startOfWeekMonday(new Date(2026, 10, 1)))).toBe('2026-10-26'); // 일요일 → 그 주 월요일
    const [last, cur] = groupSteps(data, 'week', now, 2);
    expect(cur).toMatchObject({ key: '2026-11-02', total: 14000, daysRecorded: 3, average: 4667 });
    expect(last).toMatchObject({ key: '2026-10-26', total: 7000, daysRecorded: 2, hasSample: true });
    expect(cur.label).toBe('11/2(월) ~ 11/8(일)');
  });

  it('월별: 달 합계와 기록한 날 평균', () => {
    const [oct, nov] = groupSteps(data, 'month', now, 2);
    expect(oct).toMatchObject({ short: '10월', label: '2026년 10월', total: 4000, daysRecorded: 2, average: 2000 });
    expect(nov).toMatchObject({ short: '11월', total: 18000, daysRecorded: 4 });
  });

  it('오늘 걸음·숫자 표시', () => {
    expect(stepsOn(data, now)?.steps).toBe(2000);
    expect(stepsOn([], now)).toBeNull();
    expect(formatSteps(12345)).toBe('12,345');
  });
});
