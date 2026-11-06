/**
 * 어떤 알림을 언제 예약할지 계산 (순수 함수 — 단위 테스트 대상).
 * - 같은 시각·같은 요일의 약은 알림 하나로 묶는다 (아이폰 예약 알림 개수 제한 대비)
 * - 잠금화면에 보이는 문구는 기본적으로 약 이름을 숨긴다 (설정에서 바꿀 수 있음)
 * - ⚠ 알림 문구에 건강 판정·지시를 넣지 않는다 ("약 먹을 시간이에요"만)
 * - 병원 알림에는 병원 이름을 넣지 않는다 (잠금화면에 보일 수 있음), 시각만
 */
import type { AppState } from '@/data/sampleData';
import { addDays, combineDateAndTime, formatTime, startOfDay } from '@/utils/date';
import { doseSlotLabel } from '@/utils/labels';

/** 알림에 담아 두는 정보 — 알림이 오면 앱이 큰 알림창을 띄울 때 쓴다 (건강 수치 없음) */
export type ReminderData =
  | { kind: 'med'; time: string; scheduleIds: string[] }
  | { kind: 'apt'; appointmentId: string }
  | { kind: 'move' };

type Base = { id: string; title: string; body: string; data: ReminderData };
export type PlannedNotification =
  | (Base & { kind: 'daily'; hour: number; minute: number })
  | (Base & { kind: 'weekly'; weekday: number; hour: number; minute: number })
  | (Base & { kind: 'date'; date: Date });

/** 움직임 알림 설정 (기기에만 저장) */
export interface MoveSettings {
  enabled: boolean;
  /** 몇 시간마다 */
  intervalHours: 1 | 2;
  /** 알림을 보내는 시간대 (시, 24시간) */
  startHour: number;
  endHour: number;
}
export const defaultMoveSettings: MoveSettings = { enabled: false, intervalHours: 1, startHour: 10, endHour: 18 };

const APPOINTMENT_REMIND_DAY_BEFORE = '19:00';
const APPOINTMENT_REMIND_SAME_DAY = '08:00';
/** 앞으로 며칠 안의 병원 일정까지 예약할지 */
const APPOINTMENT_WINDOW_DAYS = 60;

export function planNotifications(state: AppState, now: Date = new Date(), move: MoveSettings = defaultMoveSettings): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const settings = state.notificationSettings;

  if (settings.medsEnabled) {
    const activeMeds = new Map(state.medications.filter((m) => m.isActive).map((m) => [m.id, m]));
    // 시각 + 요일 묶음별로 모으기
    const groups = new Map<string, { time: string; days: number[]; labels: string[]; slots: Set<string>; ids: string[] }>();
    for (const s of state.schedules) {
      const med = activeMeds.get(s.medicationId);
      if (!med || !s.remind) continue;
      const days = [...s.daysOfWeek].sort();
      const key = `${s.timeOfDay}|${days.join(',')}`;
      const g = groups.get(key) ?? { time: s.timeOfDay, days, labels: [], slots: new Set<string>(), ids: [] };
      g.labels.push(med.name);
      g.ids.push(s.id);
      g.slots.add(doseSlotLabel[s.slot]);
      groups.set(key, g);
    }
    for (const [key, g] of groups) {
      const [hour, minute] = g.time.split(':').map(Number);
      const slotText = [...g.slots].join('·');
      const body = settings.showMedName ? `${slotText}: ${g.labels.join(', ')}` : `${slotText} 약을 확인해 주세요`;
      const title = '💊 약 먹을 시간이에요';
      const data: ReminderData = { kind: 'med', time: g.time, scheduleIds: g.ids };
      if (g.days.length === 7) {
        out.push({ kind: 'daily', id: `med|${key}`, hour, minute, title, body, data });
      } else {
        for (const d of g.days) {
          // expo-notifications 요일: 1=일요일 … 7=토요일
          out.push({ kind: 'weekly', id: `med|${key}|${d}`, weekday: d + 1, hour, minute, title, body, data });
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
        title: a.remindBefore === 'day_before' ? '🏥 내일은 병원 가는 날이에요' : '🏥 오늘은 병원 가는 날이에요',
        body: `${a.remindBefore === 'day_before' ? '내일' : '오늘'} ${formatTime(visit)} · 오늘건강에서 일정과 물어볼 것을 확인해 보세요`,
        data: { kind: 'apt', appointmentId: a.id },
      });
    }
  }
  out.push(...planMoveReminders(move));
  return out;
}

/**
 * 움직임 알림: 시간대 안에서 정해진 간격마다 (예: 10시~18시, 1시간마다 → 11시, 12시 … 18시).
 * 앱이 닫혀 있으면 걸음을 확인할 수 없어 시간마다 보내고, 앱이 켜져 있으면 최근 1시간에 걸었을 때 건너뛴다.
 * ⚠ 권유 문구만. 건강 판정·지시 없음.
 */
export function planMoveReminders(move: MoveSettings): PlannedNotification[] {
  if (!move.enabled) return [];
  const out: PlannedNotification[] = [];
  for (let h = move.startHour + move.intervalHours; h <= move.endHour; h += move.intervalHours) {
    out.push({
      kind: 'daily',
      id: `move|${h}`,
      hour: h,
      minute: 0,
      title: '🚶 잠깐 움직여 볼까요?',
      body: '오래 앉아 계셨다면 잠깐 일어나서 걸어 보세요',
      data: { kind: 'move' },
    });
  }
  return out;
}
