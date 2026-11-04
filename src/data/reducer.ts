/**
 * 앱 데이터 상태 변경 규칙 (체험 모드·서버 모드 공용, 단위 테스트 대상).
 * 1단계 store.tsx에 있던 코드를 그대로 옮기고, 서버 모드용 'hydrate'·알림 설정만 추가했다.
 */
import type {
  Appointment,
  AppointmentInput,
  DailySteps,
  DateKey,
  FamilyLink,
  IntakeStatus,
  Measurement,
  MeasurementInput,
  MedicationInput,
  MedicationSchedule,
  NotificationSettings,
  ShareScope,
  SharedSummary,
} from '@/types/domain';
import { createSampleState, type AppState } from './sampleData';

let counter = 0;
export const newId = () => `l-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export type Action =
  | { type: 'hydrate'; data: Partial<AppState> }
  | { type: 'measurement/add'; item: Measurement }
  | { type: 'measurement/update'; id: string; input: MeasurementInput }
  | { type: 'measurement/delete'; id: string }
  | { type: 'intake/set'; scheduleId: string; date: DateKey; status: IntakeStatus }
  | { type: 'intake/clear'; scheduleId: string; date: DateKey }
  | { type: 'medication/add'; id: string; input: MedicationInput }
  | { type: 'medication/update'; id: string; input: MedicationInput }
  | { type: 'medication/active'; id: string; isActive: boolean }
  | { type: 'medication/delete'; id: string }
  | { type: 'appointment/add'; item: Appointment }
  | { type: 'appointment/update'; id: string; input: AppointmentInput }
  | { type: 'appointment/delete'; id: string }
  | { type: 'question/add'; appointmentId: string; content: string }
  | { type: 'question/toggle'; id: string }
  | { type: 'question/delete'; id: string }
  | { type: 'link/scope'; linkId: string; scope: ShareScope }
  | { type: 'link/revoke'; linkId: string }
  | { type: 'link/add'; link: FamilyLink; summary?: SharedSummary }
  | { type: 'summary/set'; linkId: string; summary: SharedSummary | null }
  | { type: 'contact/add'; name: string; phone: string; relationLabel?: string }
  | { type: 'contact/delete'; id: string }
  | { type: 'settings/fontScale'; scale: number }
  | { type: 'settings/notifications'; next: NotificationSettings }
  | { type: 'steps/upsert'; items: DailySteps[] }
  | { type: 'reset' };

function buildSchedules(medicationId: string, input: MedicationInput): MedicationSchedule[] {
  return input.schedules.map((s) => ({
    id: newId(),
    medicationId,
    slot: s.slot,
    timeOfDay: s.timeOfDay,
    daysOfWeek: ALL_DAYS,
    remind: true,
  }));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.data };

    case 'measurement/add':
      return { ...state, measurements: [...state.measurements, action.item] };
    case 'measurement/update':
      return {
        ...state,
        measurements: state.measurements.map((m) =>
          m.id === action.id ? ({ ...action.input, id: m.id, source: m.source } as Measurement) : m,
        ),
      };
    case 'measurement/delete':
      return { ...state, measurements: state.measurements.filter((m) => m.id !== action.id) };

    case 'intake/set': {
      const rest = state.intakes.filter(
        (i) => !(i.scheduleId === action.scheduleId && i.scheduledDate === action.date),
      );
      return {
        ...state,
        intakes: [
          ...rest,
          {
            id: newId(),
            scheduleId: action.scheduleId,
            scheduledDate: action.date,
            status: action.status,
            checkedAt: new Date().toISOString(),
            source: 'real',
          },
        ],
      };
    }
    case 'intake/clear':
      return {
        ...state,
        intakes: state.intakes.filter(
          (i) => !(i.scheduleId === action.scheduleId && i.scheduledDate === action.date),
        ),
      };

    case 'medication/add':
      return {
        ...state,
        medications: [
          ...state.medications,
          {
            id: action.id,
            name: action.input.name,
            doseText: action.input.doseText,
            memo: action.input.memo,
            isActive: true,
            source: 'real',
          },
        ],
        schedules: [...state.schedules, ...buildSchedules(action.id, action.input)],
      };
    case 'medication/update': {
      // 같은 시간대(slot+시각)는 id를 유지해 확인 기록을 보존, 없어진 일정의 확인 기록은 정리
      const old = state.schedules.filter((s) => s.medicationId === action.id);
      const next = action.input.schedules.map((s) => {
        const same = old.find((o) => o.slot === s.slot && o.timeOfDay === s.timeOfDay);
        return (
          same ?? {
            id: newId(),
            medicationId: action.id,
            slot: s.slot,
            timeOfDay: s.timeOfDay,
            daysOfWeek: ALL_DAYS,
            remind: true,
          }
        );
      });
      const keptIds = new Set(next.map((s) => s.id));
      return {
        ...state,
        medications: state.medications.map((m) =>
          m.id === action.id
            ? { ...m, name: action.input.name, doseText: action.input.doseText, memo: action.input.memo }
            : m,
        ),
        schedules: [...state.schedules.filter((s) => s.medicationId !== action.id), ...next],
        intakes: state.intakes.filter((i) => {
          const sch = old.find((o) => o.id === i.scheduleId);
          return !sch || keptIds.has(sch.id);
        }),
      };
    }
    case 'medication/active':
      return {
        ...state,
        medications: state.medications.map((m) => (m.id === action.id ? { ...m, isActive: action.isActive } : m)),
      };
    case 'medication/delete': {
      const scheduleIds = new Set(state.schedules.filter((s) => s.medicationId === action.id).map((s) => s.id));
      return {
        ...state,
        medications: state.medications.filter((m) => m.id !== action.id),
        schedules: state.schedules.filter((s) => !scheduleIds.has(s.id)),
        intakes: state.intakes.filter((i) => !scheduleIds.has(i.scheduleId)),
      };
    }

    case 'appointment/add':
      return { ...state, appointments: [...state.appointments, action.item] };
    case 'appointment/update':
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.id ? { ...action.input, id: a.id, source: a.source } : a,
        ),
      };
    case 'appointment/delete':
      return {
        ...state,
        appointments: state.appointments.filter((a) => a.id !== action.id),
        questions: state.questions.filter((q) => q.appointmentId !== action.id),
      };

    case 'question/add': {
      const max = Math.max(
        0,
        ...state.questions.filter((q) => q.appointmentId === action.appointmentId).map((q) => q.sortOrder),
      );
      return {
        ...state,
        questions: [
          ...state.questions,
          { id: newId(), appointmentId: action.appointmentId, content: action.content, isDone: false, sortOrder: max + 1 },
        ],
      };
    }
    case 'question/toggle':
      return {
        ...state,
        questions: state.questions.map((q) => (q.id === action.id ? { ...q, isDone: !q.isDone } : q)),
      };
    case 'question/delete':
      return { ...state, questions: state.questions.filter((q) => q.id !== action.id) };

    case 'link/scope':
      return {
        ...state,
        familyLinks: state.familyLinks.map((l) => (l.id === action.linkId ? { ...l, scope: action.scope } : l)),
      };
    case 'link/revoke':
      return {
        ...state,
        familyLinks: state.familyLinks.map((l) =>
          l.id === action.linkId ? { ...l, status: 'revoked', revokedAt: new Date().toISOString() } : l,
        ),
        sharedSummaries: state.sharedSummaries.filter((s) => s.linkId !== action.linkId),
      };

    case 'link/add':
      return {
        ...state,
        familyLinks: [...state.familyLinks, action.link],
        sharedSummaries: action.summary ? [...state.sharedSummaries, action.summary] : state.sharedSummaries,
      };
    case 'summary/set': {
      const rest = state.sharedSummaries.filter((s) => s.linkId !== action.linkId);
      return { ...state, sharedSummaries: action.summary ? [...rest, action.summary] : rest };
    }

    case 'contact/add': {
      const max = Math.max(0, ...state.emergencyContacts.map((c) => c.priority));
      return {
        ...state,
        emergencyContacts: [
          ...state.emergencyContacts,
          {
            id: newId(),
            name: action.name,
            phone: action.phone,
            relationLabel: action.relationLabel,
            priority: max + 1,
            source: 'real',
          },
        ],
      };
    }
    case 'contact/delete':
      return { ...state, emergencyContacts: state.emergencyContacts.filter((c) => c.id !== action.id) };

    case 'settings/fontScale':
      return { ...state, settings: { ...state.settings, fontScale: action.scale } };
    case 'settings/notifications':
      return { ...state, notificationSettings: action.next };

    case 'steps/upsert': {
      // 같은 날짜는 새 값으로 바꾸고, 날짜 순으로 정렬 (최근이 앞)
      const byDate = new Map(state.dailySteps.map((d) => [d.date, d]));
      for (const item of action.items) byDate.set(item.date, item);
      return { ...state, dailySteps: [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1)) };
    }

    case 'reset':
      // 글씨 크기·알림 설정은 유지
      return { ...createSampleState(), settings: state.settings, notificationSettings: state.notificationSettings };
  }
}
