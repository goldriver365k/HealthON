import { StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

/** 안내 상자 (정보 아이콘 + 글). tone="sample"은 체험판·예시 안내용 */
export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'sample' }) {
  return (
    <View style={[styles.box, tone === 'sample' ? styles.sample : styles.info]} accessible accessibilityLabel={`안내: ${text}`}>
      <AppIcon name="info" color={tone === 'sample' ? colors.sampleText : colors.primary} />
      <AppText variant="caption" tone={tone === 'sample' ? 'sample' : 'default'} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

/** 빈 목록 안내 */
export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <AppText tone="sub" center>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: sizes.radius,
    alignItems: 'flex-start',
  },
  info: { backgroundColor: colors.primarySoft },
  sample: { backgroundColor: colors.sampleBg },
  text: { flex: 1 },
  empty: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
});
