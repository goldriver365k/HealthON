/**
 * 걸음 수를 휴대폰에서 읽어 저장한다 (화면에 보이지 않는 부품).
 * - 앱을 열 때, 앱으로 돌아올 때, 앱을 보고 있는 동안 1분마다
 * - 최근 7일치를 읽어 바뀐 날만 저장 → 일주일에 한 번 이상 앱을 열면 기록이 빠지지 않는다
 * - ⚠ 걸음 수를 로그에 남기지 않는다
 */
import { useEffect, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';

import { useRepository } from '@/data/store';
import { getStepPermission, readRecentSteps, stepsSupported } from './pedometer';

const REFRESH_MS = 60_000;

export function StepSync() {
  const repo = useRepository();
  const busy = useRef(false);

  useEffect(() => {
    if (!stepsSupported) return;
    const sync = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        if ((await getStepPermission()) !== 'granted') return;
        await repo.saveDailySteps(await readRecentSteps());
      } catch {
        // 인터넷이 없거나 일시 오류 → 다음 기회에 다시
      } finally {
        busy.current = false;
      }
    };
    sync();
    const timer = setInterval(() => RNAppState.currentState === 'active' && sync(), REFRESH_MS);
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [repo]);

  return null;
}
