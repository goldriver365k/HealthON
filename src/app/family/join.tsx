/**
 * 초대 코드 입력 (가족 쪽)
 * 🔒 1단계: 화면만. 3단계에서 서버 함수가 코드를 확인하고(5회 실패 시 폐기) 연결을 만든다.
 */
import { router } from 'expo-router';
import { useState } from 'react';

import { AppButton, Notice, Screen, TextField } from '@/components/ui';
import { notify } from '@/utils/confirm';

export default function JoinScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const digits = code.replace(/[^0-9]/g, '');
    if (digits.length !== 6) {
      setError('숫자 6자리를 넣어 주세요');
      return;
    }
    setError(null);
    notify('체험판 안내', '지금은 예시 화면이라 실제로 연결되지 않아요. 가족 연결은 다음 단계에서 만들어져요.');
    router.back();
  };

  return (
    <Screen title="초대 코드 입력하기" subtitle="가족에게 받은 숫자 6자리를 넣어 주세요" showBack footer={<AppButton label="확인" large onPress={submit} />}>
      <TextField label="초대 코드" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={7} big error={error} placeholder="123456" />
      <Notice tone="sample" text="체험판에서는 실제로 연결되지 않아요." />
    </Screen>
  );
}
