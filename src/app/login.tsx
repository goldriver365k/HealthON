/**
 * 로그인 (서버 모드에서만 보임): 이메일 → 6자리 숫자코드
 * 처음이면 자동으로 가입된다. 비밀번호는 쓰지 않는다(잊어버릴 일이 없도록).
 * 카카오 로그인은 카카오 개발자 등록(사용자 작업) 후 추가 예정.
 */
import { useState } from 'react';

import { AppButton, AppText, Notice, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { useSafeAction } from '@/hooks/useSafeAction';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const auth = useAuth();
  const { run, busy } = useSafeAction();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sendCode = () =>
    run(async () => {
      const addr = email.trim().toLowerCase();
      if (!EMAIL_RE.test(addr)) {
        setError('이메일 주소를 다시 확인해 주세요');
        return;
      }
      setError(null);
      await auth.requestCode(addr);
      setStep('code');
    });

  const verify = () =>
    run(async () => {
      const digits = code.replace(/[^0-9]/g, '');
      if (digits.length !== 6) {
        setError('숫자 6자리를 넣어 주세요');
        return;
      }
      setError(null);
      await auth.verifyCode(email.trim().toLowerCase(), digits);
    });

  if (step === 'email') {
    return (
      <Screen
        title="오늘건강 시작하기"
        subtitle="약 드신 것과 혈압·혈당을 기록하도록 도와드려요"
        footer={<AppButton label={busy ? '보내는 중…' : '숫자코드 받기'} large onPress={sendCode} disabled={busy} testID="send-code" />}>
        <TextField
          label="이메일 주소"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          maxLength={100}
          error={error}
          help="이 주소로 숫자 6자리를 보내 드려요"
          placeholder="example@naver.com"
          testID="email"
        />
        <Notice text="처음 오셨으면 자동으로 가입돼요. 비밀번호는 필요 없어요." />
        <AppText variant="caption" tone="sub">
          이 앱은 기록을 돕는 앱이에요. 병을 진단하거나 약을 바꾸라고 하지 않아요.
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen
      title="숫자코드 입력"
      subtitle={`${email} 로 보낸 숫자 6자리를 넣어 주세요`}
      footer={<AppButton label={busy ? '확인 중…' : '확인'} large onPress={verify} disabled={busy} testID="verify" />}>
      <TextField
        label="숫자코드 6자리"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        big
        error={error}
        help="메일이 안 보이면 스팸함도 확인해 주세요"
        testID="code"
      />
      <AppButton label="숫자코드 다시 받기" variant="secondary" onPress={sendCode} disabled={busy} />
      <AppButton
        label="이메일 주소 다시 적기"
        variant="ghost"
        onPress={() => {
          setStep('email');
          setCode('');
          setError(null);
        }}
      />
    </Screen>
  );
}
