/**
 * 오늘 화면 내용의 맨 끝에 있는 '긴급호출' 버튼 (빨간색, 화면을 끝까지 내려야 보임).
 * - 실수로 눌리지 않도록: 2초 동안 길게 누르면 바로 실행, 짧게 누르면 확인창을 거친다
 * - 등록된 긴급 연락처(가족 안심 > 긴급 연락처)에게만. 119 자동 연결·자동 신고 없음
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, AppText } from '@/components/ui';
import { useAppState } from '@/data/store';
import { colors, sizes, spacing } from '@/theme';
import { confirmAsync } from '@/utils/confirm';
import { runEmergencyCall } from './emergencyCall';

const HOLD_MS = 2000;

export function EmergencyCallButton() {
  const state = useAppState();
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
  const contacts = state.emergencyContacts;
  const first = [...contacts].sort((a, b) => a.priority - b.priority)[0];

  const run = async () => {
    if (busy) return;
    if (!first) {
      const go = await confirmAsync({
        title: '등록된 긴급 연락처가 없어요',
        message: '긴급호출을 받을 번호를 먼저 등록해 주세요.',
        confirmLabel: '지금 등록하기',
      });
      if (go) router.push('/family/contacts');
      return;
    }
    setBusy(true);
    try {
      await runEmergencyCall(state.settings.displayName, contacts);
    } finally {
      setBusy(false);
    }
  };

  const confirmThenRun = async () => {
    if (!first) return run();
    const ok = await confirmAsync({
      title: '긴급호출할까요?',
      message: `등록된 번호로 지금 위치를 문자로 보내고, ${first.name}에게 전화를 걸어요.`,
      confirmLabel: '긴급호출',
      destructive: true,
    });
    if (ok) await run();
  };

  const label = busy ? '위치 확인 중…' : holding ? '계속 누르고 계세요…' : '긴급호출';

  return (
    <Pressable
      onPress={confirmThenRun}
      onLongPress={run}
      delayLongPress={HOLD_MS}
      onPressIn={() => setHolding(true)}
      onPressOut={() => setHolding(false)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="긴급호출"
      accessibilityHint={first ? `등록된 번호로 위치 문자를 보내고 ${first.name}에게 전화를 걸어요. 누르면 확인창이 나와요.` : '긴급 연락처를 먼저 등록해야 해요.'}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID="emergency-call">
      <View style={styles.row}>
        <AppIcon name="emergency" size={sizes.iconLarge} color={colors.textOnPrimary} />
        <AppText variant="title" tone="onPrimary" bold>
          {label}
        </AppText>
      </View>
      <AppText variant="caption" tone="onPrimary" center>
        {first ? `2초 길게 누르면 ${first.name}에게 연결` : '긴급 연락처를 먼저 등록해 주세요'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.buttonHeightLarge,
    borderRadius: sizes.radius,
    backgroundColor: colors.danger,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pressed: { backgroundColor: colors.dangerPressed },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
