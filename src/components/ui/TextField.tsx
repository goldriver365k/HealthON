import { useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useFontScale } from '@/data/store';
import { colors, fontFamily, fontSize, maxFontSizeMultiplier, sizes, spacing } from '@/theme';
import { AppText } from './AppText';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** 입력창 아래 안내 (예: "예: 1알") */
  help?: string;
  /** 오류 문구 — 있으면 빨간 테두리 + "!" 글자로 함께 표시 */
  error?: string | null;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  /** 큰 숫자 입력 (혈압·혈당 등) */
  big?: boolean;
  /** 입력창 오른쪽 단위 (mmHg 등) */
  unit?: string;
  multiline?: boolean;
  testID?: string;
}

/** 공통 입력창. 라벨은 항상 입력창 위에 보인다(placeholder만으로 안내하지 않음). */
export function TextField({
  label,
  value,
  onChangeText,
  help,
  error,
  placeholder,
  keyboardType,
  maxLength,
  big,
  unit,
  multiline,
  testID,
}: TextFieldProps) {
  const scale = useFontScale();
  const [focused, setFocused] = useState(false);
  const size = Math.round((big ? fontSize.number : fontSize.body) * scale);

  return (
    <View style={styles.wrap}>
      <AppText variant="label" bold>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          { minHeight: big ? sizes.inputHeight + 12 : sizes.inputHeight },
          focused && styles.focused,
          !!error && styles.errorBox,
        ]}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSub}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={unit ? `${label}, 단위 ${unit}` : label}
          accessibilityHint={error ?? help}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          style={[styles.input, { fontSize: size, fontFamily: big ? fontFamily.bold : fontFamily.regular }, multiline && styles.multiline]}
        />
        {unit ? (
          <AppText tone="sub" style={styles.unit}>
            {unit}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText tone="danger" bold accessibilityLiveRegion="polite">
          ! {error}
        </AppText>
      ) : help ? (
        <AppText variant="caption" tone="sub">
          {help}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: sizes.radius,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  focused: { borderColor: colors.primary, borderWidth: 3 },
  errorBox: { borderColor: colors.danger, borderWidth: 3 },
  // 너비 0에서 늘어나게: 입력창이 단위 글자(mmHg 등)를 상자 밖으로 밀어내지 않도록
  input: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, width: 0, color: colors.text, paddingVertical: spacing.sm },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  unit: { marginLeft: spacing.sm },
});
