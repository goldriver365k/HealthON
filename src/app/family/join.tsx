/**
 * 초대 코드 입력 (보는 가족 쪽)
 * 🔒 서버 모드: 서버 함수(accept_family_invite)가 코드 확인·만료·1회용·시도 횟수 제한(1시간 5번)을 검사하고 연결을 만든다.
 *    체험 모드: 123456을 넣으면 '체험 가족'이 예시로 연결된다.
 */
import { router } from 'expo-router';
import { useState } from 'react';

import { AppButton, Notice, Screen, TextField, useFlash } from '@/components/ui';
import { dataMode } from '@/data/config';
import { useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';

export default function JoinScreen() {
  const repo = useRepository();
  const flash = useFlash();
  const { run, busy } = useSafeAction();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    run(async () => {
      const digits = code.replace(/[^0-9]/g, '');
      if (digits.length !== 6) {
        setError('숫자 6자리를 넣어 주세요');
        return;
      }
      setError(null);
      const { ownerLabel } = await repo.acceptFamilyInvite(digits);
      if (router.canGoBack()) router.back();
      else router.replace('/family');
      flash({ message: `연결됐어요: ${ownerLabel}` });
    });

  return (
    <Screen
      title="초대 코드 입력하기"
      subtitle="가족에게 받은 숫자 6자리를 넣어 주세요"
      showBack
      footer={<AppButton label={busy ? '확인 중…' : '확인'} large onPress={submit} disabled={busy} testID="join-submit" />}>
      <TextField label="초대 코드" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={7} big error={error} placeholder="123456" testID="join-code" />
      <Notice text="연결되면 가족이 허락한 정보만 볼 수 있어요. 언제든 ‘그만 보기’를 누를 수 있어요." />
      {dataMode === 'demo' ? <Notice tone="sample" text="체험판에서는 123456을 넣으면 예시 가족이 연결돼요." /> : null}
    </Screen>
  );
}
