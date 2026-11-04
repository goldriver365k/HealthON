/**
 * 가족 초대: ① 누구 ② 무엇을 보여줄지 ③ 제3자 제공 동의 ④ 초대 코드
 * 🔒 보안 검토 대상
 * - 서버 모드: 동의 후 서버 함수(create_family_invite)가 코드를 만든다. 서버에는 해시만 저장, 24시간 만료, 1회용.
 *   동의 사실(버전·항목)은 서버 감사기록에 남는다.
 * - 체험 모드: 코드는 항상 123456 (실제 연결 없음)
 * - 동의 문구는 출시 전 전문가 검토 대상 (docs/MASTER_PLAN.md H-1 P2).
 * - 가족에게는 실명 대신 여기서 정한 호칭만 보인다.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AppButton, AppIcon, AppText, Card, ChoiceButtons, Notice, Screen, TextField } from '@/components/ui';
import { dataMode } from '@/data/config';
import { useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';
import type { FamilyInviteResult, ShareCategory } from '@/types/domain';
import { colors, sizes, spacing } from '@/theme';
import { formatRelativeDate, formatTime } from '@/utils/date';
import { shareCategories, shareCategoryLabel } from '@/utils/labels';
import { checkText } from '@/utils/validate';

const relationOptions = ['딸', '아들', '배우자', '며느리', '사위', '손주'].map((v) => ({ value: v, label: v }));
const scopeOptions = shareCategories.map((value) => ({ value, label: shareCategoryLabel[value] }));
const ownerOptions = ['어머니', '아버지', '할머니', '할아버지'].map((v) => ({ value: v, label: v }));
const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

export default function InviteScreen() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [relation, setRelation] = useState('');
  const [relationError, setRelationError] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState('');
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [invite, setInvite] = useState<FamilyInviteResult | null>(null);
  const repo = useRepository();
  const { run, busy } = useSafeAction();
  const [scope, setScope] = useState<ShareCategory[]>([]); // 기본값: 아무것도 공유 안 함 (최소 공유)
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);

  const toggleScope = (c: ShareCategory) => {
    setScopeError(null);
    setScope((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };
  const scopeText = scope.map((c) => shareCategoryLabel[c]).join(', ');

  if (step === 1) {
    return (
      <Screen
        title="가족 초대하기"
        subtitle="1 / 3 단계 · 누구를 초대하세요?"
        showBack
        footer={
          <AppButton
            label="다음"
            large
            onPress={() => {
              const err = checkText(relation, '관계', 10);
              const err2 = checkText(ownerLabel, '내 호칭', 20);
              setRelationError(err);
              setOwnerError(err2);
              if (!err && !err2) setStep(2);
            }}
          />
        }>
        <ChoiceButtons options={relationOptions} value={relation} onChange={setRelation} columns={3} />
        <TextField label="또는 직접 적기" value={relation} onChangeText={setRelation} maxLength={10} error={relationError} placeholder="예: 조카" testID="relation" />
        <Card>
          <AppText variant="heading">가족에게 내가 어떻게 보일까요?</AppText>
          <ChoiceButtons options={ownerOptions} value={ownerLabel} onChange={setOwnerLabel} columns={2} />
          <TextField label="또는 직접 적기" value={ownerLabel} onChangeText={setOwnerLabel} maxLength={20} error={ownerError} placeholder="예: 엄마" testID="owner-label" />
          <AppText variant="caption" tone="sub">
            가족 휴대폰에는 이 호칭만 보여요. 이메일 등 다른 정보는 보이지 않아요.
          </AppText>
        </Card>
      </Screen>
    );
  }

  if (step === 2) {
    return (
      <Screen
        title="무엇을 보여줄까요?"
        subtitle={`2 / 3 단계 · ${relation}에게 보여줄 것을 골라 주세요`}
        showBack
        footer={
          <View style={styles.footerRow}>
            <AppButton label="이전" variant="secondary" onPress={() => setStep(1)} style={styles.flex} />
            <AppButton
              label="다음"
              onPress={() => {
                if (scope.length === 0) setScopeError('하나 이상 골라 주세요');
                else setStep(3);
              }}
              style={styles.flex}
            />
          </View>
        }>
        <ChoiceButtons options={scopeOptions} value={scope} onChange={toggleScope} columns={1} />
        {scopeError ? <AppText tone="danger" bold>! {scopeError}</AppText> : null}
        <Notice text="진료 때 물어볼 것과 메모는 보여주지 않아요. 나중에 언제든 바꾸거나 그만둘 수 있어요." />
      </Screen>
    );
  }

  if (step === 3) {
    return (
      <Screen
        title="공유 동의"
        subtitle="3 / 3 단계 · 내용을 읽고 동의해 주세요"
        showBack
        footer={
          <View style={styles.footerRow}>
            <AppButton label="이전" variant="secondary" onPress={() => setStep(2)} style={styles.flex} />
            <AppButton
              label={busy ? '만드는 중…' : '동의하고 코드 만들기'}
              disabled={busy}
              testID="make-code"
              onPress={() => {
                if (!agreed) {
                  setAgreeError('동의에 표시해 주셔야 초대할 수 있어요');
                  return;
                }
                run(async () => {
                  const result = await repo.createFamilyInvite({
                    relationLabel: relation.trim(),
                    ownerLabel: ownerLabel.trim(),
                    scope: {
                      bp: scope.includes('bp'),
                      glucose: scope.includes('glucose'),
                      weight: scope.includes('weight'),
                      intakes: scope.includes('intakes'),
                      appointments: scope.includes('appointments'),
                    },
                  });
                  setInvite(result);
                  setStep(4);
                });
              }}
              style={styles.flex}
            />
          </View>
        }>
        <Notice tone="sample" text="동의 문구는 초안이에요. 정식 출시 전에 전문가 검토를 받아 확정해요." />
        <Card>
          <AppText variant="heading">건강정보를 가족에게 보여주는 것에 대한 동의</AppText>
          <View style={styles.term}>
            <AppText bold>받는 사람</AppText>
            <AppText>초대 코드를 입력한 {relation} (가족에게는 ‘{ownerLabel}’(으)로 보여요)</AppText>
          </View>
          <View style={styles.term}>
            <AppText bold>보여주는 정보</AppText>
            <AppText>{scopeText}</AppText>
          </View>
          <View style={styles.term}>
            <AppText bold>왜 보여주나요</AppText>
            <AppText>가족이 안부를 확인할 수 있도록</AppText>
          </View>
          <View style={styles.term}>
            <AppText bold>언제까지</AppText>
            <AppText>내가 공유를 그만둘 때까지 (언제든 바로 그만둘 수 있어요)</AppText>
          </View>
          <View style={styles.term}>
            <AppText bold>동의하지 않으면</AppText>
            <AppText>동의하지 않아도 앱의 다른 기능은 그대로 쓸 수 있어요. 가족 공유만 되지 않아요.</AppText>
          </View>
        </Card>
        <Pressable
          onPress={() => {
            setAgreed(!agreed);
            setAgreeError(null);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          accessibilityLabel="위 내용을 읽었고, 건강정보를 가족에게 보여주는 것에 동의합니다"
          style={[styles.agree, agreed && styles.agreeOn]}>
          <AppIcon name={agreed ? 'done' : 'todo'} color={agreed ? colors.primary : colors.textSub} size={32} />
          <AppText bold={agreed} style={styles.flex}>
            위 내용을 읽었고, 건강정보를 가족에게 보여주는 것에 동의합니다
          </AppText>
        </Pressable>
        {agreeError ? <AppText tone="danger" bold>! {agreeError}</AppText> : null}
      </Screen>
    );
  }

  const code = invite?.code ?? '';
  const until = invite ? new Date(invite.expiresAt) : new Date();
  return (
    <Screen title="초대 코드" subtitle={`${relation}에게 이 코드를 알려 주세요`} showBack footer={<AppButton label="다 했어요" large onPress={() => router.back()} />}>
      {dataMode === 'demo' ? <Notice tone="sample" text="체험판 코드예요. 실제 가족과 연결되지 않아요." /> : null}
      <Card>
        <AppText center tone="sub">
          초대 코드 · {formatRelativeDate(until)} {formatTime(until)}까지 쓸 수 있어요
        </AppText>
        <AppText variant="number" center accessibilityLabel={`초대 코드 ${code.split('').join(' ')}`} style={styles.code} testID="invite-code">
          {spaced(code)}
        </AppText>
        <AppText center variant="caption" tone="sub">
          가족이 ‘가족 안심 &gt; 초대 코드 입력하기’에 넣으면 연결돼요. 한 번만 쓸 수 있어요.
        </AppText>
      </Card>
      <AppButton
        label="카카오톡 등으로 보내기"
        icon="invite"
        onPress={() =>
          Share.share({
            message: `[오늘건강] 가족 초대 코드: ${spaced(code)}\n오늘건강 앱 > 가족 안심 > 초대 코드 입력하기에 넣어 주세요. (24시간 동안, 한 번만 쓸 수 있어요)`,
          }).catch(() => {})
        }
      />
      <AppText tone="sub">보여주는 정보: {scopeText}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  term: { gap: 2, paddingVertical: spacing.xs },
  agree: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    minHeight: sizes.buttonHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: sizes.radius,
    backgroundColor: colors.surface,
  },
  agreeOn: { borderColor: colors.primary, borderWidth: 3, backgroundColor: colors.primarySoft },
  code: { letterSpacing: 6 },
});
