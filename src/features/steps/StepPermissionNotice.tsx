/**
 * 걸음 수를 읽을 수 없을 때의 안내 (오늘 화면·건강기록 공용).
 * - 아직 묻지 않음: [걸음 수 가져오기] → '동작 및 피트니스' 허용 창
 * - 거절함: [휴대폰 설정 열기]
 * - 안드로이드·지원 안 되는 기기: 안내만
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState as RNAppState, Linking } from 'react-native';

import { AppButton, Notice } from '@/components/ui';
import { useRepository } from '@/data/store';
import { getStepPermission, readRecentSteps, requestStepPermission, type StepPermission } from '@/steps/pedometer';

export function useStepPermission() {
  const [permission, setPermission] = useState<StepPermission | null>(null);
  const refresh = useCallback(() => {
    getStepPermission().then(setPermission).catch(() => setPermission('unsupported'));
  }, []);
  useEffect(() => {
    refresh();
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);
  return { permission, setPermission };
}

export function StepPermissionNotice({ permission, onChange }: { permission: StepPermission | null; onChange: (p: StepPermission) => void }) {
  const repo = useRepository();
  if (permission === null || permission === 'granted') return null;
  if (permission === 'unsupported') {
    return <Notice text="이 휴대폰에서는 아직 걸음 수를 가져올 수 없어요. (지금은 아이폰만 돼요. 안드로이드는 다음 업데이트에서 지원할 예정이에요)" />;
  }
  if (permission === 'denied') {
    return (
      <>
        <Notice text="걸음 수를 가져오려면 휴대폰 설정에서 ‘동작 및 피트니스’를 켜 주세요." />
        <AppButton label="휴대폰 설정 열기" icon="settings" variant="secondary" onPress={() => Linking.openSettings().catch(() => {})} />
      </>
    );
  }
  return (
    <>
      <Notice text="휴대폰이 세어 둔 걸음 수를 가져와요. 앱을 닫아 두어도 휴대폰이 걸음을 세어 둬요. 아래 버튼을 누르고 ‘허용’을 눌러 주세요." />
      <AppButton
        label="걸음 수 가져오기"
        icon="steps"
        onPress={async () => {
          const p = await requestStepPermission();
          onChange(p);
          if (p === 'granted') await repo.saveDailySteps(await readRecentSteps()).catch(() => {});
        }}
      />
    </>
  );
}
