/**
 * DB 행(snake_case) ↔ 앱 데이터(camelCase) 변환. 단위 테스트 대상.
 */
import type {
  Appointment,
  AppointmentInput,
  AppointmentQuestion,
  ConsentRecord,
  ConsentType,
  DailySteps,
  DoseSlot,
  EmergencyContact,
  FamilyLink,
  GlucoseTiming,
  IntakeStatus,
  Measurement,
  MeasurementInput,
  Medication,
  MedicationIntake,
  MedicationSchedule,
  NotificationSettings,
  RemindBefore,
  ShareScope,
  SharedSummary,
} from '@/types/domain';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const src = (v: string) => (v === 'sample' ? 'sample' : 'real') as 'real' | 'sample';

export function toMeasurement(r: Row): Measurement {
  const base = { id: r.id, measuredAt: r.measured_at, memo: opt(r.memo), source: src(r.source) };
  switch (r.kind) {
    case 'bp':
      return { ...base, kind: 'bp', systolic: r.systolic, diastolic: r.diastolic, pulse: opt(r.pulse) };
    case 'glucose':
      return { ...base, kind: 'glucose', glucoseMgdl: r.glucose_mgdl, glucoseTiming: r.glucose_timing as GlucoseTiming };
    default:
      return { ...base, kind: 'weight', weightKg: Number(r.weight_kg) };
  }
}

/** 저장용 행: 종류에 맞지 않는 칸은 null로 비운다 (DB 형식 검사와 일치) */
export function fromMeasurementInput(m: MeasurementInput): Row {
  return {
    kind: m.kind,
    systolic: m.kind === 'bp' ? m.systolic : null,
    diastolic: m.kind === 'bp' ? m.diastolic : null,
    pulse: m.kind === 'bp' ? (m.pulse ?? null) : null,
    glucose_mgdl: m.kind === 'glucose' ? m.glucoseMgdl : null,
    glucose_timing: m.kind === 'glucose' ? m.glucoseTiming : null,
    weight_kg: m.kind === 'weight' ? m.weightKg : null,
    measured_at: m.measuredAt,
    memo: m.memo ?? null,
  };
}

export function toMedication(r: Row): Medication {
  return {
    id: r.id,
    name: r.name,
    doseText: opt(r.dose_text),
    memo: opt(r.memo),
    isActive: r.is_active,
    source: src(r.source),
  };
}

export function toSchedule(r: Row): MedicationSchedule {
  return {
    id: r.id,
    medicationId: r.medication_id,
    slot: r.slot as DoseSlot,
    timeOfDay: String(r.time_of_day).slice(0, 5), // 'HH:MM:SS' → 'HH:MM'
    daysOfWeek: r.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
    remind: r.remind,
  };
}

export function toIntake(r: Row): MedicationIntake {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    scheduledDate: r.scheduled_date,
    status: r.status as IntakeStatus,
    checkedAt: r.checked_at,
    source: src(r.source),
  };
}

export function toAppointment(r: Row): Appointment {
  return {
    id: r.id,
    hospitalName: r.hospital_name,
    department: opt(r.department),
    visitAt: r.visit_at,
    remindBefore: r.remind_before as RemindBefore,
    memo: opt(r.memo),
    source: src(r.source),
  };
}

export function fromAppointmentInput(a: AppointmentInput): Row {
  return {
    hospital_name: a.hospitalName,
    department: a.department ?? null,
    visit_at: a.visitAt,
    remind_before: a.remindBefore,
    memo: a.memo ?? null,
  };
}

export function toQuestion(r: Row): AppointmentQuestion {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    content: r.content,
    isDone: r.is_done,
    sortOrder: r.sort_order,
  };
}

export function toContact(r: Row): EmergencyContact {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    relationLabel: opt(r.relation_label),
    priority: r.priority,
    source: src(r.source),
  };
}

export function toDailySteps(r: Row): DailySteps {
  return { date: String(r.step_date).slice(0, 10), steps: Number(r.steps), source: r.source };
}

export function toNotificationSettings(r: Row | null): NotificationSettings {
  return {
    medsEnabled: r?.meds_enabled ?? true,
    appointmentsEnabled: r?.appointments_enabled ?? true,
    showMedName: r?.show_med_name ?? false,
  };
}

export function toConsent(r: Row): ConsentRecord {
  return {
    id: r.id,
    consentType: r.consent_type as ConsentType,
    version: r.version,
    agreedAt: r.agreed_at,
    withdrawnAt: opt(r.withdrawn_at),
  };
}

// ── 가족 공유 (3단계) ───────────────────────────────────────────────
const slotKo: Record<string, string> = { morning: '아침', noon: '점심', evening: '저녁', bedtime: '자기 전', custom: '정한 시간' };

function hhmmToKo(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? '오전' : '오후'} ${h12}:${String(m).padStart(2, '0')}`;
}

/**
 * 연결 행 → 앱 데이터. 서버 모드는 개인 이름 대신 서로 정한 호칭만 보인다.
 * - 내가 정보 주인이면: 내가 부르는 가족 호칭 (예: 딸)
 * - 내가 보는 가족이면: 주인이 정한 자기 호칭 (예: 어머니)
 */
export function toFamilyLink(r: Row, myId: string, views?: { count: number; last?: string }): FamilyLink {
  const role = r.owner_id === myId ? 'owner' : 'viewer';
  return {
    id: r.id,
    role,
    personName: role === 'owner' ? r.relation_label : r.owner_label,
    relationLabel: '',
    scope: {
      bp: r.share_bp,
      glucose: r.share_glucose,
      weight: r.share_weight,
      intakes: r.share_intakes,
      appointments: r.share_appointments,
    },
    status: r.status === 'revoked' ? 'revoked' : 'active',
    consentedAt: r.consented_at,
    revokedAt: opt(r.revoked_at),
    viewCount7d: role === 'owner' ? (views?.count ?? 0) : undefined,
    lastViewedAt: role === 'owner' ? views?.last : undefined,
    source: 'real',
  };
}

/** get_shared_summary 결과 → 앱 데이터 (서버가 허용한 항목만 들어 있음) */
export function toSharedSummary(linkId: string, j: Row | null): SharedSummary | null {
  if (!j) return null;
  return {
    linkId,
    todayIntakes: j.intakes_today?.map((i: Row) => ({
      label: `${slotKo[i.slot] ?? ''} 약 (${hhmmToKo(i.time_of_day)})`,
      taken: !!i.taken,
    })),
    recentBp: j.bp?.map((b: Row) => ({ measuredAt: b.measured_at, systolic: b.systolic, diastolic: b.diastolic })),
    recentGlucose: j.glucose?.map((g: Row) => ({
      measuredAt: g.measured_at,
      glucoseMgdl: g.glucose_mgdl,
      glucoseTiming: g.glucose_timing as GlucoseTiming,
    })),
    recentWeight: j.weight?.map((w: Row) => ({ measuredAt: w.measured_at, weightKg: Number(w.weight_kg) })),
    nextAppointment: j.next_appointment
      ? { hospitalName: j.next_appointment.hospital_name, visitAt: j.next_appointment.visit_at }
      : undefined,
    source: 'real',
  };
}

/** 앱 공유 범위 → 서버 함수 인자 */
export function scopeArgs(s: ShareScope) {
  return {
    p_share_bp: s.bp,
    p_share_glucose: s.glucose,
    p_share_weight: s.weight,
    p_share_intakes: s.intakes,
    p_share_appointments: s.appointments,
  };
}
