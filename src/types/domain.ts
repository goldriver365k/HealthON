/**
 * 앱 데이터 타입. docs/MASTER_PLAN.md D장(테이블 설계)과 이름을 맞춘다.
 * DB 컬럼(snake_case) ↔ 앱(camelCase) 변환은 2단계에서 데이터 층에서만 처리한다.
 */

/** 실제 기록인지 예시(가상) 데이터인지 */
export type DataSource = 'real' | 'sample';

/** 'YYYY-MM-DD' (기기 현지 날짜) */
export type DateKey = string;
/** 'HH:MM' (24시간) */
export type TimeOfDay = string;
/** ISO 8601 날짜·시각 문자열 */
export type IsoDateTime = string;

// ── 건강 측정 기록 (health_measurements) ───────────────────────────
export type MeasurementKind = 'bp' | 'glucose' | 'weight';
export type GlucoseTiming = 'fasting' | 'after_meal' | 'bedtime' | 'other';

interface MeasurementBase {
  id: string;
  measuredAt: IsoDateTime;
  memo?: string;
  source: DataSource;
}

export interface BpMeasurement extends MeasurementBase {
  kind: 'bp';
  systolic: number;
  diastolic: number;
  pulse?: number;
}

export interface GlucoseMeasurement extends MeasurementBase {
  kind: 'glucose';
  glucoseMgdl: number;
  glucoseTiming: GlucoseTiming;
}

export interface WeightMeasurement extends MeasurementBase {
  kind: 'weight';
  weightKg: number;
}

export type Measurement = BpMeasurement | GlucoseMeasurement | WeightMeasurement;

/** 새 기록 입력값 (id·source는 저장소가 정함) */
export type MeasurementInput =
  | Omit<BpMeasurement, 'id' | 'source'>
  | Omit<GlucoseMeasurement, 'id' | 'source'>
  | Omit<WeightMeasurement, 'id' | 'source'>;

// ── 등록 약품 (medications) ──────────────────────────────────────
export interface Medication {
  id: string;
  name: string;
  doseText?: string;
  memo?: string;
  isActive: boolean;
  source: DataSource;
}

// ── 복약 일정 (medication_schedules) ─────────────────────────────
export type DoseSlot = 'morning' | 'noon' | 'evening' | 'bedtime' | 'custom';

export interface MedicationSchedule {
  id: string;
  medicationId: string;
  slot: DoseSlot;
  timeOfDay: TimeOfDay;
  /** 0=일 ~ 6=토 */
  daysOfWeek: number[];
  remind: boolean;
}

export interface MedicationInput {
  name: string;
  doseText?: string;
  memo?: string;
  schedules: { slot: DoseSlot; timeOfDay: TimeOfDay }[];
}

// ── 복약 확인 기록 (medication_intakes) ──────────────────────────
export type IntakeStatus = 'taken' | 'skipped';

export interface MedicationIntake {
  id: string;
  scheduleId: string;
  scheduledDate: DateKey;
  status: IntakeStatus;
  checkedAt: IsoDateTime;
  source: DataSource;
}

// ── 병원 방문 일정 (appointments) ────────────────────────────────
export type RemindBefore = 'none' | 'day_before' | 'same_day';

export interface Appointment {
  id: string;
  hospitalName: string;
  department?: string;
  visitAt: IsoDateTime;
  remindBefore: RemindBefore;
  memo?: string;
  source: DataSource;
}

export type AppointmentInput = Omit<Appointment, 'id' | 'source'>;

// ── 진료 질문 메모 (appointment_questions) — 가족 공유 안 함 ────────
export interface AppointmentQuestion {
  id: string;
  appointmentId: string;
  content: string;
  isDone: boolean;
  sortOrder: number;
}

// ── 가족 연결 (family_links) ─────────────────────────────────────
export interface ShareScope {
  bp: boolean;
  glucose: boolean;
  weight: boolean;
  intakes: boolean;
  appointments: boolean;
}

export type ShareCategory = keyof ShareScope;

/**
 * owner  = 내가 정보를 공유하는 쪽 (가족이 내 정보를 봄)
 * viewer = 내가 가족의 정보를 보는 쪽
 */
export type FamilyRole = 'owner' | 'viewer';

export interface FamilyLink {
  id: string;
  role: FamilyRole;
  personName: string;
  relationLabel: string;
  scope: ShareScope;
  status: 'active' | 'revoked';
  consentedAt: IsoDateTime;
  revokedAt?: IsoDateTime;
  /** (내가 공유하는 쪽) 최근 7일 동안 가족이 본 횟수 — 감사기록에서 계산 */
  viewCount7d?: number;
  /** (내가 공유하는 쪽) 가족이 마지막으로 본 때 */
  lastViewedAt?: IsoDateTime;
  source: DataSource;
}

export interface FamilyInviteInput {
  /** 내가 부르는 가족 (예: 딸) */
  relationLabel: string;
  /** 가족에게 보일 내 이름 (예: 어머니) */
  ownerLabel: string;
  scope: ShareScope;
}

export interface FamilyInviteResult {
  code: string;
  expiresAt: IsoDateTime;
}

/**
 * 내가 보는 가족의 공유 정보 요약.
 * 2단계 이후 서버 함수(get_shared_summary)가 허용 항목만 돌려준다.
 * 1단계에서는 예시 데이터.
 */
export interface SharedSummary {
  linkId: string;
  todayIntakes?: { label: string; taken: boolean }[];
  recentBp?: { measuredAt: IsoDateTime; systolic: number; diastolic: number }[];
  recentGlucose?: { measuredAt: IsoDateTime; glucoseMgdl: number; glucoseTiming?: GlucoseTiming }[];
  recentWeight?: { measuredAt: IsoDateTime; weightKg: number }[];
  nextAppointment?: { hospitalName: string; visitAt: IsoDateTime };
  source: DataSource;
}

// ── 긴급 연락처 (emergency_contacts) ─────────────────────────────
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationLabel?: string;
  priority: number;
  source: DataSource;
}

// ── 사용자 설정 (profiles.font_scale 등) ──────────────────────────
export interface UserSettings {
  displayName: string;
  fontScale: number;
}

// ── 알림 설정 (notification_settings) ────────────────────────────
export interface NotificationSettings {
  medsEnabled: boolean;
  appointmentsEnabled: boolean;
  /** 잠금화면 알림에 약 이름 보이기 (기본: 숨김) */
  showMedName: boolean;
}

// ── 동의 (consents) ──────────────────────────────────────────────
export type ConsentType = 'terms' | 'privacy' | 'sensitive_health' | 'age_14';

export interface ConsentRecord {
  id: string;
  consentType: ConsentType;
  version: string;
  agreedAt: IsoDateTime;
  withdrawnAt?: IsoDateTime;
}

/** 만보기: 날짜별 걸음 수 합계 (DB: daily_steps). 휴대폰 동작 기록에서 읽어 저장 */
export interface DailySteps {
  date: DateKey;
  steps: number;
  source: DataSource;
}
