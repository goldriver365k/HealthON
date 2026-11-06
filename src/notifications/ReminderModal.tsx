/**
 * 큰 알림창: 약 먹을 시간 / 병원 가는 날 / 움직임 알림.
 * 화면 높이의 2/3. 앱을 보고 있을 때 알림 시간이 되거나, 알림을 눌러 앱이 열리면 뜬다.
 * - 약: [먹었어요] → 오늘 그 시간 약을 먹은 것으로 표시 / [10분 뒤 다시 알려 주세요]
 * - 병원: [확인했어요] / 일정 보기
 * - 움직임: [알겠어요]
 * ⚠ 알림 문구에 건강 판정·지시 없음. 애니메이션 없음.
 */
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText } from '@/components/ui';
import { useAppState, useRepository } from '@/data/store';
import { colors, sizes, spacing } from '@/theme';
import { formatTime, formatTimeOfDay, toDateKey } from '@/utils/date';
import type { ReminderData } from './plan';
import { snoozeReminder } from './scheduler';

export interface ActiveReminder {
  title: string;
  body: string;
  data: ReminderData;
}

export function ReminderModal({ reminder, onClose }: { reminder: ActiveReminder | null; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const state = useAppState();
  const repo = useRepository();
  if (!reminder) return null;
  const { data } = reminder;

  // 앱 안에서는 약 이름·병원 이름을 보여 준다 (잠금화면 알림에는 숨김)
  let heading = reminder.title;
  let lines: string[] = [];
  let icon: 'meds' | 'hospital' | 'steps' = 'meds';
  if (data.kind === 'med') {
    heading = '약 먹을 시간이에요';
    const names = data.scheduleIds
      .map((id) => state.schedules.find((s) => s.id === id))
      .map((s) => s && state.medications.find((m) => m.id === s.medicationId)?.name)
      .filter((n): n is string => !!n);
    lines = [formatTimeOfDay(data.time), ...(names.length ? names : [reminder.body])];
  } else if (data.kind === 'apt') {
    icon = 'hospital';
    heading = '병원 가는 날이에요';
    const a = state.appointments.find((x) => x.id === data.appointmentId);
    lines = a ? [`${formatTime(new Date(a.visitAt))} · ${a.hospitalName}`, ...(a.department ? [a.department] : [])] : [reminder.body];
  } else {
    icon = 'steps';
    heading = '잠깐 움직여 볼까요?';
    lines = ['오래 앉아 계셨다면 잠깐 일어나서 걸어 보세요.'];
  }

  const taken = async () => {
    if (data.kind !== 'med') return;
    const today = toDateKey(new Date());
    await Promise.all(data.scheduleIds.map((id) => repo.setIntake(id, today, 'taken'))).catch(() => {});
    onClose();
  };
  const snooze = async () => {
    await snoozeReminder(reminder.title, reminder.body, data).catch(() => {});
    onClose();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityRole="button" accessibilityLabel="알림창 닫기" />
        <View style={[styles.sheet, { height: Math.round((height * 2) / 3), paddingBottom: spacing.lg + insets.bottom }]}>
          <ScrollView contentContainerStyle={styles.body}>
            <AppIcon name={icon} size={56} color={colors.primary} />
            <AppText variant="title" center accessibilityRole="header">
              {heading}
            </AppText>
            {lines.map((l, i) => (
              <AppText key={i} variant={i === 0 ? 'number' : 'heading'} center>
                {l}
              </AppText>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            {data.kind === 'med' ? (
              <>
                <AppButton label="먹었어요" icon="done" large onPress={taken} />
                <AppButton label="10분 뒤 다시 알려 주세요" variant="secondary" onPress={snooze} />
              </>
            ) : data.kind === 'apt' ? (
              <>
                <AppButton label="확인했어요" icon="done" large onPress={onClose} />
                <AppButton
                  label="일정·물어볼 것 보기"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    router.push({ pathname: '/appointments/[id]', params: { id: data.appointmentId } });
                  }}
                />
              </>
            ) : (
              <AppButton label="알겠어요" icon="done" large onPress={onClose} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: sizes.radius * 2,
    borderTopRightRadius: sizes.radius * 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  body: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  actions: { gap: spacing.md },
});
