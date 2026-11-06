/**
 * ② 건강기록 — 혈압·혈당·체중 목록, 최근 7일·30일 요약, 수정·삭제, 약 확인 요약(3단계)
 * ⚠ 요약은 평균·최저·최고·기록한 날 수만. 판정 문구 없음.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, ChoiceButtons, EmptyState, ListRow, SampleBadge, Screen } from '@/components/ui';
import { MedsSummary } from '@/features/records/MedsSummary';
import { SimpleBars } from '@/features/records/SimpleBars';
import { StepsRecords } from '@/features/steps/StepsRecords';
import { useAppState } from '@/data/store';
import { useNow } from '@/hooks/useNow';
import type { Measurement, MeasurementKind } from '@/types/domain';
import { spacing } from '@/theme';
import { formatShortDate, formatTime } from '@/utils/date';
import { glucoseTimingLabel, kindLabel, kindUnit, measurementSpokenText, measurementValueText } from '@/utils/labels';
import { dailyValues, filterRecentDays, summarizePeriod, type PeriodSummary } from '@/utils/stats';

type RecordView = MeasurementKind | 'meds' | 'steps';
const viewOptions: { value: RecordView; label: string }[] = [
  // 체중은 화면에서 뺐다 (2026-11-06 사용자 결정). 저장된 기록·DB는 그대로 둔다
  ...(['bp', 'glucose'] as const).map((value) => ({ value, label: kindLabel[value] })),
  { value: 'steps', label: '걸음' },
  { value: 'meds', label: '약' },
];
const periodOptions = [
  { value: 7, label: '최근 7일' },
  { value: 30, label: '최근 30일' },
] as const;

function SummaryText({ s }: { s: PeriodSummary }) {
  if (!s.primary) return <AppText tone="sub">이 기간에는 기록이 없어요.</AppText>;
  const unit = kindUnit[s.kind];
  return (
    <View style={styles.summary}>
      <AppText>
        {s.days}일 동안 <AppText bold>{s.daysRecorded}일</AppText> 기록했어요 (모두 {s.count}번)
      </AppText>
      {s.kind === 'bp' && s.secondary ? (
        <>
          <AppText tone="sub">평균</AppText>
          <AppText variant="number">
            {s.primary.average} / {s.secondary.average}
          </AppText>
          <AppText tone="sub">
            위 숫자 {s.primary.min}~{s.primary.max}, 아래 숫자 {s.secondary.min}~{s.secondary.max} ({unit})
          </AppText>
        </>
      ) : (
        <>
          <AppText tone="sub">평균</AppText>
          <AppText variant="number">
            {s.primary.average}
            <AppText tone="sub">{` ${unit}`}</AppText>
          </AppText>
          <AppText tone="sub">
            가장 낮은 값 {s.primary.min}, 가장 높은 값 {s.primary.max}
          </AppText>
        </>
      )}
    </View>
  );
}

function RecordRow({ m }: { m: Measurement }) {
  const d = new Date(m.measuredAt);
  const when = `${formatShortDate(d)} ${formatTime(d)}`;
  return (
    <ListRow
      onPress={() => router.push({ pathname: '/record/[id]', params: { id: m.id } })}
      accessibilityLabel={`${when}, ${measurementSpokenText(m)}${m.source === 'sample' ? ', 예시' : ''}`}
      hint="누르면 고치거나 지울 수 있어요">
      <View style={styles.rowTop}>
        <AppText tone="sub">{when}</AppText>
        <SampleBadge source={m.source} />
      </View>
      <AppText variant="heading">
        {measurementValueText(m)}
        {m.kind === 'bp' && m.pulse ? <AppText tone="sub">{`  맥박 ${m.pulse}`}</AppText> : null}
        {m.kind === 'glucose' ? <AppText tone="sub">{`  ${glucoseTimingLabel[m.glucoseTiming]}`}</AppText> : null}
      </AppText>
      {m.memo ? <AppText variant="caption" tone="sub">{m.memo}</AppText> : null}
    </ListRow>
  );
}

export default function RecordsScreen() {
  const state = useAppState();
  const now = useNow();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<RecordView>('bp');
  // 오늘 화면의 걸음 카드에서 들어오면 걸음 보기
  useEffect(() => {
    if (params.view === 'steps') setView('steps');
  }, [params.view]);
  const kind: MeasurementKind = view === 'meds' || view === 'steps' ? 'bp' : view;
  const [days, setDays] = useState<7 | 30>(7);

  const summary = summarizePeriod(state.measurements, kind, days, now);
  const list = filterRecentDays(
    state.measurements.filter((m) => m.kind === kind),
    days,
    now,
  ).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  const bars = dailyValues(state.measurements, kind, days, now);
  const barCaption =
    kind === 'bp' ? '하루 평균 위 숫자 (날짜별)' : kind === 'glucose' ? '하루 평균 혈당 (날짜별)' : '체중 (날짜별)';

  return (
    <Screen title="건강기록" showSettings>
      <ChoiceButtons options={viewOptions} value={view} onChange={setView} columns={2} />
      {view === 'steps' ? null : <ChoiceButtons options={periodOptions} value={days} onChange={(v) => setDays(v)} />}

      {view === 'steps' ? (
        <StepsRecords now={now} />
      ) : view === 'meds' ? (
        <MedsSummary days={days} now={now} />
      ) : (
        <>

      <Card>
        <AppText variant="heading" accessibilityRole="header">
          {kindLabel[kind]} 요약
        </AppText>
        <SummaryText s={summary} />
        <SimpleBars data={bars} caption={barCaption} />
      </Card>

      <AppButton
        label={`${kindLabel[kind]} 새로 기록하기`}
        icon="add"
        onPress={() => router.push({ pathname: '/record/new', params: { kind } })}
      />

      <Card style={styles.listCard}>
        <AppText variant="heading" accessibilityRole="header" style={styles.listTitle}>
          {kindLabel[kind]} 기록 ({list.length}개)
        </AppText>
        {list.length === 0 ? <EmptyState text="이 기간에는 기록이 없어요." /> : list.map((m) => <RecordRow key={m.id} m={m} />)}
      </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  listCard: { paddingHorizontal: 0, gap: 0 },
  listTitle: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
