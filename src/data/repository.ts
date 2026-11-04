/**
 * 화면이 데이터를 바꿀 때 부르는 함수 목록 (약속).
 * - 1단계: 메모리 저장소(store.tsx)가 이 약속을 구현한다.
 * - 2단계: 같은 약속을 Supabase로 구현해 교체한다. 화면 코드는 바꾸지 않는다.
 * 모든 함수가 Promise를 돌려주는 이유: 2단계에서 서버 저장은 시간이 걸리기 때문.
 * 실패하면 사용자에게 보여줄 한국어 문장을 담은 Error를 던진다 (useSafeAction이 안내창으로 보여줌).
 */
import type {
  AppointmentInput,
  DateKey,
  IntakeStatus,
  MeasurementInput,
  MedicationInput,
  NotificationSettings,
  ShareScope,
} from '@/types/domain';

export interface Repository {
  // 건강 측정 기록
  addMeasurement(input: MeasurementInput): Promise<string>;
  updateMeasurement(id: string, input: MeasurementInput): Promise<void>;
  deleteMeasurement(id: string): Promise<void>;

  // 복약 확인
  setIntake(scheduleId: string, date: DateKey, status: IntakeStatus): Promise<void>;
  clearIntake(scheduleId: string, date: DateKey): Promise<void>;

  // 약·복약 일정
  addMedication(input: MedicationInput): Promise<string>;
  updateMedication(id: string, input: MedicationInput): Promise<void>;
  setMedicationActive(id: string, isActive: boolean): Promise<void>;
  deleteMedication(id: string): Promise<void>;

  // 병원 일정·질문 메모
  addAppointment(input: AppointmentInput): Promise<string>;
  updateAppointment(id: string, input: AppointmentInput): Promise<void>;
  deleteAppointment(id: string): Promise<void>;
  addQuestion(appointmentId: string, content: string): Promise<void>;
  toggleQuestion(id: string): Promise<void>;
  deleteQuestion(id: string): Promise<void>;

  // 가족 공유 (2단계 이후 서버 함수에서 권한 재검사)
  updateShareScope(linkId: string, scope: ShareScope): Promise<void>;
  revokeLink(linkId: string): Promise<void>;

  // 긴급 연락처
  addEmergencyContact(input: { name: string; phone: string; relationLabel?: string }): Promise<void>;
  deleteEmergencyContact(id: string): Promise<void>;

  // 설정
  setFontScale(scale: number): Promise<void>;
  updateNotificationSettings(next: NotificationSettings): Promise<void>;
  resetSampleData(): Promise<void>;
}
