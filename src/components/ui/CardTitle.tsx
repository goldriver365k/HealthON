import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing, type IconName } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

/** 카드 제목: 동그란 아이콘 + 제목 (+ 오른쪽에 '예시' 표시 등). 카드 종류를 한눈에 구분하게 한다. */
export function CardTitle({ icon, title, right }: { icon: IconName; title: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.chip}>
        <AppIcon name={icon} color={colors.primary} />
      </View>
      <AppText variant="heading" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flexShrink: 1 },
});
