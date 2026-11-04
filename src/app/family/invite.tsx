/**
 * 가족 초대: ① 누구 ② 무엇을 보여줄지 ③ 제3자 제공 동의 ④ 초대 코드
 * 🔒 1단계: 화면 흐름만. 코드는 예시이며 저장·연결되지 않는다.
 *    3단계: 코드는 서버에서 만들고 해시로만 저장, 24시간 만료, 5회 실패 시 폐기.
 *    동의 문구는 출시 전 전문가 검토 대상 (docs/MASTER_PLAN.md H-1 P2).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AppButton, AppIcon, AppText, Card, ChoiceButtons, Notice, Screen, TextField } from '@/components/ui';
import type { ShareCategory } from '@/types/domain';
import { colors, sizes, spacing } from '@/theme';
import { shareCategories, shareCategoryLabel } from '@/utils/labels';
import { checkText } from '@/utils/validate';

const relationOptions = ['딸', '아들', '배우자', '며느리', '사위', '손주'].map((v) => ({ value: v, label: v }));
const scopeOptions = shareCategories.map((value) => ({ value, label: shareCategoryLabel[value] }));
const SAMPLE_CODE = '123 456';

export default function InviteScreen() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [relation, setRelation] = useState('');
  const [relationError, setRelationError] = useState<string | null>(null);
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
              setRelationError(err);
              if (!err) setStep(2);
            }}
          />
        }>
        <ChoiceButtons options={relationOptions} value={relation} onChange={setRelation} columns={3} />
        <TextField label="또는 직접 적기" value={relation} onChangeText={setRelation} maxLength={10} error={relationError} placeholder="예: 조카" />
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
              label="동의하고 코드 만들기"
              onPress={() => {
                if (!agreed) setAgreeError('동의에 표시해 주셔야 초대할 수 있어요');
                else setStep(4);
              }}
              style={styles.flex}
            />
          </View>
        }>
        <Notice tone="sample" text="체험용 동의 화면이에요. 실제 동의 문구는 출시 전에 전문가 검토를 받아 확정해요." />
        <Card>
          <AppText variant="heading">건강정보를 가족에게 보여주는 것에 대한 동의</AppText>
          <View style={styles.term}>
            <AppText bold>받는 사람</AppText>
            <AppText>초대 코드를 입력한 {relation}</AppText>
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

  return (
    <Screen title="초대 코드" subtitle={`${relation}에게 이 코드를 알려 주세요`} showBack footer={<AppButton label="다 했어요" large onPress={() => router.back()} />}>
      <Notice tone="sample" text="예시 코드예요. 지금은 실제 가족과 연결되지 않아요." />
      <Card>
        <AppText center tone="sub">
          초대 코드 (24시간 동안 쓸 수 있어요)
        </AppText>
        <AppText variant="number" center accessibilityLabel={`초대 코드 ${SAMPLE_CODE.split('').join(' ')}`} style={styles.code}>
          {SAMPLE_CODE}
        </AppText>
      </Card>
      <AppButton
        label="카카오톡 등으로 보내기"
        icon="invite"
        onPress={() =>
          Share.share({
            message: `[오늘건강] 가족 초대 코드: ${SAMPLE_CODE}\n오늘건강 앱 > 가족 안심 > 초대 코드 입력하기에 넣어 주세요. (24시간 동안 쓸 수 있어요)`,
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
