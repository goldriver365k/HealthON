/**
 * 건강기록 탭의 '약' 요약: 최근 N일 동안 먹었다고 표시한 횟수.
 * ⚠ 비율·점수·"잘했어요/부족해요" 같은 평가는 하지 않는다. 횟수만 보여준다.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, EmptyState, SampleBadge } from '@/components/ui';
import { adherenceSummary } from '@/data/selectors';
import { useAppState } from '@/data/store';
import { spacing } from '@/theme';
import { SimpleBars } from './SimpleBars';

export function MedsSummary({ days, now }: { days: number; now: Date }) {
  const state = useAppState();
  const s = adherenceSummary(state, days, now);

  if (s.perMedication.length === 0) {
    return (
      <Card>
        <EmptyState text="등록한 약이 없어요." />
        <AppButton label="약 등록하러 가기" variant="secondary" onPress={() => router.push('/meds/new')} />
      </Card>
    );
  }

  return (
    <>
      <Card accessible={false}>
        <AppText variant="heading" accessibilityRole="header">
          약 확인 요약
        </AppText>
        <View accessible accessibilityLabel={`최근 ${days}일 동안 ${s.total}번 중 ${s.taken}번 먹었다고 표시했어요`}>
          <AppText tone="sub">최근 {days}일 동안 먹었다고 표시한 횟수</AppText>
          <AppText variant="number">
            {s.taken}
            <AppText tone="sub">{` / ${s.total}번`}</AppText>
          </AppText>
        </View>
        <SimpleBars data={s.daily} caption="하루에 먹었다고 표시한 횟수 (날짜별)" fromZero />
      </Card>

      <Card style={styles.listCard}>
        <AppText variant="heading" accessibilityRole="header" style={styles.pad}>
          약별 현황
        </AppText>
        {s.perMedication.map((m) => (
          <View
            key={m.medicationId}
            style={styles.row}
            accessible
            accessibilityLabel={`${m.name}, ${m.total}번 중 ${m.taken}번 표시${m.source === 'sample' ? ', 예시' : ''}`}>
            <View style={styles.name}>
              <AppText bold>{m.name}</AppText>
              <SampleBadge source={m.source} />
            </View>
            <AppText>
              {m.total}번 중 <AppText bold>{m.taken}번</AppText>
            </AppText>
          </View>
        ))}
      </Card>
      <AppText variant="caption" tone="sub">
        약을 먹었는데 표시를 못 한 날도 있을 수 있어요. 약에 대해 궁금한 점은 의사·약사와 상담하세요.
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingHorizontal: 0, gap: 0 },
  pad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  name: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, flexWrap: 'wrap' },
});
