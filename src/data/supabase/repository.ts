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
import { CONSENT_VERSION } from '../config';
import type { Repository } from '../repository';
import { getSupabase } from './client';
import {
  fromAppointmentInput,
  fromMeasurementInput,
  toAppointment,
  scopeArgs,
  toContact,
  toDailySteps,
  toFamilyLink,
  toIntake,
  toMeasurement,
  toMedication,
  toNotificationSettings,
  toQuestion,
  toSchedule,
  toSharedSummary,
} from './mappers';

const LOAD_DAYS = 90; // 처음에 불러오는 기록 기간 (통계는 최근 30일까지)
const STEPS_LOAD_DAYS = 400; // 걸음 수는 월별 기록(최근 12달)까지 보여 주므로 더 길게

/** 사용자에게 보여줄 오류 문장 */
import { UserFacingError } from '../errors';
export { UserFacingError };

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
  const stepsSince = new Date(Date.now() - STEPS_LOAD_DAYS * 86_400_000).toISOString().slice(0, 10);
  const [profile, measurements, meds, schedules, intakes, appointments, questions, contacts, notif, steps] = await Promise.all([
    must(sb.from('profiles').select('display_name, font_scale').maybeSingle()),
    must(sb.from('health_measurements').select('*').gte('measured_at', since).order('measured_at', { ascending: false })),
    must(sb.from('medications').select('*').order('created_at')),
    must(sb.from('medication_schedules').select('*')),
    must(sb.from('medication_intakes').select('*').gte('scheduled_date', sinceDate)),
    must(sb.from('appointments').select('*').gte('visit_at', since).order('visit_at')),
    must(sb.from('appointment_questions').select('*')),
    must(sb.from('emergency_contacts').select('*').order('priority')),
    must(sb.from('notification_settings').select('*').maybeSingle()),
    must(sb.from('daily_steps').select('step_date, steps, source').gte('step_date', stepsSince).order('step_date', { ascending: false })),
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
    dailySteps: (steps as any[]).map(toDailySteps),
    familyLinks: await loadFamilyLinks(),
    sharedSummaries: [], // 가족 정보는 화면을 열 때만 불러온다 (최소 조회 + 열람 기록 정확도)
  };
}

/** 내 가족 연결 (주인·보는 가족 양쪽) + 내 정보를 본 기록(최근 7일) */
export async function loadFamilyLinks() {
  const sb = getSupabase();
  const uid = (await sb.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [links, views] = await Promise.all([
    must(sb.from('family_links').select('*').eq('status', 'active').order('created_at')),
    must(
      sb
        .from('audit_logs')
        .select('target_id, occurred_at')
        .eq('action', 'family_view')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false }),
    ),
  ]);
  const byLink = new Map<string, { count: number; last?: string }>();
  for (const v of views as any[]) {
    const cur = byLink.get(v.target_id) ?? { count: 0, last: v.occurred_at };
    cur.count += 1;
    byLink.set(v.target_id, cur);
  }
  return (links as any[]).map((l) => toFamilyLink(l, uid, byLink.get(l.id)));
}

const inviteReason: Record<string, string> = {
  invalid_code: '코드가 맞지 않거나 시간이 지났어요. 가족에게 새 코드를 받아 주세요.',
  too_many_attempts: '여러 번 틀려서 잠시 막혔어요. 1시간 뒤에 다시 해 주세요.',
  own_code: '내가 만든 코드예요. 가족 휴대폰에서 입력해 주세요.',
  already_linked: '이미 연결된 가족이에요.',
};

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

    // ── 가족 공유 (🔒 모든 권한은 서버 함수가 다시 검사) ──
    async createFamilyInvite(input) {
      const code = await must(
        sb().rpc('create_family_invite', {
          p_relation_label: input.relationLabel,
          p_owner_label: input.ownerLabel,
          ...scopeArgs(input.scope),
          p_consent_version: CONSENT_VERSION,
        }),
      );
      return { code: String(code), expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString() };
    },
    async acceptFamilyInvite(code) {
      const res = (await must(sb().rpc('accept_family_invite', { p_code: code }))) as any;
      if (!res?.ok) throw new UserFacingError(inviteReason[res?.reason] ?? '연결하지 못했어요. 잠시 뒤 다시 해 주세요.');
      dispatch({ type: 'hydrate', data: { familyLinks: await loadFamilyLinks() } });
      return { ownerLabel: String(res.owner_label ?? '가족') };
    },
    async loadSharedSummary(linkId) {
      const json = await must(sb().rpc('get_shared_summary', { p_link_id: linkId }));
      dispatch({ type: 'summary/set', linkId, summary: toSharedSummary(linkId, json as any) });
    },
    async updateShareScope(linkId, scope) {
      if (!Object.values(scope).some(Boolean)) {
        throw new UserFacingError('하나 이상은 보여줘야 해요. 모두 그만두려면 ‘공유 그만두기’를 눌러 주세요.');
      }
      await must(sb().rpc('update_family_share_scope', { p_link_id: linkId, ...scopeArgs(scope) }));
      dispatch({ type: 'link/scope', linkId, scope });
    },
    async revokeLink(linkId) {
      await must(sb().rpc('revoke_family_link', { p_link_id: linkId }));
      dispatch({ type: 'link/revoke', linkId });
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
    async saveDailySteps(items) {
      if (!items.length) return;
      // 바뀐 날만 저장 (앱을 열 때마다 같은 값을 다시 쓰지 않도록)
      const known = new Map(getState().dailySteps.map((d) => [d.date, d.steps]));
      const changed = items.filter((i) => known.get(i.date) !== i.steps);
      if (!changed.length) return;
      await must(
        sb()
          .from('daily_steps')
          .upsert(
            changed.map((i) => ({ step_date: i.date, steps: i.steps })),
            { onConflict: 'user_id,step_date' },
          ),
      );
      dispatch({ type: 'steps/upsert', items: changed.map((i) => ({ ...i, source: 'real' as const })) });
    },
    async resetSampleData() {
      // 서버 모드에는 예시 데이터가 없다
    },
  };
}
