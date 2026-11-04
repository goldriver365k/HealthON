/**
 * 필수 동의 (서버 모드, 로그인 직후)
 * 🔒 보안·법률 검토 대상: 아래 문구는 초안이며 출시 전 전문가 검토로 확정한다 (MASTER_PLAN H-1 P1).
 * - 건강정보(민감정보)는 일반 개인정보 동의와 "별도로" 받는다.
 * - 동의 기록은 버전과 함께 서버(consents)에 남고, 감사기록이 생긴다.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppIcon, AppText, Card, Notice, Screen } from '@/components/ui';
import { REQUIRED_CONSENTS, useAuth } from '@/data/auth';
import { useSafeAction } from '@/hooks/useSafeAction';
import type { ConsentType } from '@/types/domain';
import { colors, sizes, spacing } from '@/theme';

const CONSENT_TEXT: Record<ConsentType, { title: string; body: string[] }> = {
  terms: {
    title: '[필수] 서비스 이용약관',
    body: [
      '오늘건강은 약 드신 것과 혈압·혈당·체중 기록, 병원 일정을 정리하도록 돕는 앱이에요.',
      '병을 진단하거나, 약을 바꾸라고 하거나, 건강 상태를 판정하지 않아요.',
      '몸이 불편하면 꼭 의료진과 상담하세요.',
    ],
  },
  privacy: {
    title: '[필수] 개인정보 수집·이용',
    body: [
      '모으는 정보: 이메일 주소, 호칭, 글씨 크기·알림 설정, 긴급 연락처(직접 입력한 경우)',
      '쓰는 곳: 로그인, 기록 보관, 알림',
      '보관 기간: 회원 탈퇴(계정 삭제) 때까지. 보안 기록은 법에 따라 일정 기간 보관 후 지워요.',
      '동의하지 않으면 앱을 쓸 수 없어요.',
    ],
  },
  sensitive_health: {
    title: '[필수] 건강정보(민감정보) 처리 — 별도 동의',
    body: [
      '모으는 정보: 혈압·맥박, 혈당, 체중, 먹는 약 이름과 먹었는지 여부, 병원 일정과 메모',
      '쓰는 곳: 내 기록을 보관하고 보여 드리기, 약·병원 알림',
      '보관 기간: 직접 지우거나 계정을 삭제할 때까지',
      '가족에게 보여 주는 것은 따로, 가족마다 다시 동의를 받아요.',
      '동의하지 않으면 기록을 저장할 수 없어요. 나중에 설정에서 철회할 수 있어요.',
    ],
  },
  age_14: {
    title: '[필수] 만 14세 이상입니다',
    body: ['만 14세 미만은 이 앱을 쓸 수 없어요.'],
  },
};

export default function ConsentScreen() {
  const auth = useAuth();
  const { run, busy } = useSafeAction();
  const [checked, setChecked] = useState<ConsentType[]>([]);
  const [open, setOpen] = useState<ConsentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allChecked = REQUIRED_CONSENTS.every((t) => checked.includes(t));

  const toggle = (t: ConsentType) => {
    setError(null);
    setChecked((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const submit = () =>
    run(async () => {
      if (!allChecked) {
        setError('필수 항목에 모두 동의해 주셔야 시작할 수 있어요');
        return;
      }
      await auth.agree(REQUIRED_CONSENTS);
    });

  return (
    <Screen
      title="동의가 필요해요"
      subtitle="각 항목의 ‘내용 보기’를 눌러 읽어 보세요"
      footer={<AppButton label={busy ? '저장하는 중…' : '동의하고 시작하기'} large onPress={submit} disabled={busy} testID="agree" />}>
      <Notice tone="sample" text="동의 문구는 초안이에요. 정식 출시 전에 전문가 검토를 받아 확정해요." />

      <AppButton
        label={allChecked ? '전체 동의 풀기' : '전체 동의하기'}
        variant="secondary"
        icon="done"
        onPress={() => setChecked(allChecked ? [] : [...REQUIRED_CONSENTS])}
      />

      {REQUIRED_CONSENTS.map((t) => {
        const on = checked.includes(t);
        return (
          <Card key={t}>
            <Pressable
              onPress={() => toggle(t)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={CONSENT_TEXT[t].title}
              style={[styles.row, on && styles.rowOn]}
              testID={`consent-${t}`}>
              <AppIcon name={on ? 'done' : 'todo'} color={on ? colors.primary : colors.textSub} size={32} />
              <AppText bold={on} style={styles.flex}>
                {CONSENT_TEXT[t].title}
              </AppText>
            </Pressable>
            <AppButton
              label={open === t ? '내용 닫기' : '내용 보기'}
              variant="ghost"
              onPress={() => setOpen(open === t ? null : t)}
              accessibilityLabel={`${CONSENT_TEXT[t].title} ${open === t ? '내용 닫기' : '내용 보기'}`}
            />
            {open === t ? (
              <View style={styles.body}>
                {CONSENT_TEXT[t].body.map((line) => (
                  <AppText key={line}>· {line}</AppText>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
      {error ? (
        <AppText tone="danger" bold>
          ! {error}
        </AppText>
      ) : null}
      <AppButton label="로그아웃" variant="ghost" onPress={() => run(() => auth.signOut())} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.buttonHeight,
    padding: spacing.sm,
    borderRadius: sizes.radius,
  },
  rowOn: { backgroundColor: colors.primarySoft },
  flex: { flex: 1 },
  body: { gap: spacing.xs, paddingHorizontal: spacing.sm },
});
