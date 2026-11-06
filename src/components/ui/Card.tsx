import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, shadows, sizes, spacing } from '@/theme';

/** 흰 카드. 정보 묶음 단위. 옅은 그림자로 배경에서 떠 보이게. */
export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: sizes.radiusCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    boxShadow: shadows.card,
  },
});
