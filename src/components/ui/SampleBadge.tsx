import { StyleSheet, View } from 'react-native';

import type { DataSource } from '@/types/domain';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

/** 예시(가상) 데이터일 때만 '예시' 표시 */
export function SampleBadge({ source }: { source: DataSource }) {
  if (source !== 'sample') return null;
  return (
    <View style={styles.badge} accessible accessibilityLabel="예시 데이터">
      <AppText variant="caption" tone="sample" bold>
        예시
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.sampleBg,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
});
