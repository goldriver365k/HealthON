/**
 * 기기 안 알림 예약 (expo-notifications 로컬 알림). 서버·푸시 발송 없음.
 * - 안드로이드는 '정확한 알람' 권한을 쓰지 않는 기본 방식(bestEffort) → 기기에 따라 몇 분 늦을 수 있음
 * - 웹에서는 동작하지 않음 (미리보기용)
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedNotification } from './plan';

export const notificationsSupported = Platform.OS === 'ios' || Platform.OS === 'android';
const CHANNEL_ID = 'reminders';
/** 안드로이드 알림 채널: 소리 + 진동 + 잠금화면 표시 */
const CHANNEL: Notifications.NotificationChannelInput = {
  name: '약·병원 알림',
  importance: Notifications.AndroidImportance.HIGH,
  sound: 'default',
  vibrationPattern: [0, 400, 200, 400],
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
};

let configured = false;
function configure() {
  if (configured || !notificationsSupported) return;
  configured = true;
  // 앱을 보고 있을 때도 알림 표시
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** 휴대폰 알림 허용 창 띄우기 (반드시 안내 화면을 먼저 보여준 뒤 호출) */
export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, CHANNEL);
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** 예약된 알림을 모두 지우고 계획대로 다시 예약 */
export async function applyPlan(plan: PlannedNotification[]): Promise<number> {
  if (!notificationsSupported) return 0;
  configure();
  if ((await getPermission()) !== 'granted') return 0;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, CHANNEL);
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const p of plan) {
    // sound: 'default' — 아이폰은 알림마다 소리를 지정해야 소리가 난다
    const content = { title: p.title, body: p.body, sound: 'default', data: { url: '/' } };
    const T = Notifications.SchedulableTriggerInputTypes;
    const trigger =
      p.kind === 'daily'
        ? { type: T.DAILY, hour: p.hour, minute: p.minute, channelId: CHANNEL_ID }
        : p.kind === 'weekly'
          ? { type: T.WEEKLY, weekday: p.weekday, hour: p.hour, minute: p.minute, channelId: CHANNEL_ID }
          : { type: T.DATE, date: p.date, channelId: CHANNEL_ID };
    await Notifications.scheduleNotificationAsync({ identifier: p.id, content, trigger } as Notifications.NotificationRequestInput);
  }
  return plan.length;
}

/** 지금 예약되어 있는 알림 개수 (설정 화면 확인용) */
export async function countScheduled(): Promise<number> {
  if (!notificationsSupported) return 0;
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

/** 시험 알림: 10초 뒤 한 번. 알림이 휴대폰에 뜨는지 확인용 (건강 정보 없음) */
export async function sendTestNotification(): Promise<boolean> {
  if (!notificationsSupported) return false;
  configure();
  if ((await getPermission()) !== 'granted') return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: '💊 오늘건강 시험 알림', body: '알림이 소리와 함께 잘 와요', sound: 'default', data: { url: '/' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: CHANNEL_ID },
  } as Notifications.NotificationRequestInput);
  return true;
}
