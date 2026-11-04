/** 오늘 화면의 '오늘 걸음' 카드. 숫자만 보여 주고 판정·목표 문구는 없다. */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppIcon, AppText, Card, SampleBadge } from '@/components/ui';
import { useAppState } from '@/data/store';
import { formatSteps, stepsOn } from '@/steps/stats';
import { colors, spacing } from '@/theme';
import { StepPermissionNotice, useStepPermission } from './StepPermissionNotice';

export function StepsToday({ now }: { now: Date }) {
  const state = useAppState();
  const { permission, setPermission } = useStepPermission();
  const today = stepsOn(state.dailySteps, now);

  return (
    <Card>
      <View style={styles.head}>
        <AppIcon name="steps" color={colors.primary} />
        <AppText variant="heading" accessibilityRole="header">
          오늘 걸음
        </AppText>
        {today ? <SampleBadge source={today.source} /> : null}
      </View>
      {today ? (
        <AppText variant="number" accessibilityLabel={`오늘 ${formatSteps(today.steps)} 걸음`}>
          {formatSteps(today.steps)}
          <AppText tone="sub"> 걸음</AppText>
        </AppText>
      ) : permission === 'granted' ? (
        <AppText tone="sub">걸음 수를 가져오는 중이에요.</AppText>
      ) : null}
      <StepPermissionNotice permission={permission} onChange={setPermission} />
      <AppButton
        label="일별·주별·월별 걸음 보기"
        variant="secondary"
        onPress={() => router.push({ pathname: '/records', params: { view: 'steps' } })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
