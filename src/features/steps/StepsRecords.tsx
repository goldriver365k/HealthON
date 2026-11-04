/**
 * 건강기록 > 걸음: 일별(14일)·주별(8주)·월별(6달) 합계와 하루 평균.
 * ⚠ 숫자만 보여 준다. "부족해요/잘했어요" 같은 판정·목표 문구 없음.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, ChoiceButtons, EmptyState, SampleBadge } from '@/components/ui';
import { useAppState } from '@/data/store';
import { SimpleBars } from '@/features/records/SimpleBars';
import { formatSteps, groupSteps, type StepUnit } from '@/steps/stats';
import { STEP_HISTORY_DAYS } from '@/steps/pedometer';
import { colors, spacing } from '@/theme';
import { StepPermissionNotice, useStepPermission } from './StepPermissionNotice';

const unitOptions: { value: StepUnit; label: string }[] = [
  { value: 'day', label: '일별' },
  { value: 'week', label: '주별' },
  { value: 'month', label: '월별' },
];
const periodText: Record<StepUnit, string> = { day: '최근 14일', week: '최근 8주', month: '최근 6달' };
const rowTitle: Record<StepUnit, string> = { day: '날짜별 걸음', week: '주별 걸음 (월~일)', month: '달별 걸음' };

export function StepsRecords({ now }: { now: Date }) {
  const state = useAppState();
  const { permission, setPermission } = useStepPermission();
  const [unit, setUnit] = useState<StepUnit>('day');

  const buckets = groupSteps(state.dailySteps, unit, now);
  const recorded = buckets.filter((b) => b.daysRecorded > 0);
  const total = buckets.reduce((sum, b) => sum + b.total, 0);
  const days = buckets.reduce((sum, b) => sum + b.daysRecorded, 0);
  const average = days ? Math.round(total / days) : null;
  const sample = buckets.some((b) => b.hasSample);

  return (
    <>
      <StepPermissionNotice permission={permission} onChange={setPermission} />
      <ChoiceButtons options={unitOptions} value={unit} onChange={setUnit} columns={3} />

      <Card>
        <View style={styles.head}>
          <AppText variant="heading" accessibilityRole="header">
            걸음 요약 ({periodText[unit]})
          </AppText>
          {sample ? <SampleBadge source="sample" /> : null}
        </View>
        {average === null ? (
          <AppText tone="sub">이 기간에는 걸음 기록이 없어요.</AppText>
        ) : (
          <View style={styles.summary}>
            <AppText>
              <AppText bold>{days}일</AppText> 기록했어요
            </AppText>
            <AppText tone="sub">기록한 날 하루 평균</AppText>
            <AppText variant="number">
              {formatSteps(average)}
              <AppText tone="sub"> 걸음</AppText>
            </AppText>
            <AppText tone="sub">모두 {formatSteps(total)} 걸음</AppText>
          </View>
        )}
        <SimpleBars
          data={buckets.map((b) => ({ dateKey: b.key, value: b.daysRecorded ? b.total : null, label: unit === 'day' ? undefined : b.short }))}
          caption={unit === 'day' ? '날짜별 걸음 수' : unit === 'week' ? '주별 걸음 수 합계' : '달별 걸음 수 합계'}
          fromZero
        />
      </Card>

      <Card style={styles.listCard}>
        <AppText variant="heading" accessibilityRole="header">
          {rowTitle[unit]}
        </AppText>
        {recorded.length === 0 ? (
          <EmptyState text="아직 기록이 없어요." />
        ) : (
          [...recorded].reverse().map((b) => (
            <View
              key={b.key}
              style={styles.row}
              accessible
              accessibilityLabel={`${b.label}, ${formatSteps(b.total)} 걸음${unit === 'day' ? '' : `, 기록한 날 하루 평균 ${formatSteps(b.average ?? 0)} 걸음`}${b.hasSample ? ', 예시' : ''}`}>
              <View style={styles.rowTop}>
                <AppText tone="sub">{b.label}</AppText>
                {b.hasSample ? <SampleBadge source="sample" /> : null}
              </View>
              <AppText variant="heading">{formatSteps(b.total)} 걸음</AppText>
              {unit === 'day' ? null : (
                <AppText variant="caption" tone="sub">
                  {b.daysRecorded}일 기록 · 하루 평균 {formatSteps(b.average ?? 0)} 걸음
                </AppText>
              )}
            </View>
          ))
        )}
      </Card>

      <AppText variant="caption" tone="sub">
        휴대폰은 최근 {STEP_HISTORY_DAYS}일치 걸음만 앱에 알려 줘요. 일주일에 한 번 이상 앱을 열면 빠짐없이 저장돼요.
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  summary: { gap: spacing.xs },
  listCard: { gap: spacing.sm },
  row: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
