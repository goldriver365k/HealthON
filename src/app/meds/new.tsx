/** 약 추가 */
import { router } from 'expo-router';

import { useFlash } from '@/components/ui';
import { MedicationForm } from '@/features/meds/MedicationForm';
import { useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';
import { eulReul } from '@/utils/labels';

export default function NewMedicationScreen() {
  const repo = useRepository();
  const flash = useFlash();
  const { run } = useSafeAction();
  return (
    <MedicationForm
      title="약 추가하기"
      onSubmit={(input) =>
        run(async () => {
          const id = await repo.addMedication(input);
          router.back();
          flash({ message: `${eulReul(input.name)} 등록했어요`, undo: () => repo.deleteMedication(id) });
        })
      }
    />
  );
}
