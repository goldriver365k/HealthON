/**
 * 어떤 알림을 언제 예약할지 계산 (순수 함수 — 단위 테스트 대상).
 * - 같은 시각·같은 요일의 약은 알림 하나로 묶는다 (아이폰 예약 알림 개수 제한 대비)
 * - 잠금화면에 보이는 문구는 기본적으로 약 이름을 숨긴다 (설정에서 바꿀 수 있음)
 * - ⚠ 알림 문구에 건강 판정·지시를 넣지 않는다 ("드실 시간이에요"만)
 */
import type { AppState } from '@/data/sampleData';
import { addDays, combineDateAndTime, startOfDay } from '@/utils/date';
import { doseSlotLabel } from '@/utils/labels';

export type PlannedNotification =
  | { kind: 'daily'; id: string; hour: number; minute: number; title: string; body: string }
  | { kind: 'weekly'; id: string; weekday: number; hour: number; minute: number; title: string; body: string }
  | { kind: 'date'; id: string; date: Date; title: string; body: string };

const APPOINTMENT_REMIND_DAY_BEFORE = '19:00';
const APPOINTMENT_REMIND_SAME_DAY = '08:00';
/** 앞으로 며칠 안의 병원 일정까지 예약할지 */
const APPOINTMENT_WINDOW_DAYS = 60;

export function planNotifications(state: AppState, now: Date = new Date()): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const settings = state.notificationSettings;

  if (settings.medsEnabled) {
    const activeMeds = new Map(state.medications.filter((m) => m.isActive).map((m) => [m.id, m]));
    // 시각 + 요일 묶음별로 모으기
    const groups = new Map<string, { time: string; days: number[]; labels: string[]; slots: Set<string> }>();
    for (const s of state.schedules) {
      const med = activeMeds.get(s.medicationId);
      if (!med || !s.remind) continue;
      const days = [...s.daysOfWeek].sort();
      const key = `${s.timeOfDay}|${days.join(',')}`;
      const g = groups.get(key) ?? { time: s.timeOfDay, days, labels: [], slots: new Set<string>() };
      g.labels.push(med.name);
      g.slots.add(doseSlotLabel[s.slot]);
      groups.set(key, g);
    }
    for (const [key, g] of groups) {
      const [hour, minute] = g.time.split(':').map(Number);
      const slotText = [...g.slots].join('·');
      const body = settings.showMedName ? `${slotText}: ${g.labels.join(', ')}` : `${slotText} 약을 확인해 주세요`;
      const title = '약 드실 시간이에요';
      if (g.days.length === 7) {
        out.push({ kind: 'daily', id: `med|${key}`, hour, minute, title, body });
      } else {
        for (const d of g.days) {
          // expo-notifications 요일: 1=일요일 … 7=토요일
          out.push({ kind: 'weekly', id: `med|${key}|${d}`, weekday: d + 1, hour, minute, title, body });
        }
      }
    }
  }

  if (settings.appointmentsEnabled) {
    const until = addDays(startOfDay(now), APPOINTMENT_WINDOW_DAYS).getTime();
    for (const a of state.appointments) {
      const visit = new Date(a.visitAt);
      if (a.remindBefore === 'none' || visit.getTime() > until) continue;
      const at =
        a.remindBefore === 'day_before'
          ? combineDateAndTime(addDays(startOfDay(visit), -1), APPOINTMENT_REMIND_DAY_BEFORE)
          : combineDateAndTime(startOfDay(visit), APPOINTMENT_REMIND_SAME_DAY);
      if (at.getTime() <= now.getTime()) continue;
      out.push({
        kind: 'date',
        id: `apt|${a.id}`,
        date: at,
        title: a.remindBefore === 'day_before' ? '내일 병원 가는 날이에요' : '오늘 병원 가는 날이에요',
        body: '오늘건강에서 일정과 물어볼 것을 확인해 보세요',
      });
    }
  }
  return out;
}
