import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, SampleBadge, StatusMark, useFlash } from '@/components/ui';
import type { DoseItem } from '@/data/selectors';
import { useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';
import { colors, spacing } from '@/theme';
import { confirmAsync } from '@/utils/confirm';
import { formatTime, formatTimeOfDay } from '@/utils/date';
import { doseSlotLabel } from '@/utils/labels';

/** 오늘 먹을 약 한 줄: 이름·시간·상태 + [먹었어요] 버튼 */
export function DoseRow({ item, dateKey }: { item: DoseItem; dateKey: string }) {
  const repo = useRepository();
  const flash = useFlash();
  const { run, busy } = useSafeAction();
  const { schedule, medication, intake } = item;
  const taken = intake?.status === 'taken';
  const slot = doseSlotLabel[schedule.slot];
  const time = formatTimeOfDay(schedule.timeOfDay);

  const markTaken = () => run(async () => {
    await repo.setIntake(schedule.id, dateKey, 'taken');
    flash({
      message: `${slot} ${medication.name} 먹었다고 표시했어요`,
      undo: () => repo.clearIntake(schedule.id, dateKey),
    });
  });

  const undoTaken = () => run(async () => {
    const ok = await confirmAsync({
      title: '먹었다는 표시를 취소할까요?',
      message: `${slot} ${medication.name}`,
      confirmLabel: '표시 취소',
    });
    if (ok) await repo.clearIntake(schedule.id, dateKey);
  });

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <View style={styles.titleLine}>
          <AppText variant="heading" style={styles.name}>
            {medication.name}
          </AppText>
          <SampleBadge source={medication.source} />
        </View>
        <AppText tone="sub">
          {slot} · {time}
          {medication.doseText ? ` · ${medication.doseText}` : ''}
        </AppText>
        <StatusMark
          done={taken}
          doneText={`먹었어요 ${intake ? formatTime(new Date(intake.checkedAt)) : ''}`}
          todoText="아직 안 드셨어요"
        />
      </View>
      {taken ? (
        <AppButton
          label="표시 취소"
          variant="ghost"
          onPress={undoTaken}
          accessibilityLabel={`${slot} ${medication.name} 먹었다는 표시 취소`}
        />
      ) : (
        <AppButton
          label="먹었어요"
          icon="done"
          onPress={markTaken}
          disabled={busy}
          accessibilityLabel={`${slot} ${medication.name} 먹었어요`}
          hint="누르면 먹은 것으로 표시돼요"
          testID={`take-${schedule.id}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1, // 약 사이 구분선 (마지막 약 아래에는 선이 남지 않게 위쪽에)
    borderTopColor: colors.border,
  },
  info: { gap: spacing.xs },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { flexShrink: 1 },
});
