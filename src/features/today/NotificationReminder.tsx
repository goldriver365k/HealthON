/**
 * 알림을 허용하지 않은 사람에게 '오늘' 화면 맨 위에 계속 보이는 안내.
 * - 아직 묻지 않았으면: [알림 켜기] → 휴대폰 허용 창
 * - 이미 '허용 안 함'을 눌렀으면: 휴대폰이 다시 묻지 않으므로 [휴대폰 설정 열기]
 * - 허용하면 바로 사라진다 (앱으로 돌아올 때마다 다시 확인)
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState as RNAppState, Linking } from 'react-native';

import { AppButton, AppText, Card, Notice } from '@/components/ui';
import { getPermission, notificationsSupported, requestPermission, type PermissionState } from '@/notifications/scheduler';

export function NotificationReminder() {
  const [permission, setPermission] = useState<PermissionState>('unsupported');

  const refresh = useCallback(() => {
    getPermission().then(setPermission).catch(() => {});
  }, []);

  useEffect(() => {
    if (!notificationsSupported) return;
    refresh();
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (permission === 'granted' || permission === 'unsupported') return null;

  const denied = permission === 'denied';
  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        알림이 꺼져 있어요
      </AppText>
      <Notice
        text={
          denied
            ? '약 먹을 시간·병원 가는 날을 알려 드리려면 휴대폰 설정에서 알림을 켜 주세요. 아래 버튼을 누르고 ‘알림’ → ‘알림 허용’을 켜면 돼요.'
            : '약 먹을 시간·병원 가는 날을 소리로 알려 드려요. 아래 버튼을 누르고 ‘허용’을 눌러 주세요.'
        }
      />
      <AppButton
        label={denied ? '휴대폰 설정 열기' : '알림 켜기'}
        icon={denied ? 'settings' : 'meds'}
        onPress={async () => {
          if (denied) await Linking.openSettings().catch(() => {});
          else setPermission(await requestPermission());
        }}
      />
    </Card>
  );
}
