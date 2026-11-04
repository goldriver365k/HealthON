/** 병원 일정 고치기 + 진료 때 물어볼 것 (질문 메모는 가족에게 공유하지 않음) */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppIcon, AppText, Card, EmptyState, Notice, Screen, TextField, useFlash } from '@/components/ui';
import { AppointmentForm } from '@/features/appointments/AppointmentForm';
import { questionsOf } from '@/data/selectors';
import { useAppState, useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';
import { colors, sizes, spacing } from '@/theme';
import { confirmAsync } from '@/utils/confirm';
import { checkText } from '@/utils/validate';

function Questions({ appointmentId }: { appointmentId: string }) {
  const state = useAppState();
  const repo = useRepository();
  const [text, setText] = useState('');
  const { run } = useSafeAction();
  const [error, setError] = useState<string | null>(null);
  const items = questionsOf(state, appointmentId);

  const add = () =>
    run(async () => {
      const err = checkText(text, '물어볼 것', 200);
      setError(err);
      if (err) return;
      await repo.addQuestion(appointmentId, text.trim());
      setText('');
    });

  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        의사 선생님께 물어볼 것
      </AppText>
      <Notice text="여기 적은 내용은 가족에게 보이지 않아요." />
      {items.length === 0 ? <EmptyState text="아직 적은 것이 없어요." /> : null}
      {items.map((q) => (
        <View key={q.id} style={styles.qRow}>
          <Pressable
            onPress={() => run(() => repo.toggleQuestion(q.id))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: q.isDone }}
            accessibilityLabel={`${q.content}, ${q.isDone ? '물어봤어요' : '아직 안 물어봤어요'}`}
            style={({ pressed }) => [styles.qMain, pressed && styles.pressed]}>
            <AppIcon name={q.isDone ? 'done' : 'todo'} color={q.isDone ? colors.primary : colors.textSub} />
            <View style={styles.qText}>
              <AppText style={q.isDone ? styles.doneText : undefined}>{q.content}</AppText>
              <AppText variant="caption" tone={q.isDone ? 'primary' : 'sub'} bold={q.isDone}>
                {q.isDone ? '물어봤어요' : '아직 안 물어봤어요'}
              </AppText>
            </View>
          </Pressable>
          <AppButton
            label="지우기"
            variant="ghost"
            block={false}
            onPress={() => run(() => repo.deleteQuestion(q.id))}
            accessibilityLabel={`${q.content} 지우기`}
          />
        </View>
      ))}
      <TextField label="새로 적기" value={text} onChangeText={setText} maxLength={200} error={error} placeholder="예: 약을 먹고 속이 불편해요" />
      <AppButton label="물어볼 것 추가" icon="add" variant="secondary" onPress={add} />
    </Card>
  );
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useAppState();
  const repo = useRepository();
  const flash = useFlash();
  const { run } = useSafeAction();
  const apt = state.appointments.find((a) => a.id === id);

  if (!apt) {
    return (
      <Screen title="일정을 찾을 수 없어요" showBack>
        <EmptyState text="이미 지운 일정이에요." />
        <AppButton label="돌아가기" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <AppointmentForm
      title="병원 일정"
      initial={apt}
      onSubmit={(input) =>
        run(async () => {
          await repo.updateAppointment(apt.id, input);
          router.back();
          flash({ message: '병원 일정을 저장했어요' });
        })
      }
      extra={
        <>
          <Questions appointmentId={apt.id} />
          <AppButton
            label="이 일정 지우기"
            variant="danger"
            icon="delete"
            onPress={() => run(async () => {
              const ok = await confirmAsync({
                title: '이 병원 일정을 지울까요?',
                message: `${apt.hospitalName}\n물어볼 것도 함께 지워져요.`,
                confirmLabel: '지우기',
                destructive: true,
              });
              if (!ok) return;
              await repo.deleteAppointment(apt.id);
              router.back();
              flash({ message: '병원 일정을 지웠어요' });
            })}
          />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  qRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  qMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.buttonHeight,
    paddingVertical: spacing.sm,
  },
  qText: { flex: 1, gap: 2 },
  doneText: { textDecorationLine: 'line-through', color: colors.textSub },
  pressed: { backgroundColor: colors.surfaceMuted },
});
