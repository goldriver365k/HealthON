/**
 * 약·병원·알림 설정이 바뀔 때마다 기기 알림을 다시 예약한다 (화면에 보이지 않는 부품).
 * - 알림 권한을 아직 묻지 않았다면, 한 번 안내 화면(/notifications-intro)을 보여준다.
 * - 알림을 누르면 '오늘' 화면으로 이동하고, 화면 2/3 크기의 큰 알림창(ReminderModal)을 띄운다.
 * - 앱을 보고 있을 때 알림 시간이 되어도 큰 알림창을 띄운다 (소리는 휴대폰 알림음).
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';

import { useAppState } from '@/data/store';
import { movedInLastHour } from '@/steps/pedometer';
import { useMoveSettings } from './moveSettings';
import { planNotifications } from './plan';
import { ReminderModal, type ActiveReminder } from './ReminderModal';
import { applyPlan, getPermission, notificationsSupported, readReminderData } from './scheduler';

let introShownThisRun = false;
/** 이미 큰 알림창으로 보여 준 알림 (같은 알림을 두 번 띄우지 않기) */
const shownIds = new Set<string>();

function toReminder(n: Notifications.Notification): ActiveReminder | null {
  const data = readReminderData(n.request.content.data);
  if (!data) return null;
  return { title: n.request.content.title ?? '', body: n.request.content.body ?? '', data };
}

export function NotificationSync() {
  const state = useAppState();
  const move = useMoveSettings();
  const [reminder, setReminder] = useState<ActiveReminder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { medications, schedules, appointments, notificationSettings } = state;

  // 처음 실행: 권한을 아직 묻지 않았으면 안내 화면
  useEffect(() => {
    if (!notificationsSupported || introShownThisRun) return;
    getPermission().then((p) => {
      if (p === 'undetermined' && !introShownThisRun) {
        introShownThisRun = true;
        setTimeout(() => router.push('/notifications-intro'), 300);
      }
    });
  }, []);

  // 알림을 누르면 오늘 화면 + 큰 알림창, 앱을 보고 있을 때 알림이 오면 큰 알림창
  useEffect(() => {
    if (!notificationsSupported) return;
    const show = (n: Notifications.Notification) => {
      const id = n.request.identifier + n.date;
      if (shownIds.has(id)) return;
      shownIds.add(id);
      const r = toReminder(n);
      if (r) setReminder(r);
    };
    const onTap = (res: Notifications.NotificationResponse) => {
      router.navigate('/');
      show(res.notification);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    // 앱이 꺼져 있다가 알림을 눌러 켜진 경우
    // (30분 넘게 지난 알림은 다시 띄우지 않음)
    Notifications.getLastNotificationResponseAsync()
      .then((res) => {
        if (res && Date.now() - res.notification.date < 30 * 60_000) onTap(res);
      })
      .catch(() => {});
    const tapSub = Notifications.addNotificationResponseReceivedListener(onTap);
    const recvSub = Notifications.addNotificationReceivedListener(async (n) => {
      const data = readReminderData(n.request.content.data);
      if (data?.kind === 'move' && (await movedInLastHour())) return; // 최근에 걸었으면 건너뜀
      show(n);
    });
    return () => {
      tapSub.remove();
      recvSub.remove();
    };
  }, []);

  // 앱으로 돌아올 때마다 다시 예약
  // (알림 허용 창·휴대폰 설정에서 권한을 바꾼 뒤에도, 이미 등록한 약이 바로 예약되도록)
  const latest = useRef(state);
  latest.current = state;
  const latestMove = useRef(move);
  latestMove.current = move;
  useEffect(() => {
    if (!notificationsSupported) return;
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') applyPlan(planNotifications({ ...latest.current }, new Date(), latestMove.current)).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // 바뀔 때마다 다시 예약 (연속 변경은 1초 모아서)
  useEffect(() => {
    if (!notificationsSupported) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      applyPlan(planNotifications({ ...state }, new Date(), move)).catch(() => {});
    }, 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 알림에 영향 주는 데이터만 감시
  }, [medications, schedules, appointments, notificationSettings, move]);

  return <ReminderModal reminder={reminder} onClose={() => setReminder(null)} />;
}
