/**
 * 기기 안 알림 예약 (expo-notifications 로컬 알림). 서버·푸시 발송 없음.
 * - 안드로이드는 '정확한 알람' 권한을 쓰지 않는 기본 방식(bestEffort) → 기기에 따라 몇 분 늦을 수 있음
 * - 웹에서는 동작하지 않음 (미리보기용)
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { movedInLastHour } from '@/steps/pedometer';
import { toTimeOfDay } from '@/utils/date';

import type { PlannedNotification, ReminderData } from './plan';

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
  // 앱을 보고 있을 때: 소리는 내고, 작은 배너 대신 앱 안의 큰 알림창(ReminderModal)을 띄운다
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const data = readReminderData(n.request.content.data);
      if (data?.kind === 'move' && (await movedInLastHour())) {
        // 최근 1시간에 걸었으면 움직임 알림은 조용히 건너뜀
        return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
      }
      return { shouldShowBanner: !data, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}

/** 알림에 담긴 정보 읽기 (모르는 형식이면 null) */
export function readReminderData(raw: unknown): ReminderData | null {
  const d = raw as Partial<ReminderData> | null | undefined;
  if (!d || typeof d !== 'object') return null;
  if (d.kind === 'med' && Array.isArray((d as { scheduleIds?: unknown }).scheduleIds)) return d as ReminderData;
  if (d.kind === 'apt' && typeof (d as { appointmentId?: unknown }).appointmentId === 'string') return d as ReminderData;
  if (d.kind === 'move') return { kind: 'move' };
  return null;
}

const SNOOZE_PREFIX = 'snooze|';

/** 10분 뒤 다시 알려 주기 (같은 내용으로 한 번) */
export async function snoozeReminder(title: string, body: string, data: ReminderData, minutes = 10): Promise<void> {
  if (!notificationsSupported) return;
  configure();
  await Notifications.scheduleNotificationAsync({
    identifier: `${SNOOZE_PREFIX}${Date.now()}`,
    content: { title, body, sound: 'default', data: { ...data, url: '/' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: CHANNEL_ID },
  } as Notifications.NotificationRequestInput);
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
  // 다시 예약하기 전에 지운다. '10분 뒤 다시' 알림은 남겨 둔다
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => !n.identifier.startsWith(SNOOZE_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  for (const p of plan) {
    // sound: 'default' — 아이폰은 알림마다 소리를 지정해야 소리가 난다
    const content = { title: p.title, body: p.body, sound: 'default', data: { ...p.data, url: '/' } };
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
    // 큰 알림창도 확인할 수 있도록 약 알림 모양으로 (약 일정은 비어 있어 [먹었어요]를 눌러도 기록되지 않음)
    content: {
      title: '💊 오늘건강 시험 알림',
      body: '알림이 소리와 함께 잘 와요',
      sound: 'default',
      data: { kind: 'med', time: toTimeOfDay(new Date(Date.now() + 10_000)), scheduleIds: [], url: '/' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: CHANNEL_ID },
  } as Notifications.NotificationRequestInput);
  return true;
}
