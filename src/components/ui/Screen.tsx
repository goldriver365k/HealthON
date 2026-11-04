import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, sizes, spacing } from '@/theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

export interface ScreenProps {
  title: string;
  /** 제목 아래 작은 설명 */
  subtitle?: string;
  /** 뒤로 버튼 표시 (입력·상세 화면) */
  showBack?: boolean;
  /** 탭 화면 오른쪽 위 설정 버튼 */
  showSettings?: boolean;
  children: ReactNode;
  /** 화면 아래 고정 영역 (저장 버튼 등) */
  footer?: ReactNode;
  /** 큰 제목 대신 직접 그릴 머리 영역 (오늘 화면의 날짜 등) */
  header?: ReactNode;
}

/** 모든 화면의 공통 틀: 안전 영역 + 제목 + 스크롤 + (선택) 아래 고정 버튼 */
export function Screen({ title, subtitle, showBack, showSettings, children, footer, header }: ScreenProps) {
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={styles.safe} edges={footer ? ['top', 'bottom'] : ['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {(showBack || showSettings) && (
          <View style={styles.topBar}>
            {showBack ? (
              <AppButton variant="ghost" icon="back" label="뒤로" onPress={goBack} block={false} hint="이전 화면으로 돌아가요" />
            ) : (
              <View />
            )}
            {showSettings ? (
              <AppButton variant="ghost" icon="settings" label="설정" onPress={() => router.push('/settings')} block={false} />
            ) : null}
          </View>
        )}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {header ?? (
            <View style={styles.titleBox}>
              <AppText variant="title" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? <AppText tone="sub">{subtitle}</AppText> : null}
            </View>
          )}
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  content: {
    padding: sizes.screenPadding,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  titleBox: { gap: spacing.xs },
  footer: {
    paddingHorizontal: sizes.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
});
