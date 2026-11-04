/**
 * DB 행(snake_case) ↔ 앱 데이터(camelCase) 변환. 단위 테스트 대상.
 */
import type {
  Appointment,
  AppointmentInput,
  AppointmentQuestion,
  ConsentRecord,
  ConsentType,
  DoseSlot,
  EmergencyContact,
  GlucoseTiming,
  IntakeStatus,
  Measurement,
  MeasurementInput,
  Medication,
  MedicationIntake,
  MedicationSchedule,
  NotificationSettings,
  RemindBefore,
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
