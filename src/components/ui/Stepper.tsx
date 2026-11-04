import { StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

interface StepperProps {
  label: string;
  /** 크게 보여줄 현재 값 (예: "오후 2:30", "11월 4일 수요일") */
  valueText: string;
  /** 스크린리더용 값 */
  spokenValue?: string;
  steps: { label: string; onPress: () => void; hint?: string }[];
}

/**
 * 날짜·시각 조정. 달력·시계 휠 대신 큰 버튼(-1시간, +10분 등)으로 조정한다.
 * (추가 패키지 없이 구현, 어르신이 작은 휠을 돌리지 않아도 됨)
 */
export function Stepper({ label, valueText, spokenValue, steps }: StepperProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label" bold>
        {label}
      </AppText>
      <View style={styles.valueBox} accessible accessibilityLabel={`${label}: ${spokenValue ?? valueText}`}>
        <AppText variant="number" center>
          {valueText}
        </AppText>
      </View>
      <View style={styles.grid}>
        {steps.map((s) => (
          <AppButton
            key={s.label}
            label={s.label}
            variant="secondary"
            onPress={s.onPress}
            hint={s.hint}
            style={styles.step}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  valueBox: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: sizes.radius,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  step: { flexBasis: '47%', flexGrow: 1 },
});
