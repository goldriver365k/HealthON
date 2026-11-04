import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, sizes, spacing } from '@/theme';

/** 흰 카드. 정보 묶음 단위. */
export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: sizes.radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
