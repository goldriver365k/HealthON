import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, sizes, spacing, type IconName } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const palette: Record<Variant, { bg: string; pressed: string; text: 'onPrimary' | 'default' | 'danger' | 'primary'; border: string; icon: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, text: 'onPrimary', border: colors.primary, icon: colors.textOnPrimary },
  secondary: { bg: colors.surface, pressed: colors.surfaceMuted, text: 'primary', border: colors.primary, icon: colors.primary },
  danger: { bg: colors.danger, pressed: colors.dangerPressed, text: 'onPrimary', border: colors.danger, icon: colors.textOnPrimary },
  ghost: { bg: 'transparent', pressed: colors.surfaceMuted, text: 'default', border: 'transparent', icon: colors.text },
};

export interface AppButtonProps {
  /** 버튼 글자 (필수 — 아이콘만 있는 버튼 금지) */
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  large?: boolean;
  disabled?: boolean;
  /** 스크린리더용 추가 설명 (예: "누르면 저녁 약을 먹은 것으로 표시돼요") */
  hint?: string;
  /** 스크린리더용 이름을 label과 다르게 하고 싶을 때 */
  accessibilityLabel?: string;
  /** 가로 꽉 채우기 (기본 true) */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 공통 버튼. 높이 56dp 이상, 누름 효과는 색 변화만(애니메이션 없음). */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  large,
  disabled,
  hint,
  accessibilityLabel,
  block = true,
  style,
  testID,
}: AppButtonProps) {
  const p = palette[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: large ? sizes.buttonHeightLarge : sizes.buttonHeight,
          backgroundColor: pressed ? p.pressed : p.bg,
          borderColor: p.border,
        },
        variant === 'ghost' && styles.ghost,
        block ? styles.block : styles.inline,
        disabled && styles.disabled,
        style,
      ]}>
      <View style={styles.content}>
        {icon ? <AppIcon name={icon} color={p.icon} size={large ? sizes.iconLarge : sizes.icon} /> : null}
        <AppText variant={large ? 'heading' : 'label'} tone={p.text} bold style={styles.label}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: sizes.radius,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  ghost: { paddingHorizontal: spacing.sm },
  block: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.45 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  label: { textAlign: 'center', flexShrink: 1 },
});
