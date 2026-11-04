import { Pressable, StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export interface Choice<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  label?: string;
  options: readonly Choice<T>[];
  /** 하나 고르기: 값 하나 / 여러 개 고르기: 값 배열 */
  value: T | T[];
  onChange: (value: T) => void;
  /** 한 줄에 몇 개 (기본 2) */
  columns?: 1 | 2 | 3;
}

/**
 * 큰 선택 버튼 묶음. 선택된 것은 굵은 테두리 + ✓ 아이콘 + 굵은 글씨 (색만으로 구분하지 않음).
 */
export function ChoiceButtons<T extends string | number>({ label, options, value, onChange, columns = 2 }: Props<T>) {
  const isSelected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  const multi = Array.isArray(value);
  return (
    <View style={styles.wrap} accessibilityRole={multi ? undefined : 'radiogroup'}>
      {label ? (
        <AppText variant="label" bold>
          {label}
        </AppText>
      ) : null}
      <View style={styles.grid}>
        {options.map((o) => {
          const selected = isSelected(o.value);
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityLabel={o.label}
              accessibilityState={multi ? { checked: selected } : { selected }}
              style={({ pressed }) => [
                styles.item,
                { flexBasis: columns === 1 ? '100%' : columns === 2 ? '47%' : '30%' },
                selected && styles.selected,
                pressed && styles.pressed,
              ]}>
              <AppIcon name={selected ? 'done' : 'todo'} color={selected ? colors.primary : colors.textSub} />
              <AppText bold={selected} style={styles.text}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  item: {
    flexGrow: 1,
    minHeight: sizes.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: sizes.radius,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, borderWidth: 3, backgroundColor: colors.primarySoft },
  pressed: { backgroundColor: colors.surfaceMuted },
  text: { flexShrink: 1 },
});
