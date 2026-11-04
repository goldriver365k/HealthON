/**
 * 화면에서 쓰는 데이터 계산 (순수 함수 — 2단계 단위 테스트 대상).
 */
import type {
  Appointment,
  Measurement,
  MeasurementKind,
  Medication,
  MedicationIntake,
  MedicationSchedule,
} from '@/types/domain';
import { isSameDay, startOfDay, toDateKey } from '@/utils/date';
import type { AppState } from './sampleData';

export interface DoseItem {
  schedule: MedicationSchedule;
  medication: Medication;
  intake?: MedicationIntake;
}

/** 특정 날짜에 먹을 약 목록 (시간순) */
export function dosesForDate(state: AppState, date: Date): DoseItem[] {
  const key = toDateKey(date);
  const weekday = date.getDay();
  const medById = new Map(state.medications.map((m) => [m.id, m]));
  return state.schedules
    .filter((s) => s.daysOfWeek.includes(weekday))
    .map((schedule) => ({ schedule, medication: medById.get(schedule.medicationId) }))
    .filter((d): d is { schedule: MedicationSchedule; medication: Medication } => !!d.medication?.isActive)
    .map((d) => ({
      ...d,
      intake: state.intakes.find((i) => i.scheduleId === d.schedule.id && i.scheduledDate === key),
    }))
    .sort((a, b) => a.schedule.timeOfDay.localeCompare(b.schedule.timeOfDay) || a.medication.name.localeCompare(b.medication.name));
}

/** 종류별 기록 (최신순) */
export function measurementsOf<K extends MeasurementKind>(
  state: AppState,
  kind: K,
): Extract<Measurement, { kind: K }>[] {
  return state.measurements
    .filter((m): m is Extract<Measurement, { kind: K }> => m.kind === kind)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
}

/** 그날 가장 최근 기록 */
export function latestOnDate<K extends MeasurementKind>(
  state: AppState,
  kind: K,
  date: Date,
): Extract<Measurement, { kind: K }> | undefined {
  return measurementsOf(state, kind).find((m) => isSameDay(new Date(m.measuredAt), date));
}

export function appointmentsOnDate(state: AppState, date: Date): Appointment[] {
  return state.appointments
    .filter((a) => isSameDay(new Date(a.visitAt), date))
    .sort((a, b) => a.visitAt.localeCompare(b.visitAt));
}

/** 오늘 이후 일정 (오늘 포함, 시간순) */
export function upcomingAppointments(state: AppState, now: Date): Appointment[] {
  const from = startOfDay(now).getTime();
  return state.appointments
    .filter((a) => new Date(a.visitAt).getTime() >= from)
    .sort((a, b) => a.visitAt.localeCompare(b.visitAt));
}

export function pastAppointments(state: AppState, now: Date): Appointment[] {
  const from = startOfDay(now).getTime();
  return state.appointments
    .filter((a) => new Date(a.visitAt).getTime() < from)
    .sort((a, b) => b.visitAt.localeCompare(a.visitAt));
}

export interface TodayProgress {
  total: number;
  done: number;
}

/** 오늘 할 일 = 먹을 약 개수 + 혈압 기록 1 + 혈당 기록 1 */
export function todayProgress(state: AppState, now: Date): TodayProgress {
  const doses = dosesForDate(state, now);
  const dosesDone = doses.filter((d) => d.intake?.status === 'taken').length;
  const bpDone = latestOnDate(state, 'bp', now) ? 1 : 0;
  const gluDone = latestOnDate(state, 'glucose', now) ? 1 : 0;
  return { total: doses.length + 2, done: dosesDone + bpDone + gluDone };
}

/** 약 하나의 일정 목록 (시간순) */
export function schedulesOf(state: AppState, medicationId: string): MedicationSchedule[] {
  return state.schedules
    .filter((s) => s.medicationId === medicationId)
    .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
}

export function questionsOf(state: AppState, appointmentId: string) {
  return state.questions
    .filter((q) => q.appointmentId === appointmentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 약 하나의 최근 N일 확인 현황 (오늘 포함) */
export function intakeHistory(state: AppState, medicationId: string, days: number, now: Date) {
  let total = 0;
  let taken = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toDateKey(d);
    state.schedules
      .filter((s) => s.medicationId === medicationId && s.daysOfWeek.includes(d.getDay()))
      .forEach((s) => {
        total++;
        if (state.intakes.some((it) => it.scheduleId === s.id && it.scheduledDate === key && it.status === 'taken')) taken++;
      });
  }
  return { total, taken };
}
