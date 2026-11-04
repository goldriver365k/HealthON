/** 약 고치기 · 최근 7일 확인 현황 · 그만 먹기 · 지우기 */
import { router, useLocalSearchParams } from 'expo-router';

import { AppButton, AppText, Card, EmptyState, Screen, useFlash } from '@/components/ui';
import { MedicationForm } from '@/features/meds/MedicationForm';
import { intakeHistory, schedulesOf } from '@/data/selectors';
import { useAppState, useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';
import { useNow } from '@/hooks/useNow';
import { confirmAsync } from '@/utils/confirm';
import { eulReul } from '@/utils/labels';

export default function EditMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useAppState();
  const repo = useRepository();
  const flash = useFlash();
  const now = useNow();
  const { run } = useSafeAction();
  const med = state.medications.find((m) => m.id === id);

  if (!med) {
    return (
      <Screen title="약을 찾을 수 없어요" showBack>
        <EmptyState text="이미 지운 약이에요." />
        <AppButton label="돌아가기" onPress={() => router.back()} />
      </Screen>
    );
  }

  const schedules = schedulesOf(state, med.id);
  const history = intakeHistory(state, med.id, 7, now);

  const remove = () => run(async () => {
    const ok = await confirmAsync({
      title: `${eulReul(med.name)} 지울까요?`,
      message: '먹은 기록도 함께 지워져요. 기록을 남기려면 ‘그만 먹는 약으로 표시’를 눌러 주세요.',
      confirmLabel: '지우기',
      destructive: true,
    });
    if (!ok) return;
    await repo.deleteMedication(med.id);
    router.back();
    flash({ message: `${eulReul(med.name)} 지웠어요` });
  });

  return (
    <MedicationForm
      title="약 고치기"
      initial={{
        name: med.name,
        doseText: med.doseText,
        memo: med.memo,
        schedules: schedules.map((s) => ({ slot: s.slot, timeOfDay: s.timeOfDay })),
      }}
      onSubmit={(input) =>
        run(async () => {
          await repo.updateMedication(med.id, input);
          router.back();
          flash({ message: '고친 내용을 저장했어요' });
        })
      }
      extra={
        <>
          <Card accessible accessibilityLabel={`최근 7일 동안 ${history.total}번 중 ${history.taken}번 먹었다고 표시했어요`}>
            <AppText variant="heading">최근 7일</AppText>
            <AppText>
              {history.total}번 중 <AppText bold>{history.taken}번</AppText> 먹었다고 표시했어요
            </AppText>
          </Card>
          {med.isActive ? (
            <AppButton
              label="그만 먹는 약으로 표시"
              variant="secondary"
              onPress={() => run(async () => {
                await repo.setMedicationActive(med.id, false);
                router.back();
                flash({ message: `${eulReul(med.name)} 그만 먹는 약으로 옮겼어요`, undo: () => repo.setMedicationActive(med.id, true) });
              })}
              hint="오늘 화면에서 사라지고 기록은 남아요"
            />
          ) : (
            <AppButton
              label="다시 먹는 약으로 표시"
              variant="secondary"
              onPress={() => run(async () => {
                await repo.setMedicationActive(med.id, true);
                flash({ message: `${eulReul(med.name)} 다시 먹는 약으로 옮겼어요` });
              })}
            />
          )}
          <AppButton label="이 약 지우기" variant="danger" icon="delete" onPress={remove} />
        </>
      }
    />
  );
}
