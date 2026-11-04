/**
 * 체험 모드 저장소: 메모리에만 저장 (1단계 store.tsx의 구현을 그대로 옮김).
 * 앱을 껐다 켜면 예시 데이터로 돌아간다.
 */
import type { Dispatch } from 'react';

import type { FamilyLink, Measurement, SharedSummary } from '@/types/domain';
import { UserFacingError } from './errors';
import { newId, type Action } from './reducer';
import type { Repository } from './repository';

export const DEMO_INVITE_CODE = '123456';

export function createMemoryRepository(dispatch: Dispatch<Action>): Repository {
  const run = (action: Action) => {
    dispatch(action);
    return Promise.resolve();
  };
  return {
    addMeasurement: async (input) => {
      const id = newId();
      dispatch({ type: 'measurement/add', item: { ...input, id, source: 'real' } as Measurement });
      return id;
    },
    updateMeasurement: (id, input) => run({ type: 'measurement/update', id, input }),
    deleteMeasurement: (id) => run({ type: 'measurement/delete', id }),
    setIntake: (scheduleId, date, status) => run({ type: 'intake/set', scheduleId, date, status }),
    clearIntake: (scheduleId, date) => run({ type: 'intake/clear', scheduleId, date }),
    addMedication: async (input) => {
      const id = newId();
      dispatch({ type: 'medication/add', id, input });
      return id;
    },
    updateMedication: (id, input) => run({ type: 'medication/update', id, input }),
    setMedicationActive: (id, isActive) => run({ type: 'medication/active', id, isActive }),
    deleteMedication: (id) => run({ type: 'medication/delete', id }),
    addAppointment: async (input) => {
      const id = newId();
      dispatch({ type: 'appointment/add', item: { ...input, id, source: 'real' } });
      return id;
    },
    updateAppointment: (id, input) => run({ type: 'appointment/update', id, input }),
    deleteAppointment: (id) => run({ type: 'appointment/delete', id }),
    addQuestion: (appointmentId, content) => run({ type: 'question/add', appointmentId, content }),
    toggleQuestion: (id) => run({ type: 'question/toggle', id }),
    deleteQuestion: (id) => run({ type: 'question/delete', id }),
    // 체험 모드: 코드는 항상 123456, 실제 연결 없음
    createFamilyInvite: async () => ({
      code: DEMO_INVITE_CODE,
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    }),
    acceptFamilyInvite: async (code) => {
      if (code.replace(/[^0-9]/g, '') !== DEMO_INVITE_CODE) {
        throw new UserFacingError('코드가 맞지 않거나 시간이 지났어요. 가족에게 새 코드를 받아 주세요. (체험판 코드: 123456)');
      }
      const id = newId();
      const now = new Date();
      const link: FamilyLink = {
        id,
        role: 'viewer',
        personName: '체험 가족',
        relationLabel: '',
        scope: { bp: true, glucose: true, weight: false, intakes: true, appointments: false },
        status: 'active',
        consentedAt: now.toISOString(),
        source: 'sample',
      };
      const summary: SharedSummary = {
        linkId: id,
        todayIntakes: [{ label: '아침 약 (오전 8:00)', taken: true }],
        recentBp: [{ measuredAt: now.toISOString(), systolic: 127, diastolic: 81 }],
        recentGlucose: [{ measuredAt: now.toISOString(), glucoseMgdl: 101, glucoseTiming: 'fasting' }],
        source: 'sample',
      };
      dispatch({ type: 'link/add', link, summary });
      return { ownerLabel: '체험 가족' };
    },
    loadSharedSummary: async () => {
      // 체험 모드는 예시 요약이 이미 들어 있음
    },
    updateShareScope: (linkId, scope) => run({ type: 'link/scope', linkId, scope }),
    revokeLink: (linkId) => run({ type: 'link/revoke', linkId }),
    addEmergencyContact: (input) => run({ type: 'contact/add', ...input }),
    deleteEmergencyContact: (id) => run({ type: 'contact/delete', id }),
    setFontScale: (scale) => run({ type: 'settings/fontScale', scale }),
    updateNotificationSettings: (next) => run({ type: 'settings/notifications', next }),
    resetSampleData: () => run({ type: 'reset' }),
    // 체험 모드: 실제 걸음 수를 읽었으면 화면에만 반영 (앱을 다시 켜면 사라짐)
    saveDailySteps: (items) => run({ type: 'steps/upsert', items: items.map((i) => ({ ...i, source: 'real' as const })) }),
  };
}
