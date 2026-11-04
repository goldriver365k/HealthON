/**
 * 체험 모드 저장소: 메모리에만 저장 (1단계 store.tsx의 구현을 그대로 옮김).
 * 앱을 껐다 켜면 예시 데이터로 돌아간다.
 */
import type { Dispatch } from 'react';

import type { Measurement } from '@/types/domain';
import { newId, type Action } from './reducer';
import type { Repository } from './repository';

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
    updateShareScope: (linkId, scope) => run({ type: 'link/scope', linkId, scope }),
    revokeLink: (linkId) => run({ type: 'link/revoke', linkId }),
    addEmergencyContact: (input) => run({ type: 'contact/add', ...input }),
    deleteEmergencyContact: (id) => run({ type: 'contact/delete', id }),
    setFontScale: (scale) => run({ type: 'settings/fontScale', scale }),
    updateNotificationSettings: (next) => run({ type: 'settings/notifications', next }),
    resetSampleData: () => run({ type: 'reset' }),
  };
}
