/**
 * 알림 권한 요청 전 안내 (앱 접근권한 고지 — MASTER_PLAN H-1 P6)
 * 휴대폰의 허용 창을 띄우기 전에 왜 필요한지 먼저 알려 준다. 거절해도 앱은 그대로 쓸 수 있다.
 */
import { router } from 'expo-router';

import { AppButton, AppIcon, AppText, Card, Screen } from '@/components/ui';
import { useSafeAction } from '@/hooks/useSafeAction';
import { requestPermission } from '@/notifications/scheduler';
import { colors } from '@/theme';
import { notify } from '@/utils/confirm';

export default function NotificationsIntroScreen() {
  const { run, busy } = useSafeAction();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      title="알림을 받으시겠어요?"
      footer={
        <>
          <AppButton
            label="알림 받기"
            large
            disabled={busy}
            onPress={() =>
              run(async () => {
                const result = await requestPermission();
                if (result === 'denied') {
                  notify('알림이 꺼져 있어요', '나중에 휴대폰 설정 > 오늘건강 > 알림에서 켤 수 있어요.');
                }
                close();
              })
            }
          />
          <AppButton label="나중에" variant="ghost" onPress={close} />
        </>
      }>
      <Card>
        <AppIcon name="meds" size={40} color={colors.primary} />
        <AppText variant="heading">약 드실 시간에 알려 드려요</AppText>
        <AppText>등록한 약의 시간에 맞춰 “약 드실 시간이에요” 알림을 보내 드려요.</AppText>
      </Card>
      <Card>
        <AppIcon name="hospital" size={40} color={colors.primary} />
        <AppText variant="heading">병원 가는 날을 알려 드려요</AppText>
        <AppText>병원 일정의 전날 저녁 또는 당일 아침에 알려 드려요.</AppText>
      </Card>
      <AppText tone="sub">
        다음 화면에서 휴대폰이 ‘알림 허용’을 물어봐요. 허용하지 않아도 앱은 그대로 쓸 수 있어요. 잠금화면에는 약 이름이 보이지 않아요.
      </AppText>
    </Screen>
  );
}
