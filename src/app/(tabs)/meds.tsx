/** ③ 약·병원 — 내 약 목록과 병원 일정 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, EmptyState, ListRow, SampleBadge, Screen } from '@/components/ui';
import { pastAppointments, questionsOf, schedulesOf, upcomingAppointments } from '@/data/selectors';
import { useAppState } from '@/data/store';
import { useNow } from '@/hooks/useNow';
import type { Medication } from '@/types/domain';
import { spacing } from '@/theme';
import { formatRelativeDate, formatShortDate, formatTime, formatTimeOfDay } from '@/utils/date';
import { doseSlotLabel } from '@/utils/labels';

export default function MedsScreen() {
  const state = useAppState();
  const now = useNow();
  const active = state.medications.filter((m) => m.isActive);
  const stopped = state.medications.filter((m) => !m.isActive);
  const upcoming = upcomingAppointments(state, now);
  const past = pastAppointments(state, now).slice(0, 3);

  const medRow = (m: Medication) => {
    const times = schedulesOf(state, m.id)
      .map((s) => `${doseSlotLabel[s.slot]} ${formatTimeOfDay(s.timeOfDay)}`)
      .join(', ');
    return (
      <ListRow
        key={m.id}
        onPress={() => router.push({ pathname: '/meds/[id]', params: { id: m.id } })}
        accessibilityLabel={`${m.name}${m.doseText ? `, ${m.doseText}` : ''}, ${times || '시간 없음'}${m.source === 'sample' ? ', 예시' : ''}`}
        hint="누르면 고칠 수 있어요">
        <View style={styles.line}>
          <AppText variant="heading" style={styles.shrink}>
            {m.name}
          </AppText>
          <SampleBadge source={m.source} />
        </View>
        <AppText tone="sub">
          {m.doseText ? `${m.doseText} · ` : ''}
          {times || '시간을 정하지 않았어요'}
        </AppText>
      </ListRow>
    );
  };

  return (
    <Screen title="약·병원" showSettings>
      <Card style={styles.listCard}>
        <AppText variant="heading" accessibilityRole="header" style={styles.pad}>
          내 약 ({active.length}개)
        </AppText>
        {active.length === 0 ? <EmptyState text="등록한 약이 없어요." /> : active.map(medRow)}
      </Card>
      <AppButton label="약 추가하기" icon="add" onPress={() => router.push('/meds/new')} testID="add-med" />

      {stopped.length > 0 ? (
        <Card style={styles.listCard}>
          <AppText variant="heading" accessibilityRole="header" style={styles.pad}>
            그만 먹는 약
          </AppText>
          {stopped.map(medRow)}
        </Card>
      ) : null}

      <Card style={styles.listCard}>
        <AppText variant="heading" accessibilityRole="header" style={styles.pad}>
          병원 가는 날
        </AppText>
        {upcoming.length === 0 ? (
          <EmptyState text="앞으로 잡힌 병원 일정이 없어요." />
        ) : (
          upcoming.map((a) => {
            const d = new Date(a.visitAt);
            const q = questionsOf(state, a.id).filter((x) => !x.isDone).length;
            const when = `${formatRelativeDate(d, now)} ${formatTime(d)}`;
            return (
              <ListRow
                key={a.id}
                onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: a.id } })}
                accessibilityLabel={`${when}, ${a.hospitalName}${q ? `, 물어볼 것 ${q}개` : ''}${a.source === 'sample' ? ', 예시' : ''}`}
                hint="누르면 일정과 물어볼 것을 볼 수 있어요">
                <View style={styles.line}>
                  <AppText variant="heading">{when}</AppText>
                  <SampleBadge source={a.source} />
                </View>
                <AppText>
                  {a.hospitalName}
                  {a.department ? ` · ${a.department}` : ''}
                </AppText>
                {q ? <AppText tone="sub">물어볼 것 {q}개</AppText> : null}
              </ListRow>
            );
          })
        )}
      </Card>
      <AppButton label="병원 일정 추가하기" icon="calendar" variant="secondary" onPress={() => router.push('/appointments/new')} />

      {past.length > 0 ? (
        <Card style={styles.listCard}>
          <AppText variant="heading" accessibilityRole="header" style={styles.pad}>
            지난 병원 일정
          </AppText>
          {past.map((a) => (
            <ListRow
              key={a.id}
              onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: a.id } })}
              accessibilityLabel={`${formatShortDate(new Date(a.visitAt))}, ${a.hospitalName}`}>
              <AppText tone="sub">{formatShortDate(new Date(a.visitAt))}</AppText>
              <AppText>{a.hospitalName}</AppText>
            </ListRow>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingHorizontal: 0, gap: 0 },
  pad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  shrink: { flexShrink: 1 },
});
