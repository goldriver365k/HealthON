/**
 * 약·병원·알림 설정이 바뀔 때마다 기기 알림을 다시 예약한다 (화면에 보이지 않는 부품).
 * - 알림 권한을 아직 묻지 않았다면, 한 번 안내 화면(/notifications-intro)을 보여준다.
 * - 알림을 누르면 '오늘' 화면으로 이동.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';

import { useAppState } from '@/data/store';
import { planNotifications } from './plan';
import { applyPlan, getPermission, notificationsSupported } from './scheduler';

let introShownThisRun = false;

export function NotificationSync() {
  const state = useAppState();
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

  // 알림 누르면 오늘 화면으로
  useEffect(() => {
    if (!notificationsSupported) return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => router.navigate('/'));
    return () => sub.remove();
  }, []);

  // 앱으로 돌아올 때마다 다시 예약
  // (알림 허용 창·휴대폰 설정에서 권한을 바꾼 뒤에도, 이미 등록한 약이 바로 예약되도록)
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    if (!notificationsSupported) return;
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') applyPlan(planNotifications({ ...latest.current })).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // 바뀔 때마다 다시 예약 (연속 변경은 1초 모아서)
  useEffect(() => {
    if (!notificationsSupported) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      applyPlan(planNotifications({ ...state })).catch(() => {});
    }, 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 알림에 영향 주는 데이터만 감시
  }, [medications, schedules, appointments, notificationSettings]);

  return null;
}
