/// <reference types="jest" />
import { reducer } from '@/data/reducer';
import { createSampleState } from '@/data/sampleData';
import { planNotifications } from '../plan';

const now = new Date(2026, 10, 4, 9, 0); // 수요일 09:00

describe('알림 계획', () => {
  const s = createSampleState(now);

  it('같은 시각의 약은 알림 하나로 묶음 (08:00 두 개 → 1개)', () => {
    const meds = planNotifications(s, now).filter((p) => p.id.startsWith('med|'));
    expect(meds.map((p) => (p.kind === 'daily' ? `${p.hour}:${p.minute}` : ''))).toEqual(['8:0', '12:30', '18:30']);
  });

  it('기본: 잠금화면에 약 이름 숨김', () => {
    const p = planNotifications(s, now).find((x) => x.id.startsWith('med|08:00'));
    expect(p?.body).toBe('아침 약을 확인해 주세요');
    expect(p?.body).not.toContain('예시');
  });

  it('설정하면 약 이름 보임', () => {
    const a = reducer(s, { type: 'settings/notifications', next: { ...s.notificationSettings, showMedName: true } });
    const p = planNotifications(a, now).find((x) => x.id.startsWith('med|08:00'));
    expect(p?.body).toContain('혈압약(예시)');
  });

  it('약 알림 끄기', () => {
    const a = reducer(s, { type: 'settings/notifications', next: { ...s.notificationSettings, medsEnabled: false } });
    expect(planNotifications(a, now).some((p) => p.id.startsWith('med|'))).toBe(false);
  });

  it('그만 먹는 약은 알림 없음', () => {
    const a = reducer(s, { type: 'medication/active', id: 's-med-3', isActive: false });
    expect(planNotifications(a, now).some((p) => p.kind === 'daily' && p.hour === 12)).toBe(false);
  });

  it('병원: 지난 시각 알림은 만들지 않음, 다음 주 일정은 전날 19시', () => {
    const apts = planNotifications(s, now).filter((p) => p.id.startsWith('apt|'));
    // 오늘 14시 일정은 '당일 08:00' 알림 → 이미 지남 → 없음
    expect(apts.map((p) => p.id)).toEqual(['apt|s-apt-2']);
    const p = apts[0];
    expect(p.kind === 'date' && [p.date.getDate(), p.date.getHours()]).toEqual([10, 19]);
    expect(p.title).toBe('🏥 내일은 병원 가는 날이에요');
    expect(p.body.startsWith('내일 ')).toBe(true);
  });

  it('요일 지정 약은 요일별 주간 알림 (1=일요일)', () => {
    const a = reducer(s, {
      type: 'hydrate',
      data: { schedules: [{ ...s.schedules[0], daysOfWeek: [1, 3] }] },
    });
    const p = planNotifications(a, now).filter((x) => x.kind === 'weekly');
    expect(p.map((x) => x.kind === 'weekly' && x.weekday)).toEqual([2, 4]);
  });

  it('알림 문구에 판정·지시 표현 없음', () => {
    const text = planNotifications(s, now).map((p) => p.title + p.body).join(' ');
    expect(text).not.toMatch(/정상|위험|높|낮|진단|처방|바꾸|늘리|줄이/);
  });
});
