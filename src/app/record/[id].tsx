/** 건강 기록 고치기·지우기 */
import { router, useLocalSearchParams } from 'expo-router';

import { AppButton, EmptyState, Screen, useFlash } from '@/components/ui';
import { MeasurementForm } from '@/features/records/MeasurementForm';
import { useAppState, useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';
import { confirmAsync } from '@/utils/confirm';
import { kindLabel, measurementSpokenText } from '@/utils/labels';

export default function EditRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useAppState();
  const repo = useRepository();
  const flash = useFlash();
  const { run } = useSafeAction();
  const record = state.measurements.find((m) => m.id === id);

  if (!record) {
    return (
      <Screen title="기록을 찾을 수 없어요" showBack>
        <EmptyState text="이미 지워진 기록이에요." />
        <AppButton label="돌아가기" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <MeasurementForm
      kind={record.kind}
      initial={record}
      onSubmit={(input) =>
        run(async () => {
          await repo.updateMeasurement(record.id, input);
          router.back();
          flash({ message: '고친 내용을 저장했어요' });
        })
      }
      onDelete={() => run(async () => {
        const ok = await confirmAsync({
          title: '이 기록을 지울까요?',
          message: `${measurementSpokenText(record)}\n지운 기록은 다시 살릴 수 없어요.`,
          confirmLabel: '지우기',
          destructive: true,
        });
        if (!ok) return;
        await repo.deleteMeasurement(record.id);
        router.back();
        flash({ message: `${kindLabel[record.kind]} 기록을 지웠어요` });
      })}
    />
  );
}
