/**
 * 만보기: 휴대폰이 세어 둔 걸음 수를 읽는다 (expo-sensors Pedometer).
 * - 아이폰: 앱이 닫혀 있어도 아이폰이 걸음을 세어 두며, 최근 7일치를 날짜별로 읽을 수 있다.
 * - 안드로이드: 기본 방식으로는 지난 걸음을 읽을 수 없어 아직 지원하지 않는다
 *   (정식 앱 빌드 후 헬스 커넥트 연결 예정).
 * - 위치는 쓰지 않는다. 날짜별 합계만 읽는다.
 */
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

import type { DateKey } from '@/types/domain';
import { addDays, startOfDay, toDateKey } from '@/utils/date';

/** 아이폰이 앱에 보여 주는 지난 기록 기간 */
export const STEP_HISTORY_DAYS = 7;

export const stepsSupported = Platform.OS === 'ios';

export type StepPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const toState = (status: string): StepPermission =>
  status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';

export async function getStepPermission(): Promise<StepPermission> {
  if (!stepsSupported) return 'unsupported';
  if (!(await Pedometer.isAvailableAsync().catch(() => false))) return 'unsupported';
  const r = await Pedometer.getPermissionsAsync();
  return toState(r.status);
}

/** '동작 및 피트니스' 허용 창 띄우기 */
export async function requestStepPermission(): Promise<StepPermission> {
  if (!stepsSupported) return 'unsupported';
  const r = await Pedometer.requestPermissionsAsync();
  return toState(r.status);
}

/** 최근 며칠의 날짜별 걸음 수 (오늘은 지금까지) */
export async function readRecentSteps(now: Date = new Date(), days = STEP_HISTORY_DAYS): Promise<{ date: DateKey; steps: number }[]> {
  if (!stepsSupported) return [];
  const today = startOfDay(now);
  const out: { date: DateKey; steps: number }[] = [];
  for (let i = 0; i < days; i++) {
    const start = addDays(today, -i);
    const end = i === 0 ? now : addDays(start, 1);
    try {
      const { steps } = await Pedometer.getStepCountAsync(start, end);
      out.push({ date: toDateKey(start), steps: Math.max(0, Math.round(steps)) });
    } catch {
      // 그날 기록이 없으면 건너뜀
    }
  }
  return out;
}
