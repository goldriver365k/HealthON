/** 새 건강 기록 (혈압·혈당 공용 화면, ?kind=bp|glucose) */
import { router, useLocalSearchParams } from 'expo-router';

import { useFlash } from '@/components/ui';
import { MeasurementForm } from '@/features/records/MeasurementForm';
import { useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';
import type { MeasurementKind } from '@/types/domain';
import { kindLabel } from '@/utils/labels';

// 체중은 새로 기록하지 않음 (화면에서 뺌). 예전 체중 기록 고치기는 record/[id]에서 그대로 가능
const KINDS: MeasurementKind[] = ['bp', 'glucose'];

export default function NewRecordScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: MeasurementKind = KINDS.includes(params.kind as MeasurementKind) ? (params.kind as MeasurementKind) : 'bp';
  const repo = useRepository();
  const flash = useFlash();
  const { run } = useSafeAction();

  return (
    <MeasurementForm
      kind={kind}
      onSubmit={(input) =>
        run(async () => {
          const id = await repo.addMeasurement(input);
          router.back();
          flash({ message: `${kindLabel[kind]}을 저장했어요`, undo: () => repo.deleteMeasurement(id) });
        })
      }
    />
  );
}
