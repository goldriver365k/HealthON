/**
 * ④ 가족 안심 — 119·긴급 연락처, 내 정보를 보는 가족, 내가 보는 가족
 * 1단계: 가족 연결은 예시 화면. 실제 연결·서버 권한 검사는 3단계.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, EmptyState, ListRow, Notice, SampleBadge, Screen } from '@/components/ui';
import { useAppState } from '@/data/store';
import type { FamilyLink } from '@/types/domain';
import { spacing } from '@/theme';
import { shareCategories, shareCategoryLabel } from '@/utils/labels';
import { callWithConfirm } from '@/utils/phone';

function scopeText(link: FamilyLink): string {
  const items = shareCategories.filter((c) => link.scope[c]).map((c) => shareCategoryLabel[c]);
  return items.length ? items.join(', ') : '공유하는 항목 없음';
}

export default function FamilyScreen() {
  const state = useAppState();
  const contacts = [...state.emergencyContacts].sort((a, b) => a.priority - b.priority);
  const owners = state.familyLinks.filter((l) => l.role === 'owner' && l.status === 'active');
  const viewing = state.familyLinks.filter((l) => l.role === 'viewer' && l.status === 'active');

  const linkRow = (l: FamilyLink, kind: 'owner' | 'viewer') => (
    <ListRow
      key={l.id}
      onPress={() => router.push({ pathname: '/family/[linkId]', params: { linkId: l.id } })}
      accessibilityLabel={`${l.personName}, ${l.relationLabel}, ${kind === 'owner' ? '공유 중' : '받는 중'}: ${scopeText(l)}${l.source === 'sample' ? ', 예시' : ''}`}
      hint={kind === 'owner' ? '누르면 공유 항목을 바꾸거나 그만둘 수 있어요' : '누르면 공유받은 정보를 볼 수 있어요'}>
      <View style={styles.line}>
        <AppText variant="heading">
          {l.personName} ({l.relationLabel})
        </AppText>
        <SampleBadge source={l.source} />
      </View>
      <AppText tone="sub">
        {kind === 'owner' ? '보여주는 것: ' : '받는 것: '}
        {scopeText(l)}
      </AppText>
    </ListRow>
  );

  return (
    <Screen title="가족 안심" showSettings>
      {/* 긴급 전화 — 가장 위, 가장 크게 */}
      <Card>
        <AppButton
          label="119 전화하기"
          icon="emergency"
          variant="danger"
          large
          onPress={() => callWithConfirm('119', '119')}
          hint="확인 후 전화 앱이 열려요"
          testID="call-119"
        />
        {contacts.map((c) => (
          <AppButton
            key={c.id}
            label={`${c.relationLabel ?? c.name}${c.relationLabel ? ` ${c.name}` : ''}에게 전화`}
            icon="call"
            variant="secondary"
            onPress={() => callWithConfirm(c.name, c.phone)}
          />
        ))}
        <AppButton label="긴급 연락처 관리" variant="ghost" icon="edit" onPress={() => router.push('/family/contacts')} />
      </Card>

      <Notice tone="sample" text="가족 연결은 체험용 예시 화면이에요. 실제 연결은 다음 단계에서 만들어져요." />

      <Card style={styles.listCard}>
        <AppText variant="heading" accessibilityRole="header" style={styles.pad}>
          내 정보를 보는 가족
        </AppText>
        {owners.length === 0 ? <EmptyState text="아직 공유하는 가족이 없어요." /> : owners.map((l) => linkRow(l, 'owner'))}
      </Card>
      <AppButton label="가족 초대하기" icon="invite" onPress={() => router.push('/family/invite')} testID="invite" />

      <Card style={styles.listCard}>
        <AppText variant="heading" accessibilityRole="header" style={styles.pad}>
          내가 보는 가족
        </AppText>
        {viewing.length === 0 ? <EmptyState text="공유받는 가족이 없어요." /> : viewing.map((l) => linkRow(l, 'viewer'))}
      </Card>
      <AppButton label="초대 코드 입력하기" variant="secondary" onPress={() => router.push('/family/join')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingHorizontal: 0, gap: 0 },
  pad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
