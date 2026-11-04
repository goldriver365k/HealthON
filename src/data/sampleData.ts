/**
 * 1단계용 예시(가상) 데이터. 실제 인물·실제 건강정보가 아니다.
 * - 모든 항목 source: 'sample' → 화면에 '예시' 표시
 * - 화면 확인과 테스트를 다시 해볼 수 있도록 무작위 값 대신 고정값 사용
 * - 날짜는 "오늘" 기준으로 계산 (앱을 켤 때마다 최근 기록처럼 보이게)
 */
import type {
  Appointment,
  AppointmentQuestion,
  EmergencyContact,
  FamilyLink,
  Measurement,
  Medication,
  MedicationIntake,
  MedicationSchedule,
  NotificationSettings,
  SharedSummary,
  UserSettings,
} from '@/types/domain';
import { addDays, combineDateAndTime, startOfDay, toDateKey } from '@/utils/date';

export interface AppState {
  settings: UserSettings;
  measurements: Measurement[];
  medications: Medication[];
  schedules: MedicationSchedule[];
  intakes: MedicationIntake[];
  appointments: Appointment[];
  questions: AppointmentQuestion[];
  familyLinks: FamilyLink[];
  sharedSummaries: SharedSummary[];
  emergencyContacts: EmergencyContact[];
  notificationSettings: NotificationSettings;
}

export const defaultNotificationSettings: NotificationSettings = {
  medsEnabled: true,
  appointmentsEnabled: true,
  showMedName: false,
};

/** 서버 모드에서 데이터를 불러오기 전의 빈 상태 */
export function createEmptyState(): AppState {
  return {
    settings: { displayName: '', fontScale: 1 },
    measurements: [],
    medications: [],
    schedules: [],
    intakes: [],
    appointments: [],
    questions: [],
    familyLinks: [],
    sharedSummaries: [],
    emergencyContacts: [],
    notificationSettings: defaultNotificationSettings,
  };
}

// 14일치 고정값 (index 0 = 오늘)
const BP = [
  [128, 82, 72], [131, 85, 70], [126, 80, 74], [135, 88, 76], [129, 83, 71],
  [124, 79, 69], [132, 84, 73], [127, 81, 72], [130, 83, 70], [133, 86, 75],
  [125, 80, 71], [128, 82, 72], [129, 83, 70], [126, 81, 73],
] as const;
// 혈당은 어제부터 (오늘은 아직 기록 전인 상태를 보여주기 위해)
const GLUCOSE = [null, 104, 98, 112, 101, 107, 99, 110, 103, 96, 108, 102, 100, 105] as const;
const WEIGHT: Record<number, number> = { 1: 62.4, 4: 62.7, 8: 62.9, 11: 63.1 };

export function createSampleState(now: Date = new Date()): AppState {
  const today = startOfDay(now);
  const day = (offset: number) => addDays(today, -offset);
  const iso = (offset: number, time: string) => combineDateAndTime(day(offset), time).toISOString();

  const measurements: Measurement[] = [];
  BP.forEach(([systolic, diastolic, pulse], i) => {
    measurements.push({
      id: `s-bp-${i}`,
      kind: 'bp',
      systolic,
      diastolic,
      pulse,
      measuredAt: iso(i, '07:50'),
      source: 'sample',
    });
  });
  GLUCOSE.forEach((v, i) => {
    if (v === null) return;
    measurements.push({
      id: `s-glu-${i}`,
      kind: 'glucose',
      glucoseMgdl: v,
      glucoseTiming: 'fasting',
      measuredAt: iso(i, '06:50'),
      source: 'sample',
    });
  });
  Object.entries(WEIGHT).forEach(([offset, kg]) => {
    measurements.push({
      id: `s-wt-${offset}`,
      kind: 'weight',
      weightKg: kg,
      measuredAt: iso(Number(offset), '07:30'),
      source: 'sample',
    });
  });

  const medications: Medication[] = [
    { id: 's-med-1', name: '혈압약(예시)', doseText: '1알', isActive: true, source: 'sample' },
    { id: 's-med-2', name: '당뇨약(예시)', doseText: '1알', isActive: true, source: 'sample' },
    { id: 's-med-3', name: '영양제(예시)', doseText: '1알', isActive: true, source: 'sample' },
  ];
  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  const schedules: MedicationSchedule[] = [
    { id: 's-sch-1', medicationId: 's-med-1', slot: 'morning', timeOfDay: '08:00', daysOfWeek: everyDay, remind: true },
    { id: 's-sch-2', medicationId: 's-med-2', slot: 'morning', timeOfDay: '08:00', daysOfWeek: everyDay, remind: true },
    { id: 's-sch-3', medicationId: 's-med-3', slot: 'noon', timeOfDay: '12:30', daysOfWeek: everyDay, remind: true },
    { id: 's-sch-4', medicationId: 's-med-2', slot: 'evening', timeOfDay: '18:30', daysOfWeek: everyDay, remind: true },
  ];

  // 오늘: 아침 약 2개만 확인한 상태. 지난 6일: 대부분 확인 (하루 저녁 빠짐)
  const intakes: MedicationIntake[] = [];
  const addIntake = (scheduleId: string, offset: number, time: string) =>
    intakes.push({
      id: `s-int-${scheduleId}-${offset}`,
      scheduleId,
      scheduledDate: toDateKey(day(offset)),
      status: 'taken',
      checkedAt: iso(offset, time),
      source: 'sample',
    });
  addIntake('s-sch-1', 0, '08:12');
  addIntake('s-sch-2', 0, '08:12');
  for (let i = 1; i <= 6; i++) {
    addIntake('s-sch-1', i, '08:10');
    addIntake('s-sch-2', i, '08:10');
    addIntake('s-sch-3', i, '12:40');
    if (i !== 3) addIntake('s-sch-4', i, '18:45');
  }

  const appointments: Appointment[] = [
    {
      id: 's-apt-1',
      hospitalName: '예시내과',
      department: '내과',
      visitAt: iso(0, '14:00'),
      remindBefore: 'same_day',
      source: 'sample',
    },
    {
      id: 's-apt-2',
      hospitalName: '예시정형외과',
      department: '정형외과',
      visitAt: combineDateAndTime(addDays(today, 7), '10:30').toISOString(),
      remindBefore: 'day_before',
      source: 'sample',
    },
  ];
  const questions: AppointmentQuestion[] = [
    { id: 's-q-1', appointmentId: 's-apt-1', content: '요즘 아침에 어지러운 적이 있어요 (예시)', isDone: false, sortOrder: 1 },
    { id: 's-q-2', appointmentId: 's-apt-2', content: '계단 내려갈 때 무릎이 아파요 (예시)', isDone: false, sortOrder: 1 },
    { id: 's-q-3', appointmentId: 's-apt-2', content: '물리치료는 몇 번 받아야 하나요? (예시)', isDone: false, sortOrder: 2 },
  ];

  const familyLinks: FamilyLink[] = [
    {
      id: 's-link-1',
      role: 'owner',
      personName: '김예솔',
      relationLabel: '딸',
      scope: { bp: true, glucose: false, weight: false, intakes: true, appointments: false },
      status: 'active',
      consentedAt: iso(20, '19:00'),
      source: 'sample',
    },
    {
      id: 's-link-2',
      role: 'owner',
      personName: '김예준',
      relationLabel: '아들',
      scope: { bp: false, glucose: false, weight: false, intakes: true, appointments: false },
      status: 'active',
      consentedAt: iso(15, '20:00'),
      source: 'sample',
    },
    {
      id: 's-link-3',
      role: 'viewer',
      personName: '박예시',
      relationLabel: '어머니',
      scope: { bp: true, glucose: false, weight: false, intakes: true, appointments: true },
      status: 'active',
      consentedAt: iso(30, '10:00'),
      source: 'sample',
    },
  ];

  const sharedSummaries: SharedSummary[] = [
    {
      linkId: 's-link-3',
      todayIntakes: [
        { label: '아침 약', taken: true },
        { label: '저녁 약', taken: false },
      ],
      recentBp: [0, 1, 2].map((i) => ({
        measuredAt: iso(i, '08:20'),
        systolic: [136, 134, 138][i],
        diastolic: [84, 82, 86][i],
      })),
      nextAppointment: {
        hospitalName: '예시가정의학과',
        visitAt: combineDateAndTime(addDays(today, 3), '11:00').toISOString(),
      },
      source: 'sample',
    },
  ];

  const emergencyContacts: EmergencyContact[] = [
    { id: 's-ec-1', name: '김예솔', phone: '010-0000-0000', relationLabel: '딸', priority: 1, source: 'sample' },
  ];

  return {
    settings: { displayName: '김예시', fontScale: 1 },
    measurements,
    medications,
    schedules,
    intakes,
    appointments,
    questions,
    familyLinks,
    sharedSummaries,
    emergencyContacts,
    notificationSettings: defaultNotificationSettings,
  };
}
