/**
 * 설정: 글씨 크기, 알림, (서버 모드) 동의 내역·로그아웃·계정 삭제, 앱 안내, (체험 모드) 예시 데이터 되돌리기
 * 🔒 동의 철회·계정 삭제는 보안 검토 대상
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppButton, AppText, Card, ChoiceButtons, Notice, Screen, useFlash } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { useAppState, useFontScale, useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';
import { countScheduled, getPermission, notificationsSupported, sendTestNotification, type PermissionState } from '@/notifications/scheduler';
import { fontScaleOptions } from '@/theme';
import type { ConsentType } from '@/types/domain';
import { confirmAsync, notify } from '@/utils/confirm';
import { formatLongDate } from '@/utils/date';

const consentName: Record<ConsentType, string> = {
  terms: '서비스 이용약관',
  privacy: '개인정보 수집·이용',
  sensitive_health: '건강정보 처리',
  age_14: '만 14세 이상 확인',
};

const onOff = [
  { value: 'on', label: '켜기' },
  { value: 'off', label: '끄기' },
] as const;

function NotificationCard() {
  const state = useAppState();
  const repo = useRepository();
  const { run } = useSafeAction();
  const ns = state.notificationSettings;
  const [permission, setPermission] = useState<PermissionState>('unsupported');

  const [scheduled, setScheduled] = useState<number | null>(null);

  useEffect(() => {
    getPermission().then(setPermission);
    countScheduled().then(setScheduled).catch(() => {});
  }, []);

  const test = () =>
    run(async () => {
      const ok = await sendTestNotification();
      if (ok) notify('10초 뒤에 시험 알림이 와요', '홈 화면으로 나가서 기다려 보세요. 알림이 오지 않으면 휴대폰 설정에서 알림이 켜져 있는지 확인해 주세요.');
      else notify('알림이 꺼져 있어요', '휴대폰 설정에서 알림을 켜 주세요.');
    });

  const update = (patch: Partial<typeof ns>) => run(() => repo.updateNotificationSettings({ ...ns, ...patch }));

  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        알림
      </AppText>
      {!notificationsSupported ? (
        <Notice text="알림은 휴대폰 앱에서만 동작해요." />
      ) : permission !== 'granted' ? (
        <>
          <Notice text={permission === 'denied' ? '휴대폰 설정에서 알림이 꺼져 있어요. 휴대폰 설정 > 알림에서 이 앱(시험 중에는 Expo Go)을 켜 주세요.' : '아직 알림을 허용하지 않았어요.'} />
          {permission === 'undetermined' ? (
            <AppButton label="알림 받기" variant="secondary" onPress={() => router.push('/notifications-intro')} />
          ) : null}
        </>
      ) : (
        <>
          {scheduled !== null ? <Notice text={`지금 예약된 알림: ${scheduled}개`} /> : null}
          <AppButton label="시험 알림 받기 (10초 뒤)" variant="secondary" onPress={test} />
        </>
      )}
      <ChoiceButtons label="약 알림" options={onOff} value={ns.medsEnabled ? 'on' : 'off'} onChange={(v) => update({ medsEnabled: v === 'on' })} />
      <ChoiceButtons label="병원 알림" options={onOff} value={ns.appointmentsEnabled ? 'on' : 'off'} onChange={(v) => update({ appointmentsEnabled: v === 'on' })} />
      <ChoiceButtons
        label="잠금화면 알림에 약 이름 보이기"
        options={[
          { value: 'hide', label: '숨기기' },
          { value: 'show', label: '보이기' },
        ]}
        value={ns.showMedName ? 'show' : 'hide'}
        onChange={(v) => update({ showMedName: v === 'show' })}
      />
      <AppText variant="caption" tone="sub">
        숨기면 “아침 약을 확인해 주세요”처럼만 보여요. 다른 사람이 휴대폰을 볼 수 있다면 숨기기를 권해요.
      </AppText>
    </Card>
  );
}

function AccountCard() {
  const auth = useAuth();
  const flash = useFlash();
  const { run, busy } = useSafeAction();
  const active = auth.consents.filter((c) => !c.withdrawnAt);

  const withdraw = () =>
    run(async () => {
      const ok = await confirmAsync({
        title: '건강정보 처리 동의를 철회할까요?',
        message: '철회하면 새 기록을 저장할 수 없고, 앱을 쓰려면 다시 동의해야 해요. 지금까지의 기록은 지워지지 않아요. 기록까지 지우려면 ‘계정 삭제’를 눌러 주세요.',
        confirmLabel: '철회하기',
        destructive: true,
      });
      if (ok) await auth.withdrawHealthConsent();
    });

  const remove = () =>
    run(async () => {
      const ok1 = await confirmAsync({
        title: '계정을 삭제할까요?',
        message: '혈압·혈당·약·병원 기록이 모두 지워지고 되살릴 수 없어요.',
        confirmLabel: '삭제 계속',
        destructive: true,
      });
      if (!ok1) return;
      const ok2 = await confirmAsync({
        title: '정말 삭제할까요?',
        message: '마지막 확인이에요. 삭제하면 바로 로그아웃돼요.',
        confirmLabel: '계정 삭제',
        destructive: true,
      });
      if (!ok2) return;
      await auth.deleteAccount();
      flash({ message: '계정과 기록을 모두 지웠어요' });
    });

  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        내 계정
      </AppText>
      <AppText>로그인한 이메일: {auth.email ?? '-'}</AppText>
      <AppText bold>동의한 항목</AppText>
      {active.map((c) => (
        <AppText key={c.id} tone="sub">
          · {consentName[c.consentType]} ({formatLongDate(new Date(c.agreedAt))})
        </AppText>
      ))}
      <AppButton label="건강정보 동의 철회" variant="secondary" onPress={withdraw} disabled={busy} />
      <AppButton label="로그아웃" variant="secondary" onPress={() => run(() => auth.signOut())} disabled={busy} />
      <AppButton label="계정 삭제" variant="danger" icon="delete" onPress={remove} disabled={busy} testID="delete-account" />
    </Card>
  );
}

export default function SettingsScreen() {
  const auth = useAuth();
  const repo = useRepository();
  const fontScale = useFontScale();
  const flash = useFlash();
  const { run } = useSafeAction();

  return (
    <Screen title="설정" showBack>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          글씨 크기
        </AppText>
        <ChoiceButtons options={fontScaleOptions} value={fontScale} onChange={(v) => run(() => repo.setFontScale(v))} columns={1} />
        <AppText>이 글씨가 잘 보이세요? 잘 안 보이면 더 크게 바꿔 보세요.</AppText>
        <AppText variant="caption" tone="sub">
          휴대폰 설정의 글씨 크기도 함께 적용돼요.
        </AppText>
      </Card>

      <NotificationCard />

      {auth.mode === 'cloud' ? <AccountCard /> : null}

      <Card>
        <AppText variant="heading" accessibilityRole="header">
          이 앱에 대해
        </AppText>
        <AppText>오늘건강은 약 드신 것과 혈압·혈당을 기록하도록 돕는 앱이에요.</AppText>
        <AppText>병을 진단하거나, 약을 바꾸라고 하거나, 건강 상태를 판정하지 않아요.</AppText>
        <AppText bold>몸이 불편하면 꼭 의료진과 상담하세요. 급할 때는 119에 전화하세요.</AppText>
      </Card>

      {auth.mode === 'demo' ? (
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            체험판
          </AppText>
          <Notice tone="sample" text="지금은 체험판이에요. 서버가 연결되지 않아 앱을 완전히 껐다 켜면 예시 데이터로 돌아가요." />
          <AppButton
            label="예시 데이터로 되돌리기"
            variant="secondary"
            onPress={() =>
              run(async () => {
                const ok = await confirmAsync({
                  title: '처음 상태로 되돌릴까요?',
                  message: '직접 입력한 내용이 모두 지워지고 예시 데이터로 바뀌어요.',
                  confirmLabel: '되돌리기',
                  destructive: true,
                });
                if (!ok) return;
                await repo.resetSampleData();
                flash({ message: '예시 데이터로 되돌렸어요' });
              })
            }
          />
        </Card>
      ) : null}
    </Screen>
  );
}
