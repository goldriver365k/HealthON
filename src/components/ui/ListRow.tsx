import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';
import { AppIcon } from './AppIcon';

interface ListRowProps {
  children: ReactNode;
  onPress?: () => void;
  /** 스크린리더가 읽을 한 문장 */
  accessibilityLabel: string;
  hint?: string;
}

/** 목록 한 줄. 누를 수 있으면 오른쪽에 '>' 표시. */
export function ListRow({ children, onPress, accessibilityLabel, hint }: ListRowProps) {
  const content = (
    <>
      <View style={styles.body}>{children}</View>
      {onPress ? <AppIcon name="next" color={colors.textSub} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.buttonHeight + 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  body: { flex: 1, gap: spacing.xs },
});
