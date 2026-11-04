/**
 * 서버 모드 저장소: Supabase에 저장하고, 성공하면 화면 상태를 갱신한다.
 * 🔒 접근 제한은 서버 RLS가 판단한다. 여기서 user_id를 따로 보내지 않아도
 *    DB 기본값(auth.uid())이 채우며, 남의 id를 보내도 RLS가 거부한다.
 * ⚠ 오류를 기록할 때 건강 수치·이름을 남기지 않는다 (오류 코드만).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase 응답 행은 mappers.ts에서 형식을 맞춘다 */
import type { Dispatch } from 'react';

import type { AppState } from '../sampleData';
import type { Action } from '../reducer';
import type { Repository } from '../repository';
import { getSupabase } from './client';
import {
  fromAppointmentInput,
  fromMeasurementInput,
  toAppointment,
  toContact,
  toIntake,
  toMeasurement,
  toMedication,
  toNotificationSettings,
  toQuestion,
  toSchedule,
} from './mappers';

const LOAD_DAYS = 90; // 처음에 불러오는 기록 기간 (통계는 최근 30일까지)

/** 사용자에게 보여줄 오류 문장 */
export class UserFacingError extends Error {}

function friendly(error: { message?: string; code?: string } | null | undefined): never {
  const msg = error?.message ?? '';
  if (__DEV__) console.warn('[server]', error?.code ?? 'unknown'); // 코드만 남김
  if (/network|fetch|Failed to fetch|timeout/i.test(msg)) {
    throw new UserFacingError('인터넷 연결을 확인한 뒤 다시 해 주세요.');
  }
  if (error?.code === '42501') {
    throw new UserFacingError('건강정보 동의가 필요해요. 설정에서 동의 상태를 확인해 주세요.');
  }
  throw new UserFacingError('저장하지 못했어요. 잠시 뒤 다시 해 주세요.');
}

/** Supabase 응답에서 오류면 한국어 오류로 바꿔 던지고, 아니면 data를 돌려준다 */
async function must<T>(p: PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>): Promise<T> {
  let res: { data: T; error: { message?: string; code?: string } | null };
  try {
    res = await p;
  } catch (e) {
    return friendly({ message: String(e) });
  }
  if (res.error) friendly(res.error);
  return res.data;
}

/** 로그인한 사용자의 데이터를 모두 불러온다 */
export async function loadAll(): Promise<Partial<AppState>> {
  const sb = getSupabase();
  const since = new Date(Date.now() - LOAD_DAYS * 86_400_000).toISOString();
  const sinceDate = since.slice(0, 10);
  const [profile, measurements, meds, schedules, intakes, appointments, questions, contacts, notif] = await Promise.all([
    must(sb.from('profiles').select('display_name, font_scale').maybeSingle()),
    must(sb.from('health_measurements').select('*').gte('measured_at', since).order('measured_at', { ascending: false })),
    must(sb.from('medications').select('*').order('created_at')),
    must(sb.from('medication_schedules').select('*')),
    must(sb.from('medication_intakes').select('*').gte('scheduled_date', sinceDate)),
    must(sb.from('appointments').select('*').gte('visit_at', since).order('visit_at')),
    must(sb.from('appointment_questions').select('*')),
    must(sb.from('emergency_contacts').select('*').order('priority')),
    must(sb.from('notification_settings').select('*').maybeSingle()),
  ]);
  return {
    settings: {
      displayName: (profile as any)?.display_name ?? '',
      fontScale: Number((profile as any)?.font_scale ?? 1),
    },
    measurements: (measurements as any[]).map(toMeasurement),
    medications: (meds as any[]).map(toMedication),
    schedules: (schedules as any[]).map(toSchedule),
    intakes: (intakes as any[]).map(toIntake),
    appointments: (appointments as any[]).map(toAppointment),
    questions: (questions as any[]).map(toQuestion),
    emergencyContacts: (contacts as any[]).map(toContact),
    notificationSettings: toNotificationSettings(notif as any),
    // 가족 공유는 3단계
    familyLinks: [],
    sharedSummaries: [],
  };
}

export function createCloudRepository(dispatch: Dispatch<Action>, getState: () => AppState): Repository {
  const sb = () => getSupabase();

  const reloadMeds = async () => {
    const [meds, schedules, intakes] = await Promise.all([
      must(sb().from('medications').select('*').order('created_at')),
      must(sb().from('medication_schedules').select('*')),
      must(
        sb()
          .from('medication_intakes')
          .select('*')
          .gte('scheduled_date', new Date(Date.now() - LOAD_DAYS * 86_400_000).toISOString().slice(0, 10)),
      ),
    ]);
    dispatch({
      type: 'hydrate',
      data: {
        medications: (meds as any[]).map(toMedication),
        schedules: (schedules as any[]).map(toSchedule),
        intakes: (intakes as any[]).map(toIntake),
      },
    });
  };

  return {
    // ── 건강 측정 기록 ──
    async addMeasurement(input) {
      const row = await must(sb().from('health_measurements').insert(fromMeasurementInput(input)).select().single());
      dispatch({ type: 'measurement/add', item: toMeasurement(row) });
      return (row as any).id as string;
    },
    async updateMeasurement(id, input) {
      await must(sb().from('health_measurements').update(fromMeasurementInput(input)).eq('id', id));
      dispatch({ type: 'measurement/update', id, input });
    },
    async deleteMeasurement(id) {
      await must(sb().from('health_measurements').delete().eq('id', id));
      dispatch({ type: 'measurement/delete', id });
    },

    // ── 복약 확인 ──
    async setIntake(scheduleId, date, status) {
      await must(
        sb()
          .from('medication_intakes')
          .upsert(
            { schedule_id: scheduleId, scheduled_date: date, status, checked_at: new Date().toISOString() },
            { onConflict: 'schedule_id,scheduled_date' },
          ),
      );
      dispatch({ type: 'intake/set', scheduleId, date, status });
    },
    async clearIntake(scheduleId, date) {
      await must(sb().from('medication_intakes').delete().eq('schedule_id', scheduleId).eq('scheduled_date', date));
      dispatch({ type: 'intake/clear', scheduleId, date });
    },

    // ── 약·복약 일정 ──
    async addMedication(input) {
      const med = await must(
        sb()
          .from('medications')
          .insert({ name: input.name, dose_text: input.doseText ?? null, memo: input.memo ?? null })
          .select('id')
          .single(),
      );
      const id = (med as any).id as string;
      if (input.schedules.length) {
        await must(
          sb()
            .from('medication_schedules')
            .insert(input.schedules.map((s) => ({ medication_id: id, slot: s.slot, time_of_day: s.timeOfDay }))),
        );
      }
      await reloadMeds();
      return id;
    },
    async updateMedication(id, input) {
      await must(
        sb()
          .from('medications')
          .update({ name: input.name, dose_text: input.doseText ?? null, memo: input.memo ?? null })
          .eq('id', id),
      );
      // 바뀐 일정만 지우고 추가 (같은 시간대는 남겨 확인 기록 보존)
      const old = getState().schedules.filter((s) => s.medicationId === id);
      const removed = old.filter((o) => !input.schedules.some((s) => s.slot === o.slot && s.timeOfDay === o.timeOfDay));
      const added = input.schedules.filter((s) => !old.some((o) => o.slot === s.slot && o.timeOfDay === s.timeOfDay));
      if (removed.length) {
        await must(sb().from('medication_schedules').delete().in('id', removed.map((r) => r.id)));
      }
      if (added.length) {
        await must(
          sb()
            .from('medication_schedules')
            .insert(added.map((s) => ({ medication_id: id, slot: s.slot, time_of_day: s.timeOfDay }))),
        );
      }
      await reloadMeds();
    },
    async setMedicationActive(id, isActive) {
      await must(sb().from('medications').update({ is_active: isActive }).eq('id', id));
      dispatch({ type: 'medication/active', id, isActive });
    },
    async deleteMedication(id) {
      await must(sb().from('medications').delete().eq('id', id));
      dispatch({ type: 'medication/delete', id });
    },

    // ── 병원 일정·질문 메모 ──
    async addAppointment(input) {
      const row = await must(sb().from('appointments').insert(fromAppointmentInput(input)).select().single());
      dispatch({ type: 'appointment/add', item: toAppointment(row) });
      return (row as any).id as string;
    },
    async updateAppointment(id, input) {
      await must(sb().from('appointments').update(fromAppointmentInput(input)).eq('id', id));
      dispatch({ type: 'appointment/update', id, input });
    },
    async deleteAppointment(id) {
      await must(sb().from('appointments').delete().eq('id', id));
      dispatch({ type: 'appointment/delete', id });
    },
    async addQuestion(appointmentId, content) {
      const max = Math.max(0, ...getState().questions.filter((q) => q.appointmentId === appointmentId).map((q) => q.sortOrder));
      await must(sb().from('appointment_questions').insert({ appointment_id: appointmentId, content, sort_order: max + 1 }));
      const rows = await must(sb().from('appointment_questions').select('*'));
      dispatch({ type: 'hydrate', data: { questions: (rows as any[]).map(toQuestion) } });
    },
    async toggleQuestion(id) {
      const q = getState().questions.find((x) => x.id === id);
      if (!q) return;
      await must(sb().from('appointment_questions').update({ is_done: !q.isDone }).eq('id', id));
      dispatch({ type: 'question/toggle', id });
    },
    async deleteQuestion(id) {
      await must(sb().from('appointment_questions').delete().eq('id', id));
      dispatch({ type: 'question/delete', id });
    },

    // ── 가족 공유: 3단계에서 서버 함수로 구현 ──
    async updateShareScope() {
      throw new UserFacingError('가족 공유는 다음 단계에서 사용할 수 있어요.');
    },
    async revokeLink() {
      throw new UserFacingError('가족 공유는 다음 단계에서 사용할 수 있어요.');
    },

    // ── 긴급 연락처 ──
    async addEmergencyContact(input) {
      const max = Math.max(0, ...getState().emergencyContacts.map((c) => c.priority));
      await must(
        sb()
          .from('emergency_contacts')
          .insert({ name: input.name, phone: input.phone, relation_label: input.relationLabel ?? null, priority: max + 1 }),
      );
      const rows = await must(sb().from('emergency_contacts').select('*').order('priority'));
      dispatch({ type: 'hydrate', data: { emergencyContacts: (rows as any[]).map(toContact) } });
    },
    async deleteEmergencyContact(id) {
      await must(sb().from('emergency_contacts').delete().eq('id', id));
      dispatch({ type: 'contact/delete', id });
    },

    // ── 설정 ──
    async setFontScale(scale) {
      dispatch({ type: 'settings/fontScale', scale }); // 글씨는 바로 바꾸고 저장은 뒤에서
      const uid = (await sb().auth.getUser()).data.user?.id;
      if (uid) await must(sb().from('profiles').update({ font_scale: scale }).eq('id', uid));
    },
    async updateNotificationSettings(next) {
      const uid = (await sb().auth.getUser()).data.user?.id;
      if (!uid) return;
      await must(
        sb()
          .from('notification_settings')
          .update({
            meds_enabled: next.medsEnabled,
            appointments_enabled: next.appointmentsEnabled,
            show_med_name: next.showMedName,
          })
          .eq('user_id', uid),
      );
      dispatch({ type: 'settings/notifications', next });
    },
    async resetSampleData() {
      // 서버 모드에는 예시 데이터가 없다
    },
  };
}
