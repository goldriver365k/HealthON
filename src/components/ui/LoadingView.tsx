import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

/** 불러오는 중 / 불러오기 실패 화면 */
export function LoadingView({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.box} accessible accessibilityLiveRegion="polite">
        {error ? (
          <>
            <AppText variant="heading" center>
              정보를 불러오지 못했어요
            </AppText>
            <AppText center tone="sub">
              인터넷 연결을 확인해 주세요.
            </AppText>
            {onRetry ? <AppButton label="다시 불러오기" onPress={onRetry} /> : null}
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText variant="heading" center>
              불러오는 중이에요
            </AppText>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  box: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
});
