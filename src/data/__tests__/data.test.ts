/// <reference types="jest" />
import { reducer } from '../reducer';
import { createEmptyState, createSampleState } from '../sampleData';
import { dosesForDate, intakeHistory, todayProgress } from '../selectors';
import { fromMeasurementInput, toMeasurement, toSchedule } from '../supabase/mappers';
import { toDateKey } from '@/utils/date';

const now = new Date(2026, 10, 4, 9, 0);

describe('예시 데이터', () => {
  const s = createSampleState(now);
  it('모든 예시 기록은 source=sample', () => {
    const all = [...s.measurements, ...s.medications, ...s.intakes, ...s.appointments, ...s.emergencyContacts];
    expect(all.every((x) => x.source === 'sample')).toBe(true);
  });
  it('오늘 먹을 약 4개, 시간순', () => {
    const d = dosesForDate(s, now);
    expect(d.map((x) => x.schedule.timeOfDay)).toEqual(['08:00', '08:00', '12:30', '18:30']);
  });
  it('오늘 할 일 = 약 4 + 혈압 1 + 혈당 1, 완료 3', () => expect(todayProgress(s, now)).toEqual({ total: 6, done: 3 }));
});

describe('상태 변경 (reducer)', () => {
  const s = createSampleState(now);
  const key = toDateKey(now);

  it('약 먹었어요 → 완료 수 증가, 취소 → 원래대로', () => {
    const a = reducer(s, { type: 'intake/set', scheduleId: 's-sch-3', date: key, status: 'taken' });
    expect(todayProgress(a, now).done).toBe(4);
    const b = reducer(a, { type: 'intake/clear', scheduleId: 's-sch-3', date: key });
    expect(todayProgress(b, now).done).toBe(3);
  });

  it('같은 날 두 번 눌러도 기록은 하나', () => {
    const a = reducer(s, { type: 'intake/set', scheduleId: 's-sch-3', date: key, status: 'taken' });
    const b = reducer(a, { type: 'intake/set', scheduleId: 's-sch-3', date: key, status: 'taken' });
    expect(b.intakes.filter((i) => i.scheduleId === 's-sch-3' && i.scheduledDate === key)).toHaveLength(1);
  });

  it('약 시간 수정: 그대로인 시간대는 확인 기록 유지', () => {
    const a = reducer(s, {
      type: 'medication/update',
      id: 's-med-2',
      input: { name: '당뇨약(예시)', schedules: [{ slot: 'morning', timeOfDay: '08:00' }] }, // 저녁 삭제
    });
    expect(a.schedules.filter((x) => x.medicationId === 's-med-2')).toHaveLength(1);
    expect(a.intakes.some((i) => i.scheduleId === 's-sch-2')).toBe(true); // 아침 기록 유지
    expect(a.intakes.some((i) => i.scheduleId === 's-sch-4')).toBe(false); // 저녁 기록 정리
  });

  it('약 지우기: 일정·확인 기록도 함께', () => {
    const a = reducer(s, { type: 'medication/delete', id: 's-med-2' });
    expect(a.schedules.some((x) => x.medicationId === 's-med-2')).toBe(false);
    expect(a.intakes.some((i) => i.scheduleId === 's-sch-2' || i.scheduleId === 's-sch-4')).toBe(false);
  });

  it('그만 먹는 약은 오늘 목록에서 빠짐', () => {
    const a = reducer(s, { type: 'medication/active', id: 's-med-3', isActive: false });
    expect(dosesForDate(a, now)).toHaveLength(3);
  });

  it('병원 일정 지우기: 질문 메모도 함께', () => {
    const a = reducer(s, { type: 'appointment/delete', id: 's-apt-2' });
    expect(a.questions.some((q) => q.appointmentId === 's-apt-2')).toBe(false);
  });

  it('가족 공유 철회: 상태 revoked + 공유 요약 삭제', () => {
    const a = reducer(s, { type: 'link/revoke', linkId: 's-link-3' });
    expect(a.familyLinks.find((l) => l.id === 's-link-3')?.status).toBe('revoked');
    expect(a.sharedSummaries).toHaveLength(0);
  });

  it('서버 데이터 채우기(hydrate)', () => {
    const a = reducer(createEmptyState(), { type: 'hydrate', data: { medications: s.medications } });
    expect(a.medications).toHaveLength(3);
    expect(a.measurements).toHaveLength(0);
  });

  it('예시로 되돌리기: 글씨 크기 유지', () => {
    const a = reducer(s, { type: 'settings/fontScale', scale: 1.3 });
    const b = reducer(a, { type: 'reset' });
    expect(b.settings.fontScale).toBe(1.3);
  });

  it('최근 7일 복약 현황', () => {
    // s-med-1: 매일 아침 1회, 오늘 포함 7일 모두 확인
    expect(intakeHistory(s, 's-med-1', 7, now)).toEqual({ total: 7, taken: 7 });
  });
});

describe('서버 행 ↔ 앱 데이터 변환', () => {
  it('혈압 행 변환', () => {
    const m = toMeasurement({
      id: 'x', kind: 'bp', systolic: 128, diastolic: 82, pulse: null, glucose_mgdl: null,
      measured_at: '2026-11-04T00:00:00Z', memo: null, source: 'real',
    });
    expect(m).toEqual({ id: 'x', kind: 'bp', systolic: 128, diastolic: 82, pulse: undefined, measuredAt: '2026-11-04T00:00:00Z', memo: undefined, source: 'real' });
  });
  it('체중 numeric 문자열 → 숫자', () => {
    const m = toMeasurement({ id: 'w', kind: 'weight', weight_kg: '62.4', measured_at: 't', source: 'real' });
    expect(m.kind === 'weight' && m.weightKg).toBe(62.4);
  });
  it('저장 행: 종류에 맞지 않는 칸은 null (DB 형식 검사와 일치)', () => {
    const row = fromMeasurementInput({ kind: 'glucose', glucoseMgdl: 104, glucoseTiming: 'fasting', measuredAt: 't' });
    expect(row).toMatchObject({ kind: 'glucose', glucose_mgdl: 104, systolic: null, diastolic: null, pulse: null, weight_kg: null });
    expect(row).not.toHaveProperty('user_id'); // 주인은 서버가 정함
  });
  it('시각 HH:MM:SS → HH:MM', () => {
    expect(toSchedule({ id: 's', medication_id: 'm', slot: 'morning', time_of_day: '08:00:00', days_of_week: [0, 1], remind: true }).timeOfDay).toBe('08:00');
  });
});
