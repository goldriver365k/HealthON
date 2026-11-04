/** 병원 일정 추가 */
import { router } from 'expo-router';

import { useFlash } from '@/components/ui';
import { AppointmentForm } from '@/features/appointments/AppointmentForm';
import { useRepository } from '@/data/store';
import { useSafeAction } from '@/hooks/useSafeAction';

export default function NewAppointmentScreen() {
  const repo = useRepository();
  const flash = useFlash();
  const { run } = useSafeAction();
  return (
    <AppointmentForm
      title="병원 일정 추가하기"
      onSubmit={(input) => run(async () => {
        const id = await repo.addAppointment(input);
        // 저장 후 바로 상세 화면으로 → '물어볼 것'을 이어서 적을 수 있게
        router.replace({ pathname: '/appointments/[id]', params: { id } });
        flash({ message: '병원 일정을 저장했어요' });
      })}
    />
  );
}
