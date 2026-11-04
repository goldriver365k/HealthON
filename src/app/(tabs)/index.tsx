/** ① 오늘 — 핵심 행동 3개: 약 확인 / 혈압 기록 / 혈당 기록 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppIcon, AppText, Card, Notice, SampleBadge, Screen, StatusMark } from '@/components/ui';
import { dataMode } from '@/data/config';
import { DoseRow } from '@/features/today/DoseRow';
import { NotificationReminder } from '@/features/today/NotificationReminder';
import { StepsToday } from '@/features/steps/StepsToday';
import { appointmentsOnDate, dosesForDate, latestOnDate, questionsOf, todayProgress } from '@/data/selectors';
import { useAppState } from '@/data/store';
import { useNow } from '@/hooks/useNow';
import { colors, spacing } from '@/theme';
import { formatLongDate, formatTime, toDateKey } from '@/utils/date';
import { glucoseTimingLabel } from '@/utils/labels';

export default function TodayScreen() {
  const state = useAppState();
  const now = useNow();
  const dateKey = toDateKey(now);
  const doses = dosesForDate(state, now);
  const progress = todayProgress(state, now);
  const bp = latestOnDate(state, 'bp', now);
  const glucose = latestOnDate(state, 'glucose', now);
  const appointments = appointmentsOnDate(state, now);
  const allDone = progress.done === progress.total;

  return (
    <Screen
      title="오늘"
      showSettings
      header={
        <View style={styles.header} accessible accessibilityRole="header" accessibilityLabel={`오늘은 ${formatLongDate(now)}. 오늘 할 일 ${progress.total}개 중 ${progress.done}개 했어요`}>
          <AppText variant="date">{formatLongDate(now)}</AppText>
          <View style={styles.progress}>
            <AppIcon name={allDone ? 'done' : 'todo'} color={allDone ? colors.primary : colors.textSub} />
            <AppText variant="heading" tone={allDone ? 'primary' : 'default'} style={styles.progressText}>
              {allDone ? '오늘 할 일을 다 했어요' : `오늘 할 일 ${progress.total}개 중 ${progress.done}개 했어요`}
            </AppText>
          </View>
        </View>
      }>
      {dataMode === 'demo' ? (
        <Notice tone="sample" text="체험판이에요. 예시 데이터로 보여드리고, 입력한 내용은 앱을 다시 켜면 사라져요." />
      ) : null}

      <NotificationReminder />

      {/* 약 확인 */}
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          오늘 드실 약
        </AppText>
        {doses.length === 0 ? (
          <AppText tone="sub">오늘 드실 약이 없어요. ‘약·병원’에서 약을 등록할 수 있어요.</AppText>
        ) : (
          doses.map((d) => <DoseRow key={d.schedule.id} item={d} dateKey={dateKey} />)
        )}
      </Card>

      {/* 혈압 */}
      <Card>
        <View style={styles.cardHead}>
          <AppText variant="heading" accessibilityRole="header">
            혈압
          </AppText>
          {bp ? <SampleBadge source={bp.source} /> : null}
        </View>
        {bp ? (
          <View accessible accessibilityLabel={`오늘 혈압 위 숫자 ${bp.systolic}, 아래 숫자 ${bp.diastolic}, ${formatTime(new Date(bp.measuredAt))}에 기록`}>
            <StatusMark done doneText={`기록했어요 · ${formatTime(new Date(bp.measuredAt))}`} />
            <AppText variant="number">
              {bp.systolic} / {bp.diastolic}
              {bp.pulse ? <AppText tone="sub">{`  맥박 ${bp.pulse}`}</AppText> : null}
            </AppText>
          </View>
        ) : (
          <StatusMark done={false} todoText="오늘은 아직 기록 전이에요" />
        )}
        <AppButton
          label={bp ? '혈압 한 번 더 기록하기' : '혈압 기록하기'}
          icon="bp"
          variant={bp ? 'secondary' : 'primary'}
          onPress={() => router.push({ pathname: '/record/new', params: { kind: 'bp' } })}
          testID="go-bp"
        />
      </Card>

      {/* 혈당 */}
      <Card>
        <View style={styles.cardHead}>
          <AppText variant="heading" accessibilityRole="header">
            혈당
          </AppText>
          {glucose ? <SampleBadge source={glucose.source} /> : null}
        </View>
        {glucose ? (
          <View accessible accessibilityLabel={`오늘 혈당 ${glucose.glucoseMgdl}, ${glucoseTimingLabel[glucose.glucoseTiming]}`}>
            <StatusMark done doneText={`기록했어요 · ${formatTime(new Date(glucose.measuredAt))}`} />
            <AppText variant="number">
              {glucose.glucoseMgdl}
              <AppText tone="sub">{`  ${glucoseTimingLabel[glucose.glucoseTiming]}`}</AppText>
            </AppText>
          </View>
        ) : (
          <StatusMark done={false} todoText="오늘은 아직 기록 전이에요" />
        )}
        <AppButton
          label={glucose ? '혈당 한 번 더 기록하기' : '혈당 기록하기'}
          icon="glucose"
          variant={glucose ? 'secondary' : 'primary'}
          onPress={() => router.push({ pathname: '/record/new', params: { kind: 'glucose' } })}
          testID="go-glucose"
        />
      </Card>

      {/* 걸음 */}
      <StepsToday now={now} />

      {/* 오늘 진료 (있을 때만) */}
      {appointments.map((a) => {
        const qCount = questionsOf(state, a.id).filter((q) => !q.isDone).length;
        return (
          <Card key={a.id}>
            <View style={styles.cardHead}>
              <AppIcon name="hospital" color={colors.primary} />
              <AppText variant="heading" accessibilityRole="header">
                오늘 병원 가는 날
              </AppText>
              <SampleBadge source={a.source} />
            </View>
            <AppText variant="heading">
              {formatTime(new Date(a.visitAt))} · {a.hospitalName}
            </AppText>
            {qCount > 0 ? <AppText tone="sub">물어볼 것 {qCount}개가 적혀 있어요</AppText> : null}
            <AppButton
              label="일정·물어볼 것 보기"
              variant="secondary"
              onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: a.id } })}
            />
          </Card>
        );
      })}

      <AppText variant="caption" tone="sub">
        이 앱은 기록을 돕는 앱이에요. 병을 진단하거나 약을 바꾸라고 하지 않아요. 몸이 불편하면 의료진과 상담하세요.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressText: { flex: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
