/**
 * 큰 달력 창. 화면 높이의 2/3를 차지하고, 날짜 칸이 남는 높이를 나눠 크게 보인다.
 * - 추가 패키지 없이 구현 (React Native Modal + 버튼 칸)
 * - 애니메이션 없음, 고른 날은 굵은 테두리 + 굵은 글씨 + 배경 (색만으로 구분하지 않음)
 * - 오늘은 진한 테두리, 스크린리더에는 "오늘"이라고 읽어 준다
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizes, spacing } from '@/theme';
import { addMonths, formatLongDate, formatYearMonth, isSameDay, monthGrid, startOfDay, WEEKDAY_NAMES } from '@/utils/date';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

interface Props {
  visible: boolean;
  title: string;
  value: Date;
  onSelect: (day: Date) => void;
  onClose: () => void;
}

export function CalendarModal({ visible, title, value, onSelect, onClose }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 보여 줄 달 (처음에는 고른 날이 있는 달)
  const [shown, setShown] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const today = startOfDay(new Date());
  const weeks = monthGrid(shown.getFullYear(), shown.getMonth());

  const onShow = () => setShown(new Date(value.getFullYear(), value.getMonth(), 1));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} onShow={onShow}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityRole="button" accessibilityLabel="달력 닫기" />
        <View style={[styles.sheet, { height: Math.round((height * 2) / 3), paddingBottom: spacing.lg + insets.bottom }]}>
          <AppText variant="heading" center>
            {title}
          </AppText>

          <View style={styles.monthRow}>
            <AppButton
              label="이전"
              accessibilityLabel="이전 달"
              icon="back"
              variant="secondary"
              block={false}
              style={styles.monthBtn}
              onPress={() => setShown(addMonths(shown, -1))}
            />
            <AppText variant="heading" center numberOfLines={1} adjustsFontSizeToFit style={styles.monthText} accessibilityRole="header">
              {formatYearMonth(shown)}
            </AppText>
            <AppButton
              label="다음"
              accessibilityLabel="다음 달"
              icon="next"
              variant="secondary"
              block={false}
              style={styles.monthBtn}
              onPress={() => setShown(addMonths(shown, 1))}
            />
          </View>

          <View style={styles.weekRow} importantForAccessibility="no-hide-descendants">
            {WEEKDAY_NAMES.map((w) => (
              <AppText key={w} variant="label" bold center tone="sub" style={styles.weekday}>
                {w}
              </AppText>
            ))}
          </View>

          <View style={styles.grid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.week}>
                {week.map((day, di) => {
                  if (!day) return <View key={di} style={styles.cell} />;
                  const selected = isSameDay(day, value);
                  const isToday = isSameDay(day, today);
                  return (
                    <Pressable
                      key={di}
                      onPress={() => onSelect(day)}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatLongDate(day)}${isToday ? ', 오늘' : ''}`}
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.cell,
                        styles.day,
                        isToday && styles.today,
                        selected && styles.selected,
                        pressed && styles.pressed,
                      ]}>
                      <AppText variant="heading" bold={selected} tone={selected ? 'primary' : 'default'}>
                        {day.getDate()}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <AppText tone="sub" center>
            진한 테두리가 오늘이에요 ({formatLongDate(today)})
          </AppText>
          <AppButton label="닫기" variant="ghost" onPress={onClose} />
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
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthBtn: { paddingHorizontal: spacing.sm },
  monthText: { flex: 1 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1 },
  grid: { flex: 1, gap: spacing.xs },
  week: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  cell: { flex: 1 },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizes.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  today: { borderColor: colors.borderStrong, borderWidth: 3 },
  selected: { borderColor: colors.primary, borderWidth: 4, backgroundColor: colors.primarySoft },
  pressed: { backgroundColor: colors.surfaceMuted },
});
