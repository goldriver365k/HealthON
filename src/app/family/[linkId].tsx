/**
 * 가족 연결 상세
 * - 내가 공유하는 가족(owner): 공유 항목 바꾸기, 공유 그만두기(동의 철회)
 * - 내가 보는 가족(viewer): 공유받은 정보 보기(허용 항목만), 그만 보기
 * 🔒 3단계에서 서버 함수가 연결·동의·항목 권한을 다시 검사한다. 앱 화면의 표시는 보조 수단일 뿐.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, ChoiceButtons, EmptyState, Notice, SampleBadge, Screen, StatusMark, useFlash } from '@/components/ui';
import { useAppState, useRepository } from '@/data/store';
import type { FamilyLink, ShareCategory, SharedSummary } from '@/types/domain';
import { spacing } from '@/theme';
import { useSafeAction } from '@/hooks/useSafeAction';
import { confirmAsync } from '@/utils/confirm';
import { formatLongDate, formatRelativeDate, formatShortDate, formatTime } from '@/utils/date';
import { shareCategories, shareCategoryLabel } from '@/utils/labels';

const scopeOptions = shareCategories.map((value) => ({ value, label: shareCategoryLabel[value] }));

function OwnerView({ link }: { link: FamilyLink }) {
  const repo = useRepository();
  const flash = useFlash();
  const { run } = useSafeAction();
  const selected = shareCategories.filter((c) => link.scope[c]);

  const toggle = (c: ShareCategory) => run(async () => {
    const next = { ...link.scope, [c]: !link.scope[c] };
    await repo.updateShareScope(link.id, next);
    flash({
      message: `${shareCategoryLabel[c]}: ${next[c] ? '이제 보여줘요' : '이제 안 보여줘요'}`,
      undo: () => repo.updateShareScope(link.id, link.scope),
    });
  });

  const revoke = () => run(async () => {
    const ok = await confirmAsync({
      title: `${link.personName}님과 공유를 그만둘까요?`,
      message: '바로 그만 보이게 돼요. 다시 공유하려면 새로 초대해야 해요.',
      confirmLabel: '공유 그만두기',
      destructive: true,
    });
    if (!ok) return;
    await repo.revokeLink(link.id);
    router.back();
    flash({ message: `${link.personName}님과 공유를 그만뒀어요` });
  });

  return (
    <>
      <Card>
        <AppText variant="heading">무엇을 보여줄까요?</AppText>
        <AppText tone="sub">누르면 바로 바뀌어요. 진료 때 물어볼 것과 메모는 보여주지 않아요.</AppText>
        <ChoiceButtons options={scopeOptions} value={selected} onChange={toggle} columns={1} />
      </Card>
      <AppText tone="sub">공유에 동의한 날: {formatLongDate(new Date(link.consentedAt))}</AppText>
      <AppButton label="공유 그만두기" variant="danger" onPress={revoke} hint="동의를 철회해요" />
    </>
  );
}

function ViewerView({ link, summary }: { link: FamilyLink; summary?: SharedSummary }) {
  const repo = useRepository();
  const flash = useFlash();
  const { run } = useSafeAction();

  const stop = () => run(async () => {
    const ok = await confirmAsync({
      title: `${link.personName}님 정보를 그만 볼까요?`,
      message: '다시 보려면 새로 초대를 받아야 해요.',
      confirmLabel: '그만 보기',
      destructive: true,
    });
    if (!ok) return;
    await repo.revokeLink(link.id);
    router.back();
    flash({ message: '그만 보기로 했어요' });
  });

  return (
    <>
      {!summary ? <EmptyState text="공유받은 정보가 없어요." /> : null}

      {summary && link.scope.intakes && summary.todayIntakes ? (
        <Card>
          <AppText variant="heading">오늘 약</AppText>
          {summary.todayIntakes.map((i) => (
            <View key={i.label} style={styles.line} accessible accessibilityLabel={`${i.label}, ${i.taken ? '드셨어요' : '아직 안 드셨어요'}`}>
              <AppText style={styles.label}>{i.label}</AppText>
              <StatusMark done={i.taken} doneText="드셨어요" todoText="아직 안 드셨어요" />
            </View>
          ))}
        </Card>
      ) : null}

      {summary && link.scope.bp && summary.recentBp ? (
        <Card>
          <AppText variant="heading">최근 혈압</AppText>
          {summary.recentBp.map((b) => {
            const d = new Date(b.measuredAt);
            return (
              <View key={b.measuredAt} style={styles.line} accessible accessibilityLabel={`${formatShortDate(d)}, 위 숫자 ${b.systolic}, 아래 숫자 ${b.diastolic}`}>
                <AppText tone="sub" style={styles.label}>
                  {formatRelativeDate(d)} {formatTime(d)}
                </AppText>
                <AppText variant="heading">
                  {b.systolic} / {b.diastolic}
                </AppText>
              </View>
            );
          })}
        </Card>
      ) : null}

      {summary && link.scope.appointments && summary.nextAppointment ? (
        <Card>
          <AppText variant="heading">다음 병원 일정</AppText>
          <AppText>
            {formatRelativeDate(new Date(summary.nextAppointment.visitAt))} {formatTime(new Date(summary.nextAppointment.visitAt))} ·{' '}
            {summary.nextAppointment.hospitalName}
          </AppText>
        </Card>
      ) : null}

      <AppText tone="sub">{link.personName}님이 허락한 항목만 보여요.</AppText>
      <AppButton label="그만 보기" variant="secondary" onPress={stop} />
    </>
  );
}

export default function FamilyLinkScreen() {
  const { linkId } = useLocalSearchParams<{ linkId: string }>();
  const state = useAppState();
  const link = state.familyLinks.find((l) => l.id === linkId && l.status === 'active');

  if (!link) {
    return (
      <Screen title="연결을 찾을 수 없어요" showBack>
        <EmptyState text="공유가 끝난 가족이에요." />
        <AppButton label="돌아가기" onPress={() => router.back()} />
      </Screen>
    );
  }

  const summary = state.sharedSummaries.find((s) => s.linkId === link.id);

  return (
    <Screen title={`${link.personName} (${link.relationLabel})`} subtitle={link.role === 'owner' ? '내 정보를 보는 가족' : '내가 정보를 보는 가족'} showBack>
      <SampleBadge source={link.source} />
      {link.source === 'sample' ? <Notice tone="sample" text="예시 가족이에요. 실제 사람과 연결되어 있지 않아요." /> : null}
      {link.role === 'owner' ? <OwnerView link={link} /> : <ViewerView link={link} summary={summary} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  label: { flexShrink: 1 },
});
